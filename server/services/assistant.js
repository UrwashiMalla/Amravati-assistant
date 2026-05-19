const { searchPlaces, extractKeywords } = require('./places');
const { searchEvents } = require('./events');
const { enrichPlace } = require('./geocode');
const { GEMINI_API_KEY } = require('../config/env');

const LANG_LABELS = { en: 'English', hi: 'Hindi', mr: 'Marathi' };

function detectIntent(message) {
  const m = message.toLowerCase().trim();

  if (/^(hi|hello|hey|namaste|नमस्ते|नमस्कार)\b/i.test(m)) return 'greeting';
  if (/help|मदत|मदत|what can you|क्या कर सकते|काय करू शकता/i.test(m)) return 'help';
  if (/event|festival|fair|program|happening|कार्यक्रम|उत्सव|मेला|सण/i.test(m)) return 'events';
  if (
    /temple|mandir|park|hotel|restaurant|museum|lake|hill|station|tourist|visit|place|places|घूम|भ्रमण|मंदिर|स्थळ|ठिकाण|हॉटेल|पार्क/i.test(m)
  ) {
    return 'places';
  }

  const keywords = extractKeywords(message);
  if (keywords.length >= 1) return 'search';
  return 'unknown';
}

function formatPlaces(places, lang, query) {
  if (!places.length) {
    const empty = {
      en: `I couldn't find a place matching "${query}" in Amravati. Try: Amba Devi Temple, Chikhaldara, Melghat, or Wadali Tank.`,
      hi: `"${query}" से मेल खाता कोई स्थान नहीं मिला। आज़माएं: अंबा देवी मंदिर, चिखलदरा, मेघाट।`,
      mr: `"${query}" शी जुळणारे ठिकाण सापडले नाही. प्रयत्न करा: अंबा देवी मंदिर, चिखलदरा, मेघाट.`,
    };
    return empty[lang] || empty.en;
  }

  const list = places
    .map((p, i) => {
      const stars = p.rating ? `⭐ ${p.rating}/5 (${p.reviews} reviews)` : '';
      const mapLine = p.osmUrl
        ? `   🗺️ [OpenStreetMap](${p.osmUrl})`
        : '';
      return `${i + 1}. **${p.name}**\n   ${stars}\n   📍 ${p.address}${mapLine}`;
    })
    .join('\n\n');

  return list + getSpecialSuggestions(places, lang);
}

function formatEvents(events, lang, query) {
  if (!events.length) {
    const empty = {
      en: `No upcoming events found for "${query}". Ask for cultural, sports, or education events in Amravati.`,
      hi: `"${query}" के लिए कोई आगामी कार्यक्रम नहीं मिला।`,
      mr: `"${query}" साठी कोणतेही आगामी कार्यक्रम सापडले नाहीत.`,
    };
    return empty[lang] || empty.en;
  }

  const list = events
    .map((e, i) => {
      const mapLine = e.osmUrl ? `\n   🗺️ [OpenStreetMap](${e.osmUrl})` : '';
      return `${i + 1}. **${e.title}** (${e.field})\n   📅 ${e.date} | 📍 ${e.venue}\n   ${e.description}${mapLine}`;
    })
    .join('\n\n');

  return list + getEventSuggestions(events, lang);
}

function getSpecialSuggestions(places, lang) {
  if (!places.length) return '';

  const suggestions = {
    en: `\n\n**💡 Suggestions:**\n- Would you like directions to any of these places?\n- Interested in ratings and reviews?\n- Need parking or facilities information?`,
    hi: `\n\n**💡 सुझाव:**\n- क्या आप इनमें से किसी भी जगह के लिए दिशा चाहते हैं?\n- रेटिंग और समीक्षाओं में रुचि है?\n- पार्किंग या सुविधाओं की जानकारी चाहिए?`,
    mr: `\n\n**💡 सूचना:**\n- आपल्या या कोठहीपैकी कोणत्याही ठिकाणासाठी दिशानिर्देश हवेत का?\n- रेटिंग आणि पुनरावलोकनांमध्ये रुचि आहे का?\n- पार्किंग किंवा सुविधांची माहिती आवश्यक आहे का?`,
  };

  return suggestions[lang] || suggestions.en;
}

function getEventSuggestions(events, lang) {
  if (!events.length) return '';

  const suggestions = {
    en: `\n\n**💡 Event Suggestions:**\n- Mark your calendar for these events!\n- Want to know more details or book tickets?\n- Looking for similar events in other categories?`,
    hi: `\n\n**💡 कार्यक्रम सुझाव:**\n- इन कार्यक्रमों के लिए अपना कैलेंडर चिह्नित करें!\n- अधिक विवरण जानना या टिकट बुक करना चाहते हैं?\n- अन्य श्रेणियों में समान कार्यक्रम ढूंढ रहे हैं?`,
    mr: `\n\n**💡 इव्हेंट सूचना:**\n- या इव्हेंटसाठी आपल्या कॅलेंडरमध्ये खूण करा!\n- अधिक तपशील जाणून घेऊ किंवा तिकिटे बुक करू इच्छिता?\n- इतर श्रेणींमध्ये समान कार्यक्रम शोधत आहात का?`,
  };

  return suggestions[lang] || suggestions.en;
}

