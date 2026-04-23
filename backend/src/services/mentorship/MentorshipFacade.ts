import { requestService } from './RequestService';
import { sessionService } from '../session/SessionService';
import prisma from '../../db/prismaClient';

// ─── Facade Pattern: MentorshipService ──────────────────────────────────────
// Single entry point for all mentorship-related operations.
// Controllers must ONLY call this class — never call sub-services directly.

export class MentorshipFacade {
  // ── Requests ────────────────────────────────────────────────────────────
  async submitRequest(studentId: string, alumniId: string, message: string, goals?: string) {
    return requestService.submit(studentId, alumniId, message, goals);
  }

  async acceptRequest(requestId: string, alumniId: string) {
    return requestService.accept(requestId, alumniId);
  }

  async declineRequest(requestId: string, alumniId: string) {
    return requestService.decline(requestId, alumniId);
  }

  async withdrawRequest(requestId: string, studentId: string) {
    return requestService.withdraw(requestId, studentId);
  }

  async listRequests(userId: string, role: string) {
    return requestService.listForUser(userId, role);
  }

  async getRequest(requestId: string, userId: string) {
    return requestService.getById(requestId, userId);
  }

  // ── Connections ─────────────────────────────────────────────────────────
  async listConnections(userId: string) {
    return prisma.connection.findMany({
      where: { OR: [{ studentId: userId }, { alumniId: userId }] },
      include: {
        student: { select: { id: true, fullName: true, profilePhotoUrl: true } },
        alumni: { select: { id: true, fullName: true, profilePhotoUrl: true, alumniProfile: true } },
        request: { select: { message: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getConnection(connectionId: string, userId: string) {
    const conn = await prisma.connection.findUnique({
      where: { id: connectionId },
      include: {
        student: { select: { id: true, fullName: true, profilePhotoUrl: true, studentProfile: true } },
        alumni: {
          select: {
            id: true,
            fullName: true,
            profilePhotoUrl: true,
            alumniProfile: { include: { domainTags: true } },
          },
        },
        request: true,
      },
    });
    if (!conn) throw new Error('Connection not found');
    if (conn.studentId !== userId && conn.alumniId !== userId) throw new Error('Not authorized');
    return conn;
  }

  // ── Sessions ────────────────────────────────────────────────────────────
  async proposeSession(connectionId: string, proposedById: string, slotStart: Date, slotEnd: Date) {
    return sessionService.proposeSessions(connectionId, proposedById, slotStart, slotEnd);
  }

  async confirmSession(sessionId: string, userId: string) {
    return sessionService.confirmSession(sessionId, userId);
  }

  async cancelSession(sessionId: string, userId: string) {
    return sessionService.cancelSession(sessionId, userId);
  }

  async markAttendance(sessionId: string, userId: string, attended: boolean) {
    return sessionService.markAttendance(sessionId, userId, attended);
  }

  async getSessionsForConnection(connectionId: string) {
    return sessionService.getSessionsForConnection(connectionId);
  }
}

export const mentorshipService = new MentorshipFacade();
