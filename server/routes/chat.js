const express = require('express');
const { verifyToken } = require('../middleware/verifyToken');
const { buildReply } = require('../services/assistant');
const { getDb, isAuthEnabled } = require('../firebase');

const router = express.Router();

/** @type {Map<string, Array<{id:string,title:string,createdAt:string,updatedAt:string,messages:object[]}>>} */
const demoSessions = new Map();

function newSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function getDemoSessions(uid) {
  if (!demoSessions.has(uid)) demoSessions.set(uid, []);
  return demoSessions.get(uid);
}

function findDemoSession(uid, sessionId) {
  return getDemoSessions(uid).find((s) => s.id === sessionId);
}

function createDemoSession(uid, title = 'New chat') {
  const now = new Date().toISOString();
  const session = {
    id: newSessionId(),
    title,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  getDemoSessions(uid).unshift(session);
  return session;
}

function sessionSummary(session) {
  const firstUser = session.messages.find((m) => m.role === 'user');
  const lastMsg = session.messages[session.messages.length - 1];
  const preview =
    lastMsg?.content?.slice(0, 80) ||
    firstUser?.content?.slice(0, 80) ||
    '';
  return {
    id: session.id,
    title: session.title || firstUser?.content?.slice(0, 48) || 'Chat',
    preview,
    updatedAt: session.updatedAt,
    messageCount: session.messages.length,
  };
}

router.post('/', verifyToken, async (req, res) => {
  try {
    const { message, language, assistantName, userName, sessionId: bodySessionId } = req.body;
    if (!message?.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const result = await buildReply({
      message: message.trim(),
      language: language || 'en',
      assistantName: assistantName || 'Sahayak',
      userName: userName || '',
    });

    const reply = typeof result === 'string' ? result : result.reply;
    const places = result.places || [];
    const mapMarkers = result.mapMarkers || [];

    const uid = req.user.uid;
    const db = getDb();
    const now = new Date().toISOString();

    const userEntry = {
      userId: uid,
      role: 'user',
      content: message.trim(),
      language: language || 'en',
      timestamp: now,
    };
    const replyEntry = {
      userId: uid,
      role: 'assistant',
      content: reply,
      language: language || 'en',
      timestamp: now,
      mapMarkers: mapMarkers.length ? mapMarkers : undefined,
    };

    let sessionId = bodySessionId;

    if (db && isAuthEnabled()) {
      if (!sessionId) {
        const sessionRef = await db.collection('chat_sessions').add({
          userId: uid,
          title: message.trim().slice(0, 48),
          preview: message.trim().slice(0, 80),
          createdAt: now,
          updatedAt: now,
          messageCount: 2,
        });
        sessionId = sessionRef.id;
      } else {
        const sessionRef = db.collection('chat_sessions').doc(sessionId);
        const existing = await sessionRef.get();
        const prevCount = existing.exists ? existing.data().messageCount || 0 : 0;
        await sessionRef.set(
          {
            updatedAt: now,
            preview: message.trim().slice(0, 80),
            messageCount: prevCount + 2,
          },
          { merge: true }
        );
      }

      await db.collection('chats').add({ ...userEntry, sessionId });
      await db.collection('chats').add({ ...replyEntry, sessionId });
    } else {
      let session = sessionId ? findDemoSession(uid, sessionId) : null;
      if (!session) {
        session = createDemoSession(uid, message.trim().slice(0, 48));
        sessionId = session.id;
      }
      if (session.messages.length === 0) {
        session.title = message.trim().slice(0, 48);
      }
      session.messages.push(userEntry, replyEntry);
      session.updatedAt = now;
    }

    res.json({ reply, places, mapMarkers, sessionId });
  } catch (err) {
    console.error('[chat]', err);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

router.get('/sessions', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const db = getDb();

    if (db && isAuthEnabled()) {
      const snap = await db
        .collection('chat_sessions')
        .where('userId', '==', uid)
        .orderBy('updatedAt', 'desc')
        .limit(50)
        .get();

      const sessions = snap.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title || 'Chat',
          preview: data.preview || '',
          updatedAt: data.updatedAt,
          messageCount: data.messageCount || 0,
        };
      });
      return res.json({ sessions });
    }

    const sessions = getDemoSessions(uid).map(sessionSummary);
    res.json({ sessions });
  } catch (err) {
    console.error('[sessions]', err);
    res.status(500).json({ error: 'Failed to load sessions' });
  }
});

router.post('/sessions', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const db = getDb();
    const now = new Date().toISOString();
    const title = req.body?.title || 'New chat';

    if (db && isAuthEnabled()) {
      const ref = await db.collection('chat_sessions').add({
        userId: uid,
        title,
        createdAt: now,
        updatedAt: now,
      });
      return res.json({ sessionId: ref.id, title });
    }

    const session = createDemoSession(uid, title);
    res.json({ sessionId: session.id, title: session.title });
  } catch (err) {
    console.error('[sessions/new]', err);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

router.get('/sessions/:sessionId', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { sessionId } = req.params;
    const db = getDb();

    if (db && isAuthEnabled()) {
      const sessionDoc = await db.collection('chat_sessions').doc(sessionId).get();
      if (!sessionDoc.exists || sessionDoc.data().userId !== uid) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const snap = await db
        .collection('chats')
        .where('sessionId', '==', sessionId)
        .orderBy('timestamp', 'asc')
        .get();

      const messages = snap.docs.map((d) => d.data());
      return res.json({
        session: { id: sessionId, title: sessionDoc.data().title },
        messages,
      });
    }

    const session = findDemoSession(uid, sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    res.json({
      session: { id: session.id, title: session.title },
      messages: session.messages,
    });
  } catch (err) {
    console.error('[session]', err);
    res.status(500).json({ error: 'Failed to load chat' });
  }
});

/** Legacy: flat message list (grouped into sessions on client if needed) */
router.get('/history', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const db = getDb();

    if (db && isAuthEnabled()) {
      const snap = await db
        .collection('chats')
        .where('userId', '==', uid)
        .orderBy('timestamp', 'desc')
        .limit(100)
        .get();
      const messages = snap.docs.map((d) => d.data()).reverse();
      return res.json({ messages });
    }

    const all = getDemoSessions(uid).flatMap((s) => s.messages);
    res.json({ messages: all.slice(-100) });
  } catch (err) {
    console.error('[history]', err);
    res.status(500).json({ error: 'Failed to load history' });
  }
});

module.exports = router;
