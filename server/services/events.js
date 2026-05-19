const fs = require('fs');
const path = require('path');
const { getDb } = require('../firebase');

const localEvents = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data', 'events.json'), 'utf8')
);

const FIELD_ALIASES = {
  cultural: ['cultural', 'culture', 'music', 'art', 'महोत्सव', 'सांस्कृतिक', 'संगीत', 'कला'],
  sports: ['sports', 'sport', 'cricket', 'football', 'खेल', 'क्रिकेट', 'फुटबॉल'],
  education: ['education', 'science', 'school', 'university', 'शिक्षा', 'विज्ञान', 'स्कूल'],
  religious: ['religious', 'temple', 'fair', 'धार्मिक', 'मेला', 'मंदिर'],
  agriculture: ['agriculture', 'farmer', 'market', 'कृषि', 'किसान', 'बाजार'],
};

const LANGUAGE_EVENT_MAP = {
  'सांस्कृतिक': 'cultural',
  'संगीत': 'cultural',
  'कला': 'cultural',
  'खेल': 'sports',
  'क्रिकेट': 'sports',
  'फुटबॉल': 'sports',
  'शिक्षा': 'education',
  'विज्ञान': 'education',
  'स्कूल': 'education',
  'धार्मिक': 'religious',
  'मेला': 'religious',
  'मंदिर': 'religious',
  'कृषि': 'agriculture',
  'किसान': 'agriculture',
  'बाजार': 'agriculture',
};

function extractFieldFilter(query, lang = 'en') {
  const q = (query || '').toLowerCase();

  if (lang !== 'en') {
    for (const [nonEn, en] of Object.entries(LANGUAGE_EVENT_MAP)) {
      if (q.includes(nonEn.toLowerCase())) return en;
    }
  }

  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.some((a) => q.includes(a.toLowerCase()))) return field;
  }
  return null;
}

function scoreEvent(event, keywords) {
  if (!keywords.length) return 0;
  const haystack = `${event.title} ${event.description} ${event.venue} ${event.field}`.toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (haystack.includes(kw)) score += 2;
  }
  return score;
}

async function loadAllEvents() {
  const today = new Date().toISOString().slice(0, 10);
  let events = localEvents.filter((e) => e.date >= today);

  const db = getDb();
  if (db) {
    try {
      const snap = await db.collection('events').where('date', '>=', today).get();
      if (!snap.empty) {
        const firestoreEvents = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const titles = new Set(events.map((e) => e.title));
        firestoreEvents.forEach((e) => {
          if (!titles.has(e.title)) events.push(e);
        });
      }
    } catch (err) {
      console.warn('[Firestore events]', err.message);
    }
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}

async function getEvents(fieldFilter) {
  let events = await loadAllEvents();
  if (fieldFilter) {
    const f = fieldFilter.toLowerCase();
    events = events.filter((e) => e.field.toLowerCase().includes(f));
  }
  return events;
}

async function searchEvents(query, lang = 'en') {
  const { extractKeywords } = require('./places');
  const keywords = extractKeywords(query, lang);
  const fieldFilter = extractFieldFilter(query, lang);
  let events = await loadAllEvents();

  if (fieldFilter) {
    events = events.filter((e) => e.field.toLowerCase() === fieldFilter);
  }

  if (keywords.length) {
    const scored = events
      .map((e) => ({ event: e, score: scoreEvent(e, keywords) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    if (scored.length) return scored.map((x) => x.event);
  }

  if (/event|festival|fair|program|happening|कार्यक्रम|उत्सव|कार्यक्रम/i.test(query || '')) {
    return fieldFilter ? events : events.slice(0, 5);
  }

  return [];
}

module.exports = { getEvents, searchEvents, extractFieldFilter };

