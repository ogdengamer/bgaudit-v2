import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import sessionRoutes from './routes/sessions.js';
import importRoutes from './routes/import.js';
import auditRoutes from './routes/audit.js';
import reportRoutes from './routes/report.js';

dotenv.config();

const app = express();

// In ES modules, __dirname doesn't exist by default — this recreates it
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve the web/ folder as static files
app.use(express.static(path.join(__dirname, '../web')));

app.use(express.json({ limit: '5mb' }));
app.use(cors());

// API routes
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/session', sessionRoutes);
app.use('/api/session', importRoutes);
app.use('/api/session', auditRoutes);
app.use('/api/session', reportRoutes);

// For any non-API route, serve index.html so our frontend can handle routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../web/index.html'));
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`BGAudit server running at http://localhost:${port}`));