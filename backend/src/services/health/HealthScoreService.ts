import prisma from '../../db/prismaClient';

const STALENESS_THRESHOLD = 0.35;
const WINDOW_DAYS = 30;

export class HealthScoreService {
  async recomputeAll(): Promise<void> {
    const connections = await prisma.connection.findMany({ select: { id: true } });
    for (const conn of connections) {
      await this.recompute(conn.id);
    }
  }

  async recompute(connectionId: string): Promise<void> {
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - WINDOW_DAYS);

    const connection = await prisma.connection.findUnique({
      where: { id: connectionId },
      include: {
        student: { select: { email: true, fullName: true } },
        alumni: { select: { email: true, fullName: true } },
      },
    });
    if (!connection) return;

    const messages = await prisma.chatMessage.findMany({
      where: { connectionId, sentAt: { gte: windowStart } },
      orderBy: { sentAt: 'asc' },
    });

    const sessions = await prisma.session.findMany({
      where: { connectionId, status: { in: ['confirmed', 'completed', 'cancelled'] }, slotStart: { gte: windowStart } },
    });

    // Signal 1: Message frequency (normalised, cap at 100 messages)
    const messageFrequency = Math.min(messages.length / 100, 1);

    // Signal 2: Session attendance rate
    const completedSessions = sessions.filter(s => s.status === 'completed');
    const totalScheduled = sessions.filter(s => s.status !== 'cancelled').length;
    const attendedCount = completedSessions.filter(s => s.studentAttended && s.alumniAttended).length;
    const sessionAttendanceRate = totalScheduled > 0 ? attendedCount / totalScheduled : 1;

    // Signal 3: Avg response latency (seconds) - between messages from different senders
    let avgResponseLatency = 0;
    if (messages.length > 1) {
      const latencies: number[] = [];
      for (let i = 1; i < messages.length; i++) {
        if (messages[i].senderId !== messages[i - 1].senderId) {
          latencies.push((messages[i].sentAt.getTime() - messages[i - 1].sentAt.getTime()) / 1000);
        }
      }
      if (latencies.length > 0) {
        avgResponseLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      }
    }
    // Normalise latency: < 1 hour is great (score near 1), > 48 hours is poor (near 0)
    const latencyScore = Math.max(0, 1 - avgResponseLatency / (48 * 3600));

    // Time decay: score decays if no activity recently
    const daysSinceLastMessage = messages.length > 0
      ? (Date.now() - messages[messages.length - 1].sentAt.getTime()) / (1000 * 60 * 60 * 24)
      : WINDOW_DAYS;
    const decayFactor = Math.max(0, 1 - daysSinceLastMessage / WINDOW_DAYS);

    const rawScore = (messageFrequency * 0.4 + sessionAttendanceRate * 0.35 + latencyScore * 0.25);
    const finalScore = rawScore * decayFactor;

    await prisma.healthScoreLog.create({
      data: { connectionId, score: finalScore, messageFrequency, sessionAttendanceRate, avgResponseLatencySeconds: avgResponseLatency },
    });

    const isFlagged = finalScore < STALENESS_THRESHOLD;
    await prisma.connection.update({
      where: { id: connectionId },
      data: { healthScore: finalScore, healthScoreLastUpdated: new Date(), isFlagged },
    });

    // If flagged, send nudges via notification events
    if (isFlagged && !connection.isFlagged) {
      await prisma.notificationEvent.createMany({
        data: [
          { userId: connection.studentId, eventType: 're_engagement_nudge', payload: { connectionId, partnerName: connection.alumni.fullName }, isDigested: false },
          { userId: connection.alumniId, eventType: 're_engagement_nudge', payload: { connectionId, partnerName: connection.student.fullName }, isDigested: false },
        ],
      });

      const { emailService } = await import('../email/EmailService');
      await Promise.allSettled([
        emailService.sendReEngagementNudge(connection.student.email, connection.student.fullName, connection.alumni.fullName),
        emailService.sendReEngagementNudge(connection.alumni.email, connection.alumni.fullName, connection.student.fullName),
      ]);

      console.log(`[HealthScore] Connection ${connectionId} flagged — re-engagement nudges sent`);
    }
  }
}

export const healthScoreService = new HealthScoreService();
