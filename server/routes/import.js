import { Router } from 'express';
import { getSession, saveSession } from '../sessionStore.js';
import { fetchBGGCollection } from '../util/bgg.js';

const router = Router({ mergeParams: true });

// Helper to normalize any game object into our standard shape
function normalizeGame(g) {
  return {
    id: String(g.id ?? g.objectid ?? crypto.randomUUID()),
    name: String(g.name ?? g.objectname ?? '').trim(),
    location: String(g.location ?? g.invlocation ?? '').trim().toUpperCase(),
    origin: 'bgg',
    found: false
  };
}

// Import games from a CSV upload
router.post('/:id/import/csv', async (req, res) => {
  const { games } = req.body || {};
  const sess = await getSession(req.params.id);
  if (!sess) return res.status(404).json({ error: 'Session not found' });
  if (!Array.isArray(games)) return res.status(400).json({ error: 'games[] required' });

  const normalized = games.map(g => ({ ...normalizeGame(g), origin: 'csv' }));

  sess.source = 'csv';
  sess.games = normalized;

  await saveSession(sess.id, sess);

  const locations = getUniqueLocations(normalized);
  res.json({ ok: true, locations });
});

// Import games directly from the BGG API
router.post('/:id/import/bgg', async (req, res) => {
  const { username, password } = req.body || {};
  const sess = await getSession(req.params.id);
  if (!sess) return res.status(404).json({ error: 'Session not found' });
  if (!username) return res.status(400).json({ error: 'username required' });

  try {
    const rawGames = await fetchBGGCollection(username, password);
    const normalized = rawGames.map(normalizeGame);

    sess.source = 'bgg';
    sess.games = normalized;

    await saveSession(sess.id, sess);

    const locations = getUniqueLocations(normalized);
    res.json({ ok: true, locations });
  } catch (err) {
    const status = err.code === 501 ? 501 : 500;
    res.status(status).json({ error: err.message || 'BGG import failed' });
  }
});

// Get a sorted list of unique locations from a game list
function getUniqueLocations(games) {
  return Array.from(new Set(games.map(g => g.location).filter(Boolean))).sort();
}

export default router;