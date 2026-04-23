import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate, AuthRequest, p } from '../middleware/auth';
import { mentorshipService } from '../services/mentorship/MentorshipFacade';
import { chatService } from '../services/chat/ChatService';

const router = Router();

const upload = multer({
  dest: process.env.UPLOAD_DIR || './uploads',
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      cb(new Error('Only PDF files are allowed'));
      return;
    }
    cb(null, true);
  },
});

// GET /api/connections
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const connections = await mentorshipService.listConnections(req.user!.userId);
    res.json(connections);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch connections' });
  }
});

// GET /api/connections/:id
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const conn = await mentorshipService.getConnection(p(req.params.id), req.user!.userId);
    res.json(conn);
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : 'Connection not found' });
  }
});

// GET /api/connections/:id/messages
router.get('/:id/messages', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const result = await chatService.getMessages(p(req.params.id), req.user!.userId, page, limit);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch messages' });
  }
});

// POST /api/connections/:id/messages (REST fallback)
router.post('/:id/messages', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { content } = req.body;
    if (!content) { res.status(400).json({ error: 'content required' }); return; }
    const message = await chatService.sendTextMessage(p(req.params.id), req.user!.userId, content);
    res.status(201).json(message);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to send message' });
  }
});

// POST /api/connections/:id/messages/upload — PDF upload
router.post('/:id/messages/upload', authenticate, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }
    const message = await chatService.saveFileMessage(
      p(req.params.id),
      req.user!.userId,
      req.file.path,
      req.file.originalname
    );
    res.status(201).json(message);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Upload failed' });
  }
});

// POST /api/connections/:id/sessions — Propose session
router.post('/:id/sessions', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { slotStart, slotEnd } = req.body;
    if (!slotStart || !slotEnd) { res.status(400).json({ error: 'slotStart and slotEnd required' }); return; }
    const session = await mentorshipService.proposeSession(
      p(req.params.id),
      req.user!.userId,
      new Date(slotStart),
      new Date(slotEnd)
    );
    res.status(201).json(session);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to propose session' });
  }
});

// GET /api/connections/:id/sessions
router.get('/:id/sessions', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const sessions = await mentorshipService.getSessionsForConnection(p(req.params.id));
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch sessions' });
  }
});

export default router;
