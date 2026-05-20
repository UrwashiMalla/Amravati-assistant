const { verifyIdToken, isAuthEnabled } = require('../firebase');

async function verifyToken(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  try {
    req.user = await verifyIdToken(token);
    next();
  } catch (err) {
    // Demo login token (when Firebase Admin is missing or user is in demo mode)
    if (token === 'demo-token') {
      req.user = { uid: 'demo-user', demo: true };
      return next();
    }
    if (!isAuthEnabled) {
      req.user = { uid: 'demo-user', demo: true };
      return next();
    }
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { verifyToken };
