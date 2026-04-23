import { Router, Response } from 'express';
import { authenticate, AuthRequest, p } from '../middleware/auth';
import prisma from '../db/prismaClient';

const router = Router();

// GET /api/alumni — list with filters + ranked
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { domain, company, availability, search, page = '1', limit = '20' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: Record<string, unknown> = {
      verificationStatus: 'approved',
    };
    if (availability) where.availabilityStatus = availability;
    if (company) where.company = { contains: company, mode: 'insensitive' };
    if (search) {
      where.user = { fullName: { contains: search, mode: 'insensitive' } };
    }
    if (domain) {
      where.domainTags = { some: { name: { equals: domain, mode: 'insensitive' }, status: 'active' } };
    }

    let targetUniversity: string | null = null;
    if (req.user!.role === 'student') {
      const sp = await prisma.studentProfile.findUnique({ where: { userId: req.user!.userId }, select: { university: true } });
      targetUniversity = sp?.university || null;
    } else if (req.user!.role === 'alumni') {
      const ap = await prisma.alumniProfile.findUnique({ where: { userId: req.user!.userId }, select: { university: true } });
      targetUniversity = ap?.university || null;
    }
    
    if (targetUniversity) {
      where.university = targetUniversity;
    }

    const [profiles, total] = await Promise.all([
      prisma.alumniProfile.findMany({
        where,
        include: {
          user: { select: { id: true, fullName: true, profilePhotoUrl: true, email: true } },
          domainTags: { where: { status: 'active' } },
        },
        orderBy: { rankingScore: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.alumniProfile.count({ where }),
    ]);

    res.json({ data: profiles, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch alumni' });
  }
});

// GET /api/alumni/:id
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const profile = await prisma.alumniProfile.findUnique({
      where: { userId: p(req.params.id) },
      include: {
        user: { select: { id: true, fullName: true, email: true, profilePhotoUrl: true } },
        domainTags: true,
      },
    });
    if (!profile || profile.verificationStatus !== 'approved') {
      res.status(404).json({ error: 'Alumni not found' }); return;
    }
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch alumni' });
  }
});

// PATCH /api/alumni/profile — update own alumni profile
router.patch('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user!.role !== 'alumni') { res.status(403).json({ error: 'Alumni only' }); return; }
    const { bio, company, jobTitle, experienceYears, linkedinUrl, availabilityStatus, documentUrl, tagIds } = req.body;

    const updated = await prisma.alumniProfile.update({
      where: { userId: req.user!.userId },
      data: {
        ...(bio !== undefined && { bio }),
        ...(company !== undefined && { company }),
        ...(jobTitle !== undefined && { jobTitle }),
        ...(experienceYears !== undefined && { experienceYears }),
        ...(linkedinUrl !== undefined && { linkedinUrl }),
        ...(availabilityStatus !== undefined && { availabilityStatus }),
        ...(documentUrl !== undefined && { documentUrl }),
        ...(tagIds !== undefined && { domainTags: { set: tagIds.map((id: string) => ({ id })) } }),
      },
    });

    // Recompute ranking score after profile update
    const { rankingScoreEngine } = await import('../services/alumni/RankingScoreEngine');
    await rankingScoreEngine.recompute(req.user!.userId);

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Update failed' });
  }
});

// GET /api/alumni/me/profile — get own profile
router.get('/me/profile', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user!.role === 'alumni') {
      const profile = await prisma.alumniProfile.findUnique({
        where: { userId: req.user!.userId },
        include: { user: true, domainTags: true },
      });
      res.json(profile);
    } else {
      const profile = await prisma.studentProfile.findUnique({
        where: { userId: req.user!.userId },
        include: { user: true, interestTags: true },
      });
      res.json(profile);
    }
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed' });
  }
});

export default router;
