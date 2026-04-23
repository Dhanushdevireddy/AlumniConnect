import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import prisma from '../db/prismaClient';

const router = Router();

// GET /api/notifications  — returns ALL notifications (read + unread)
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const notifications = await prisma.notificationEvent.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch notifications' });
  }
});

// PATCH /api/notifications/preferences
router.patch('/preferences', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { cadence } = req.body;
    if (!['daily', 'weekly'].includes(cadence)) {
      res.status(400).json({ error: 'cadence must be daily or weekly' }); return;
    }
    const pref = await prisma.digestPreference.upsert({
      where: { userId: req.user!.userId },
      update: { cadence },
      create: { userId: req.user!.userId, cadence },
    });
    res.json(pref);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update preferences' });
  }
});

// PATCH /api/notifications/mark-all-read  — marks all as read but keeps them visible
router.patch('/mark-all-read', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.notificationEvent.updateMany({
      where: { userId: req.user!.userId, isDigested: false },
      data: { isDigested: true },
    });
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed' });
  }
});

// PATCH /api/notifications/:id/toggle  — flip a single notification read/unread
router.patch('/:id/toggle', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const notif = await prisma.notificationEvent.findUnique({ where: { id: req.params.id as string } });
    if (!notif) { res.status(404).json({ error: 'Notification not found' }); return; }
    if (notif.userId !== req.user!.userId) { res.status(403).json({ error: 'Forbidden' }); return; }

    const updated = await prisma.notificationEvent.update({
      where: { id: req.params.id as string },
      data: { isDigested: !notif.isDigested },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to toggle notification' });
  }
});

export default router;

