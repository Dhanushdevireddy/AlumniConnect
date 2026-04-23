import { Router, Response } from 'express';
import { authenticate, AuthRequest, p } from '../middleware/auth';
import { mentorshipService } from '../services/mentorship/MentorshipFacade';

const router = Router();

// PATCH /api/sessions/:id/confirm
router.patch('/:id/confirm', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const session = await mentorshipService.confirmSession(p(req.params.id), req.user!.userId);
    res.json(session);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to confirm session' });
  }
});

// PATCH /api/sessions/:id/cancel
router.patch('/:id/cancel', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const session = await mentorshipService.cancelSession(p(req.params.id), req.user!.userId);
    res.json(session);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to cancel session' });
  }
});

// PATCH /api/sessions/:id/attendance
router.patch('/:id/attendance', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { attended } = req.body;
    if (typeof attended !== 'boolean') { res.status(400).json({ error: 'attended (boolean) required' }); return; }
    const session = await mentorshipService.markAttendance(p(req.params.id), req.user!.userId, attended);
    res.json(session);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to mark attendance' });
  }
});

export default router;
