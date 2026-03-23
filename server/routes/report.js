import { Router } from 'express';
import { getSession } from '../sessionStore.js';

const router = Router({ mergeParams: true });

// Generate the audit report for a session
router.get('/:id/report', async (req, res) => {
  const sess = await getSession(req.params.id);
  if (!sess) return res.status(404).json({ error: 'Session not found' });

  // If location filters are set, only report on those locations
  const inScope = (game) =>
    sess.filters?.locations?.length
      ? sess.filters.locations.includes(game.location)
      : true;

  const all = sess.games.filter(inScope);
  const found = all.filter(g => g.found && g.origin !== 'new');
  const missing = all.filter(g => !g.found && g.origin !== 'new');
  const newGames = all.filter(g => g.origin === 'new');

  res.json({
    counts: {
      all: all.length,
      found: found.length,
      missing: missing.length,
      new: newGames.length
    },
    found,
    missing,
    new: newGames
  });
});

export default router;