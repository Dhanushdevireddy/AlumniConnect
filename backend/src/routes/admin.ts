import { Router, Response } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import prisma from '../db/prismaClient';
import { verificationPipeline } from '../services/admin/VerificationPipeline';

const str = (v: unknown) => String(v);

const router = Router();

// GET /api/admin/verification-queue
router.get('/verification-queue', authenticate, authorize('admin'), async (_req: AuthRequest, res: Response) => {
  try {
    const records = await prisma.verificationRecord.findMany({
      where: { stage: { notIn: ['approved', 'rejected'] } },
      include: {
        alumniProfile: {
          include: { user: { select: { id: true, fullName: true, email: true, profilePhotoUrl: true } }, domainTags: true },
        },
      },
      orderBy: { submittedAt: 'asc' },
    });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed' });
  }
});

// PATCH /api/admin/verification/:id/advance
router.patch('/verification/:id/advance', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await verificationPipeline.handle({ recordId: str(req.params.id), adminUserId: req.user!.userId });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to advance' });
  }
});

// PATCH /api/admin/verification/:id/reject
router.patch('/verification/:id/reject', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { reason } = req.body;
    const record = await prisma.verificationRecord.findUnique({
      where: { id: str(req.params.id) },
      include: { alumniProfile: true },
    });
    if (!record) { res.status(404).json({ error: 'Record not found' }); return; }
    await prisma.verificationRecord.update({
      where: { id: str(req.params.id) },
      data: { stage: 'rejected', rejectionReason: reason, reviewedAt: new Date(), reviewedBy: req.user!.userId },
    });
    await prisma.alumniProfile.update({
      where: { id: str(record.alumniProfileId) },
      data: { verificationStatus: 'rejected' },
    });
    res.json({ message: 'Rejected', reason });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to reject' });
  }
});

// GET /api/admin/metrics
router.get('/metrics', authenticate, authorize('admin'), async (_req: AuthRequest, res: Response) => {
  try {
    const [
      totalUsers, totalAlumni, totalStudents, totalConnections, totalSessions,
      pendingRequests, flaggedConnections,
      sessionsByStatus,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'alumni' } }),
      prisma.user.count({ where: { role: 'student' } }),
      prisma.connection.count(),
      prisma.session.count({ where: { status: 'completed' } }),
      prisma.mentorshipRequest.count({ where: { status: 'pending' } }),
      prisma.connection.count({ where: { isFlagged: true } }),
      prisma.session.groupBy({ by: ['status'], _count: { status: true } }),
    ]);

    const activeMentorsByDomain = await prisma.domainTag.findMany({
      where: { status: 'active' },
      include: { _count: { select: { alumniProfiles: true } } },
    });

    res.json({
      totalUsers, totalAlumni, totalStudents, totalConnections,
      totalSessionsCompleted: totalSessions, pendingRequests, flaggedConnections,
      sessionsByStatus: sessionsByStatus.reduce((acc, s) => ({ ...acc, [s.status]: s._count.status }), {}),
      activeMentorsByDomain: activeMentorsByDomain.map(t => ({ tag: t.name, count: t._count.alumniProfiles })),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch metrics' });
  }
});

// GET /api/admin/flagged-connections
router.get('/flagged-connections', authenticate, authorize('admin'), async (_req: AuthRequest, res: Response) => {
  try {
    const connections = await prisma.connection.findMany({
      where: { isFlagged: true },
      include: {
        student: { select: { id: true, fullName: true, email: true } },
        alumni: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { healthScore: 'asc' },
    });
    res.json(connections);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed' });
  }
});

// GET /api/admin/domains
router.get('/domains', authenticate, authorize('admin'), async (_req: AuthRequest, res: Response) => {
  try {
    const domains = await prisma.domainTag.findMany({ include: { _count: { select: { alumniProfiles: true, studentProfiles: true } } }, orderBy: { name: 'asc' } });
    res.json(domains);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed' });
  }
});

// POST /api/admin/domains
router.post('/domains', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, parentTagId } = req.body;
    if (!name) { res.status(400).json({ error: 'name required' }); return; }
    const tag = await prisma.domainTag.create({ data: { name, parentTagId } });
    res.status(201).json(tag);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create domain' });
  }
});

// PATCH /api/admin/domains/:id
router.patch('/domains/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, status } = req.body;
    const tag = await prisma.domainTag.update({
      where: { id: str(req.params.id) },
      data: { ...(name && { name }), ...(status && { status }) },
    });
    res.json(tag);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update domain' });
  }
});

export default router;
