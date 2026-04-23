import prisma from '../../db/prismaClient';
import { eventBus, Events } from '../../events/EventBus';
import { rankingScoreEngine } from '../alumni/RankingScoreEngine';

// ─── Request Service ─────────────────────────────────────────────────────────
// Enforces the state machine: pending  accepted | declined | withdrawn

export class RequestService {
  async submit(studentId: string, alumniId: string, message: string, goals?: string) {
    // Validate alumni is verified and available
    const alumniProfile = await prisma.alumniProfile.findUnique({ where: { userId: alumniId } });
    if (!alumniProfile) throw new Error('Alumni not found');
    if (alumniProfile.verificationStatus !== 'approved') throw new Error('Alumni is not verified');
    if (alumniProfile.availabilityStatus === 'unavailable') throw new Error('Alumni is not available');

    // No duplicate pending request
    const existingPending = await prisma.mentorshipRequest.findFirst({
      where: { studentId, alumniId, status: 'pending' },
    });
    if (existingPending) throw new Error('A pending request already exists for this alumni');

    // Not already connected
    const existingConnection = await prisma.connection.findFirst({
      where: { studentId, alumniId },
    });
    if (existingConnection) throw new Error('You are already connected with this alumni');

    const request = await prisma.mentorshipRequest.create({
      data: { studentId, alumniId, message, goals },
    });

    // Notify alumni — include student name in payload
    const student = await prisma.user.findUnique({ where: { id: studentId }, select: { fullName: true } });
    await prisma.notificationEvent.create({
      data: { userId: alumniId, eventType: 'request_received', payload: { requestId: request.id, studentId, senderName: student?.fullName ?? 'A student' }, isDigested: false },
    });

    return request;
  }

  async accept(requestId: string, alumniId: string) {
    const request = await prisma.mentorshipRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new Error('Request not found');
    if (request.alumniId !== alumniId) throw new Error('Not authorized');
    if (request.status !== 'pending') throw new Error('Invalid state transition: request is not pending');

    // Create connection record
    const connection = await prisma.connection.create({
      data: {
        requestId: request.id,
        studentId: request.studentId,
        alumniId: request.alumniId,
      },
    });

    // Update request status
    await prisma.mentorshipRequest.update({
      where: { id: requestId },
      data: { status: 'accepted', resolvedAt: new Date() },
    });

    // Update response rate then recompute ranking score
    await rankingScoreEngine.updateResponseRate(alumniId);
    await rankingScoreEngine.recompute(alumniId);

    // Emit domain event — observers handle the rest independently
    await eventBus.emit(Events.REQUEST_ACCEPTED, {
      requestId: request.id,
      studentId: request.studentId,
      alumniId: request.alumniId,
      connectionId: connection.id,
    });

    return connection;
  }

  async decline(requestId: string, alumniId: string) {
    const request = await prisma.mentorshipRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new Error('Request not found');
    if (request.alumniId !== alumniId) throw new Error('Not authorized');
    if (request.status !== 'pending') throw new Error('Invalid state transition: request is not pending');

    const updated = await prisma.mentorshipRequest.update({
      where: { id: requestId },
      data: { status: 'declined', resolvedAt: new Date() },
    });

    await rankingScoreEngine.updateResponseRate(alumniId);
    await rankingScoreEngine.recompute(alumniId);

    const alumniUser = await prisma.user.findUnique({ where: { id: alumniId }, select: { fullName: true } });
    await prisma.notificationEvent.create({
      data: { userId: request.studentId, eventType: 'request_declined', payload: { requestId, senderName: alumniUser?.fullName ?? 'An alumni' }, isDigested: false },
    });

    return updated;
  }

  async withdraw(requestId: string, studentId: string) {
    const request = await prisma.mentorshipRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new Error('Request not found');
    if (request.studentId !== studentId) throw new Error('Not authorized');
    if (request.status !== 'pending') throw new Error('Invalid state transition: request is not pending');

    return prisma.mentorshipRequest.update({
      where: { id: requestId },
      data: { status: 'withdrawn', resolvedAt: new Date() },
    });
  }

  async listForUser(userId: string, role: string) {
    if (role === 'student') {
      return prisma.mentorshipRequest.findMany({
        where: { studentId: userId },
        include: { alumni: { select: { id: true, fullName: true, profilePhotoUrl: true, alumniProfile: true } } },
        orderBy: { createdAt: 'desc' },
      });
    }
    return prisma.mentorshipRequest.findMany({
      where: { alumniId: userId },
      include: { student: { select: { id: true, fullName: true, profilePhotoUrl: true, studentProfile: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(requestId: string, userId: string) {
    const request = await prisma.mentorshipRequest.findUnique({
      where: { id: requestId },
      include: {
        student: { select: { id: true, fullName: true, profilePhotoUrl: true } },
        alumni: { select: { id: true, fullName: true, profilePhotoUrl: true, alumniProfile: true } },
      },
    });
    if (!request) throw new Error('Request not found');
    if (request.studentId !== userId && request.alumniId !== userId) throw new Error('Not authorized');
    return request;
  }
}

export const requestService = new RequestService();
