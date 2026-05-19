const express = require('express');
const { verifyToken } = require('../middleware/verifyToken');
const { searchPlaces } = require('../services/places');

const router = express.Router();

router.get('/search', verifyToken, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.status(400).json({ error: 'Query parameter q is required' });
    const places = await searchPlaces(q);
    res.json({ places });
  } catch (err) {
    console.error('[places/search]', err);
    res.status(500).json({ error: 'Failed to search places' });
  }
});

module.exports = router;
