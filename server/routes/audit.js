import { Router } from 'express';
import { getSession, saveSession } from '../sessionStore.js';

const router = Router({ mergeParams: true });

// Mark a session as actively auditing, with optional location filters
router.post('/:id/start', async (req, res) => {
  const { locations = [] } = req.body || {};
  const sess = await getSession(req.params.id);
  if (!sess) return res.status(404).json({ error: 'Session not found' });

  sess.filters = { locations: Array.isArray(locations) ? locations : [] };
  sess.status = 'auditing';

  await saveSession(sess.id, sess);
  res.json({ ok: true });
});

// Toggle a game between found and not found
router.post('/:id/toggleFound', async (req, res) => {
  const { gameId } = req.body || {};
  const sess = await getSession(req.params.id);
  if (!sess) return res.status(404).json({ error: 'Session not found' });

  const game = sess.games.find(g => g.id === String(gameId));
  if (!game) return res.status(404).json({ error: 'Game not found' });

  game.found = !game.found;

  await saveSession(sess.id, sess);
  res.json({ ok: true, found: game.found });
});

// Add a new game found on the shelf that isn't in BGG yet
router.post('/:id/addGame', async (req, res) => {
  const { name, location = '' } = req.body || {};
  const sess = await getSession(req.params.id);
  if (!sess) return res.status(404).json({ error: 'Session not found' });

  const newGame = {
    id: `new-${crypto.randomUUID()}`,
    name: String(name || '').trim(),
    location: String(location || '').trim().toUpperCase(),
    origin: 'new',
    found: true
  };

  sess.games.push(newGame);

  await saveSession(sess.id, sess);
  res.json({ ok: true, game: newGame });
});

// Mark a session as complete
router.post('/:id/complete', async (req, res) => {
  const sess = await getSession(req.params.id);
  if (!sess) return res.status(404).json({ error: 'Session not found' });

  sess.status = 'complete';

  await saveSession(sess.id, sess);
  res.json({ ok: true });
});

export default router;