function helpMessage(lang, name) {
  const msgs = {
    en: `I'm **${name}**, your Amravati guide. You can ask:\n• **Places** — "Amba Devi Temple", "Chikhaldara", "hotels near me"\n• **Events** — "cultural events", "cricket in Amravati"\n• Maps use **OpenStreetMap** with interactive markers.`,
    hi: `मैं **${name}** हूँ। पूछ सकते हैं:\n• **स्थान** — "अंबा देवी मंदिर", "चिखलदरा"\n• **कार्यक्रम** — "सांस्कृतिक कार्यक्रम"\n• नक्शे **OpenStreetMap** पर दिखते हैं।`,
    mr: `मी **${name}** आहे. विचारू शकता:\n• **ठिकाणे** — "अंबा देवी मंदिर", "चिखलदरा"\n• **कार्यक्रम** — "सांस्कृतिक कार्यक्रम"\n• नकाशे **OpenStreetMap** वर दिसतात.`,
  };
  return msgs[lang] || msgs.en;
}

const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-latest'];

async function callGemini(prompt, language) {
  const apiKey = GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[Gemini] GEMINI_API_KEY is not set in .env');
    return null;
  }

  const body = {
    contents: [
      {
        parts: [
          {
            text: `You are a friendly Amravati city assistant. Reply in ${LANG_LABELS[language] || 'English'} only. Use ONLY the provided data. Do not invent places or events. Be concise.\n\n${prompt}`,
          },
        ],
      },
    ],
  };

  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          console.log(`[Gemini] OK (${model})`);
          return text;
        }
      }

      console.warn(
        `[Gemini] ${model} failed:`,
        res.status,
        data.error?.message || JSON.stringify(data).slice(0, 300)
      );
    } catch (err) {
      console.warn(`[Gemini] ${model} error:`, err.message);
    }
  }

  return null;
}

async function enrichEventsForMap(events) {
  const out = [];
  for (const e of events.slice(0, 5)) {
    if (e.lat != null && e.lng != null) {
      out.push(e);
      continue;
    }
    const enriched = await enrichPlace({
      name: e.venue,
      address: `${e.venue}, Amravati, Maharashtra`,
    });
    out.push({
      ...e,
      lat: enriched.lat,
      lng: enriched.lng,
      osmUrl: enriched.osmUrl,
      name: e.title,
      address: e.venue,
    });
    await new Promise((r) => setTimeout(r, 250));
  }
  return out;
}

async function buildReply({ message, language, assistantName, userName }) {
  const lang = ['en', 'hi', 'mr'].includes(language) ? language : 'en';
  const name = assistantName || 'Sahayak';
  const intent = detectIntent(message);
  const query = message.trim();
  let places = [];
  let mapMarkers = [];

  if (intent === 'greeting') {
    const greetings = {
      en: `Namaste${userName ? ', ' + userName : ''}! I'm **${name}**, your Amravati guide. Ask about a **place** (e.g. Chikhaldara) or **events** in the city.`,
      hi: `नमस्ते${userName ? ', ' + userName : ''}! मैं **${name}** हूँ। कोई **स्थान** या **कार्यक्रम** पूछें।`,
      mr: `नमस्कार${userName ? ', ' + userName : ''}! मी **${name}** आहे. **ठिकाण** किंवा **कार्यक्रम** विचारा.`,
    };
    return { reply: greetings[lang], places: [], mapMarkers: [] };
  }

  if (intent === 'help') {
    return { reply: helpMessage(lang, name), places: [], mapMarkers: [] };
  }

  let heading = '';
  let context = '';

  if (intent === 'events') {
    const events = await searchEvents(query, lang);
    const enriched = await enrichEventsForMap(events);
    context = formatEvents(enriched, lang, query);
    mapMarkers = enriched.filter((e) => e.lat != null && e.lng != null);
    heading = {
      en: `Here are events in Amravati related to your question:`,
      hi: `आपके प्रश्न से जुड़े अमरावती के कार्यक्रम:`,
      mr: `तुमच्या प्रश्नाशी संबंधित अमरावतीतील कार्यक्रम:`,
    }[lang];
  } else if (intent === 'places' || intent === 'search') {
    places = await searchPlaces(query, lang);
    context = formatPlaces(places, lang, query);
    mapMarkers = places.filter((p) => p.lat != null && p.lng != null);
    heading = {
      en: places.length
        ? `Here's what I found for "${query}":`
        : `Search results for "${query}":`,
      hi: `"${query}" के लिए परिणाम:`,
      mr: `"${query}" साठी परिणाम:`,
    }[lang];
  } else {
    const unknown = {
      en: `I specialize in **Amravati places and events** only. I can't answer "${query}" directly. Try asking about Amba Devi Temple, Chikhaldara, Melghat, or upcoming festivals.`,
      hi: `मैं केवल **अमरावती के स्थान और कार्यक्रम** में मदद करता हूँ। "${query}" के लिए अंबा देवी मंदिर, चिखलदरा या कार्यक्रम पूछें।`,
      mr: `मी फक्त **अमरावतीतील ठिकाणे आणि कार्यक्रम** सांगू शकतो. "${query}" ऐवजी अंबा देवी मंदिर, चिखलदरा किंवा उत्सव विचारा.`,
    };
    return { reply: unknown[lang], places: [], mapMarkers: [] };
  }

  const prompt = `User asked: ${query}\n\nData:\n${context}`;
  const aiReply = await callGemini(prompt, lang);
  const reply = aiReply || `${heading}\n\n${context}`;

  return { reply, places, mapMarkers };
}

module.exports = { buildReply, detectIntent };
