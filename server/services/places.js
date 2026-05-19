const fs = require('fs');
const path = require('path');
const { enrichPlaces } = require('./geocode');
const { searchPlacesGeoapify } = require('./geoapify');
const { GEOAPIFY_API_KEY, GOOGLE_MAPS_API_KEY } = require('../config/env');

const localPlaces = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data', 'places.json'), 'utf8')
);

// Language-specific search mappings for quick search categories
const LANGUAGE_SEARCH_MAP = {
  hi: {
    'अस्पताल': 'hospital',
    'कैफे': 'cafe',
    'शाकाहारी रेस्तरां': 'restaurant vegetarian',
    'पर्यटन स्थल': 'tourist',
    'होटल': 'hotel',
  },
  mr: {
    'रुग्णालये': 'hospital',
    'कॅफे': 'cafe',
    'शाकाहारी रेस्तरां': 'restaurant vegetarian',
    'पर्यटन स्थळे': 'tourist',
    'हॉटेल्स': 'hotel',
  },
};

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'is', 'are',
  'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can',
  'about', 'tell', 'me', 'show', 'find', 'where', 'what', 'which', 'how', 'when',
  'why', 'near', 'best', 'good', 'please', 'want', 'know', 'amravati', 'city',
  'place', 'places', 'visit', 'going', 'go', 'there', 'this', 'that', 'with',
  'क्या', 'मुझे', 'बताओ', 'कहाँ', 'में', 'के', 'की', 'का', 'है', 'हैं', 'और',
  'कैसे', 'कौन', 'अमरावती', 'स्थान', 'जगह', 'दिखाएं', 'खोजें', 'पूछें',
  'काय', 'कुठे', 'मला', 'सांग', 'मध्ये', 'आहे', 'आणि', 'ठिकाण', 'दाखवा', 'शोधा', 'विचारा', 'अमरावतीत', 'अमरावतीतील',
]);

function extractKeywords(query, language = 'en') {
  // Check for language-specific mappings first (for quick search categories)
  if (language === 'hi' || language === 'mr') {
    const map = LANGUAGE_SEARCH_MAP[language] || {};
    for (const [phrase, replacement] of Object.entries(map)) {
      if (query.includes(phrase)) {
        return replacement.split(/\s+/).filter(w => w.length > 0);
      }
    }
  }

  return (query || '')
    .toLowerCase()
    .replace(/[^\w\s\u0900-\u097F]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function scorePlace(place, keywords) {
  if (!keywords.length) return 0;
  const haystack = `${place.name} ${place.address}`.toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (haystack.includes(kw)) score += kw.length >= 5 ? 3 : 2;
  }
  return score;
}

async function searchGooglePlaces(keywords) {
  const apiKey = GOOGLE_MAPS_API_KEY;
  if (!apiKey || !keywords.length) return [];

  try {
    const searchQuery = keywords.join(' ') + ' Amravati Maharashtra';
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
      searchQuery
    )}&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.results?.length) return [];

    return data.results.slice(0, 5).map((p) => ({
      name: p.name,
      rating: p.rating || null,
      reviews: p.user_ratings_total || 0,
      address: p.formatted_address,
      lat: p.geometry?.location?.lat,
      lng: p.geometry?.location?.lng,
    }));
  } catch (err) {
    console.warn('[Google Places]', err.message);
    return [];
  }
}

async function searchPlaces(query, language = 'en') {
  const keywords = extractKeywords(query, language);
  let results = localPlaces
    .map((p) => ({ place: p, score: scorePlace(p, keywords) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.place);

  if (keywords.length > 0) {
    if (GEOAPIFY_API_KEY) {
      const geoResults = await searchPlacesGeoapify(keywords.join(' '));
      if (geoResults.length) {
        const names = new Set(results.map((r) => r.name.toLowerCase()));
        geoResults.forEach((r) => {
          if (!names.has(r.name.toLowerCase())) {
            results.push(r);
            names.add(r.name.toLowerCase());
          }
        });
      }
    } else {
      const googleResults = await searchGooglePlaces(keywords);
      if (googleResults.length) {
        const names = new Set(results.map((r) => r.name.toLowerCase()));
        results = [
          ...googleResults,
          ...results.filter((r) => !names.has(r.name.toLowerCase())),
        ];
      }
    }
  }

  return enrichPlaces(results.slice(0, 6));
}

module.exports = { searchPlaces, extractKeywords };
