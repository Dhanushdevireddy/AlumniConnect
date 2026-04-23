import prisma from '../../db/prismaClient';
import { meetingProvider } from './MeetingProvider';
import { sessionJobQueue } from '../../jobs/queues';

export class SessionService {
  async proposeSessions(
    connectionId: string,
    proposedById: string,
    slotStart: Date,
    slotEnd: Date
  ) {
    // Validate connection participant
    const conn = await prisma.connection.findUnique({ where: { id: connectionId } });
    if (!conn) throw new Error('Connection not found');
    if (conn.studentId !== proposedById && conn.alumniId !== proposedById)
      throw new Error('Not a participant in this connection');

    // Double-booking check for both participants
    const conflict = await prisma.session.findFirst({
      where: {
        status: { in: ['proposed', 'confirmed'] },
        connection: {
          OR: [
            { studentId: conn.studentId },
            { alumniId: conn.alumniId },
          ],
        },
        AND: [
          { slotStart: { lt: slotEnd } },
          { slotEnd: { gt: slotStart } },
        ],
      },
    });
    if (conflict) throw new Error('Time slot conflicts with an existing booking');

    const session = await prisma.session.create({
      data: { connectionId, proposedById, slotStart, slotEnd, version: 0 },
    });

    // Notify the other participant about the session proposal
    const recipientId = conn.studentId === proposedById ? conn.alumniId : conn.studentId;
    const proposer = await prisma.user.findUnique({ where: { id: proposedById }, select: { fullName: true } });
    await prisma.notificationEvent.create({
      data: {
        userId: recipientId,
        eventType: 'session_proposed',
        payload: { sessionId: session.id, connectionId, proposedById, senderName: proposer?.fullName ?? 'Your mentor/mentee', slotStart: slotStart.toISOString(), slotEnd: slotEnd.toISOString() },
        isDigested: false,
      },
    });

    return session;
  }

  async confirmSession(sessionId: string, confirmingUserId: string) {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { connection: { include: { student: true, alumni: true } } },
    });
    if (!session) throw new Error('Session not found');
    if (session.status !== 'proposed') throw new Error('Session is not in proposed state');

    const conn = session.connection;
    if (conn.studentId !== confirmingUserId && conn.alumniId !== confirmingUserId)
      throw new Error('Not a participant in this connection');
    if (session.proposedById === confirmingUserId)
      throw new Error('Proposer cannot confirm their own session — other party must confirm');

    // Optimistic locking — version must match
    const currentVersion = session.version;
    const meetingLink = await meetingProvider.generateLink(
      sessionId,
      session.slotStart,
      session.slotEnd
    );

    const updated = await prisma.$executeRaw`
      UPDATE sessions
      SET status = 'confirmed',
          meeting_link = ${meetingLink},
          confirmed_at = NOW(),
          version = version + 1
      WHERE id = ${sessionId}
        AND version = ${currentVersion}
        AND status = 'proposed'
    `;

    if (updated === 0) throw new Error('Conflict: session was modified concurrently. Please retry.');

    const confirmedSession = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { connection: { include: { student: true, alumni: true } } },
    });

    // Enqueue reminders
    const now = new Date();
    const t24h = new Date(session.slotStart.getTime() - 24 * 60 * 60 * 1000);
    const t1h = new Date(session.slotStart.getTime() - 60 * 60 * 1000);

    if (t24h > now) {
      await sessionJobQueue.add(
        'session-reminder-24h',
        { sessionId, studentId: conn.studentId, alumniId: conn.alumniId },
        { delay: t24h.getTime() - now.getTime(), attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
      );
    }
    if (t1h > now) {
      await sessionJobQueue.add(
        'session-reminder-1h',
        { sessionId, studentId: conn.studentId, alumniId: conn.alumniId },
        { delay: t1h.getTime() - now.getTime(), attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
      );
    }

    return confirmedSession;
  }

  async cancelSession(sessionId: string, userId: string) {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { connection: true },
    });
    if (!session) throw new Error('Session not found');
    if (session.connection.studentId !== userId && session.connection.alumniId !== userId)
      throw new Error('Not a participant');
    if (!['proposed', 'confirmed'].includes(session.status))
      throw new Error('Cannot cancel a session in current state');

    return prisma.session.update({
      where: { id: sessionId },
      data: { status: 'cancelled', version: { increment: 1 } },
    });
  }

  async markAttendance(sessionId: string, userId: string, attended: boolean) {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { connection: true },
    });
    if (!session) throw new Error('Session not found');

    const isStudent = session.connection.studentId === userId;
    const isAlumni = session.connection.alumniId === userId;
    if (!isStudent && !isAlumni) throw new Error('Not a participant');

    const data: Record<string, boolean | string | number> = {};
    if (isStudent) data.studentAttended = attended;
    if (isAlumni) data.alumniAttended = attended;

    const updated = await prisma.session.update({ where: { id: sessionId }, data });

    // If both attended  mark completed
    const freshSession = await prisma.session.findUnique({ where: { id: sessionId } });
    if (freshSession?.studentAttended !== null && freshSession?.alumniAttended !== null) {
      await prisma.session.update({ where: { id: sessionId }, data: { status: 'completed' } });
    }

    return updated;
  }

  async getSessionsForConnection(connectionId: string) {
    return prisma.session.findMany({
      where: { connectionId },
      orderBy: { slotStart: 'asc' },
    });
  }
}

export const sessionService = new SessionService();
