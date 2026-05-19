const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const { initFirebase } = require('./firebase');
const chatRoutes = require('./routes/chat');
const placesRoutes = require('./routes/places');
const { GEMINI_API_KEY, GEOAPIFY_API_KEY, PORT: ENV_PORT, CLIENT_URL: ENV_CLIENT_URL } =
  require('./config/env');

initFirebase();

const app = express();
const PORT = Number(ENV_PORT) || 3000;
const CLIENT_URL = ENV_CLIENT_URL || `http://localhost:${PORT}`;

app.use(
  cors({
    origin: [CLIENT_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
  })
);
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/chat', chatRoutes);
app.use('/api/places', placesRoutes);

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'amravati-assistant',
    apis: {
      gemini: Boolean(GEMINI_API_KEY),
      geoapify: Boolean(GEOAPIFY_API_KEY),
    },
  });
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  const file = path.join(__dirname, '..', 'public', req.path === '/' ? 'index.html' : req.path);
  res.sendFile(file, (err) => {
    if (err) res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });
});

app.listen(PORT, () => {
  console.log(`Amravati Assistant running at ${CLIENT_URL}`);
  console.log(
    `[API keys] Gemini: ${GEMINI_API_KEY ? 'loaded' : 'MISSING'} | Geoapify: ${GEOAPIFY_API_KEY ? 'loaded' : 'MISSING'}`
  );
});
