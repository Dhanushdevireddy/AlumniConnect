import { Router, Response } from 'express';
import { authenticate, authorize, AuthRequest, p } from '../middleware/auth';
import { mentorshipService } from '../services/mentorship/MentorshipFacade';

const router = Router();

// POST /api/requests
router.post('/', authenticate, authorize('student'), async (req: AuthRequest, res: Response) => {
  try {
    const { alumniId, message, goals } = req.body;
    if (!alumniId || !message) { res.status(400).json({ error: 'alumniId and message required' }); return; }
    const request = await mentorshipService.submitRequest(req.user!.userId, alumniId, message, goals);
    res.status(201).json(request);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to submit request' });
  }
});

// GET /api/requests
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const requests = await mentorshipService.listRequests(req.user!.userId, req.user!.role);
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch requests' });
  }
});

// GET /api/requests/:id
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const request = await mentorshipService.getRequest(p(req.params.id), req.user!.userId);
    res.json(request);
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : 'Request not found' });
  }
});

// PATCH /api/requests/:id/accept
router.patch('/:id/accept', authenticate, authorize('alumni'), async (req: AuthRequest, res: Response) => {
  try {
    const connection = await mentorshipService.acceptRequest(p(req.params.id), req.user!.userId);
    res.json(connection);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to accept request' });
  }
});

// PATCH /api/requests/:id/decline
router.patch('/:id/decline', authenticate, authorize('alumni'), async (req: AuthRequest, res: Response) => {
  try {
    const request = await mentorshipService.declineRequest(p(req.params.id), req.user!.userId);
    res.json(request);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to decline request' });
  }
});

// PATCH /api/requests/:id/withdraw
router.patch('/:id/withdraw', authenticate, authorize('student'), async (req: AuthRequest, res: Response) => {
  try {
    const request = await mentorshipService.withdrawRequest(p(req.params.id), req.user!.userId);
    res.json(request);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to withdraw request' });
  }
});

export default router;
