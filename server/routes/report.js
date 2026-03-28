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

router.get('/:id/report/csv', async (req, res) => {
  const sess = await getSession(req.params.id);
  if (!sess) return res.status(404).json({ error: 'Session not found' });

  const inScope = (game) =>
    sess.filters?.locations?.length
      ? sess.filters.locations.includes(game.location)
      : true;

  const all = sess.games.filter(inScope);

  const rows = all.map(g => {
    let status;
    if (g.origin === 'new') {
      status = 'new';
    } else if (g.found) {
      status = 'found';
    } else {
      status = 'missing';
    }
    return { id: g.id, name: g.name, location: g.location, status };
  });

  // Sort by status then name
  rows.sort((a, b) => {
    if (a.status !== b.status) return a.status.localeCompare(b.status);
    return a.name.localeCompare(b.name);
  });

  const escape = (v) => `"${String(v || '').replaceAll('"', '""')}"`;
  const header = 'id,name,location,status';
  const csv = [header, ...rows.map(r =>
    [r.id, r.name, r.location, r.status].map(escape).join(',')
  )].join('\n');

  // Send as a downloadable file
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="bgaudit-report.csv"');
  res.send(csv);
});

export default router;