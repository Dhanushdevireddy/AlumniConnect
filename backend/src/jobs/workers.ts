import { Worker } from 'bullmq';
import prisma from '../db/prismaClient';
import redis from '../db/redisClient';
import { emailService } from '../services/email/EmailService';
import { healthScoreService } from '../services/health/HealthScoreService';
import { rankingScoreEngine } from '../services/alumni/RankingScoreEngine';

const connection = { host: redis.options.host || 'localhost', port: redis.options.port || 6379 };

// ── Session reminder worker ──────────────────────────────────────────────────
new Worker('session-jobs', async (job) => {
  const { sessionId, studentId, alumniId } = job.data;
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session || session.status !== 'confirmed') return;

  const [student, alumni] = await Promise.all([
    prisma.user.findUnique({ where: { id: studentId } }),
    prisma.user.findUnique({ where: { id: alumniId } }),
  ]);
  if (!student || !alumni) return;

  const link = session.meetingLink || 'Not available';
  await Promise.allSettled([
    emailService.sendSessionReminder(student.email, student.fullName, session.slotStart, link),
    emailService.sendSessionReminder(alumni.email, alumni.fullName, session.slotStart, link),
  ]);
  console.log(`[Worker] Session reminder sent for session ${sessionId} (job: ${job.name})`);
}, { connection, concurrency: 5 });

// ── Digest worker ────────────────────────────────────────────────────────────
new Worker('digest-jobs', async (job) => {
  const cadence: 'daily' | 'weekly' = job.name === 'digest-daily' ? 'daily' : 'weekly';
  const prefs = await prisma.digestPreference.findMany({
    where: { cadence },
    include: { user: true },
  });

  for (const pref of prefs) {
    const undigested = await prisma.notificationEvent.findMany({
      where: { userId: pref.userId, isDigested: false },
      orderBy: { createdAt: 'asc' },
    });
    if (undigested.length === 0) continue;

    const items = undigested.map(e => ({
      type: e.eventType.replace(/_/g, ' '),
      summary: JSON.stringify(e.payload),
    }));

    await emailService.sendDigest(pref.user.email, pref.user.fullName, items);
    await prisma.notificationEvent.updateMany({
      where: { id: { in: undigested.map(e => e.id) } },
      data: { isDigested: true },
    });
    await prisma.digestPreference.update({
      where: { userId: pref.userId },
      data: { lastDigestSentAt: new Date() },
    });
    console.log(`[Worker] Digest sent to ${pref.user.email} (${undigested.length} events)`);
  }
}, { connection, concurrency: 2 });

// ── Health score worker ──────────────────────────────────────────────────────
new Worker('health-jobs', async () => {
  console.log('[Worker] Running health score recalculation for all connections');
  await healthScoreService.recomputeAll();
  console.log('[Worker] Health score recalculation complete');
}, { connection, concurrency: 1 });

// ── Ranking score worker ─────────────────────────────────────────────────────
new Worker('ranking-jobs', async (job) => {
  const { alumniId } = job.data;
  await rankingScoreEngine.updateResponseRate(alumniId);
  await rankingScoreEngine.recompute(alumniId);
  console.log(`[Worker] Ranking score updated for alumni ${alumniId}`);
}, { connection, concurrency: 5 });

console.log('[BullMQ] All workers started');
