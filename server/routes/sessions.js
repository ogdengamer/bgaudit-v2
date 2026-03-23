import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { saveSession, getSession, deleteSession } from '../sessionStore.js';

const router = Router();

// Create a new audit session
router.post('/', async (req, res) => {
  const id = uuid();
  const now = new Date().toISOString();

  const session = {
    id,
    createdAt: now,
    status: 'setup',
    source: null,
    filters: { locations: [] },
    games: []
  };

  await saveSession(id, session);

  const base = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 4000}`;
  res.json({ id, resumeUrl: `${base}/s/${id}` });
});

// Get an existing session by ID
router.get('/:id', async (req, res) => {
  const sess = await getSession(req.params.id);
  if (!sess) return res.status(404).json({ error: 'Session not found' });
  res.json(sess);
});

// Delete a session
router.delete('/:id', async (req, res) => {
  await deleteSession(req.params.id);
  res.json({ ok: true });
});

export default router;