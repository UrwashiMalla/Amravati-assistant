# Amravati Sahayak

Personal assistant website for people in **Amravati** — places with ratings and Google Maps links, local events, multilingual chat (Hindi, English, Marathi), text and voice input.

## Stack

- **Frontend:** HTML, CSS, JavaScript (ES modules)
- **Backend:** Node.js + Express
- **Database / Auth:** Firebase (Firestore + Authentication)

## Quick start (demo mode)

Works without Firebase — uses local demo auth and bundled place/event data.

```bash
cd C:\Users\user\projects\amravati-assistant
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000)

1. **Login** — any email/password (min 6 chars) or Google button (demo)
2. **Name assistant** — or Skip
3. **Chat** — try: `Amba Devi Temple`, `events in Amravati`, `Chikhaldara`

## Firebase setup

1. Create a project at [Firebase Console](https://console.firebase.google.com)
2. Enable **Authentication** → Email/Password and **Google**
3. Create **Firestore** database
4. Copy web config into `public/js/firebase-config.js`
5. Download service account JSON → save as `firebase-service-account.json` in project root
6. Deploy rules: `firebase deploy --only firestore:rules` (optional)

## Optional APIs

Copy `.env.example` to `.env`:

| Variable | Purpose |
|----------|---------|
| `GOOGLE_MAPS_API_KEY` | Live Places search for Amravati |
| `GEMINI_API_KEY` | Smarter AI replies (otherwise rule-based) |

## Pages

| Page | URL |
|------|-----|
| Login | `/index.html` |
| Assistant setup | `/assistant-setup.html` |
| Chat | `/chat.html` |

Language switcher (English / हिंदी / मराठी) appears on every page.

## Features

- Login with username, email, password or Google
- Name or skip naming your assistant
- Chat about Amravati places (ratings, reviews, Maps links)
- Upcoming events (cultural, sports, education, etc.)
- Text + microphone input, optional voice replies
- Chat history sidebar
- Settings: change assistant name, username, logout

## Project structure

```
amravati-assistant/
├── public/           # Static frontend
├── server/           # Express API + services
├── firestore.rules
└── package.json
```
