import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import http from 'http';
import path from 'path';

// Routes
import authRoutes from './routes/auth';
import alumniRoutes from './routes/alumni';
import requestRoutes from './routes/requests';
import connectionRoutes from './routes/connections';
import sessionRoutes from './routes/sessions';
import notificationRoutes from './routes/notifications';
import adminRoutes from './routes/admin';

// WebSocket
import { setupWebSocket } from './websocket/WebSocketServer';

// Observer listeners (registers event handlers at startup)
import './events/RequestListeners';

// BullMQ workers
import './jobs/workers';

// Cron jobs
import { setupCronJobs } from './jobs/cronScheduler';

const app = express();
const server = http.createServer(app);

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow uploads to be served
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(morgan('tiny'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Static uploads ────────────────────────────────────────────────────────────
const uploadDir = process.env.UPLOAD_DIR || './uploads';
app.use('/uploads', express.static(path.resolve(uploadDir)));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/alumni', alumniRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/connections', connectionRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

// ── WebSocket ─────────────────────────────────────────────────────────────────
setupWebSocket(server);

// ── Cron ──────────────────────────────────────────────────────────────────────
setupCronJobs();

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║       AlumniConnect API Server       ║
║  Listening on http://localhost:${PORT}  ║
╚══════════════════════════════════════╝
  `);
});

export { app, server };
