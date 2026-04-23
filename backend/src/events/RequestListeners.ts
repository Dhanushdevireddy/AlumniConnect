import prisma from '../db/prismaClient';
import { eventBus, Events, RequestAcceptedPayload } from './EventBus';

// ─── Observer Listeners for RequestAccepted ──────────────────────────────────
// Three independently-running listeners registered at startup.
// Promise.allSettled in EventBus ensures failure isolation.

// Listener 1: Create notification records for both parties
eventBus.on<RequestAcceptedPayload>(Events.REQUEST_ACCEPTED, async (payload: RequestAcceptedPayload) => {
  console.log('[Listener] Creating notification events for connection', payload.connectionId);
  await prisma.notificationEvent.createMany({
    data: [
      { userId: payload.studentId, eventType: 'request_accepted', payload: { requestId: payload.requestId, connectionId: payload.connectionId }, isDigested: false },
      { userId: payload.alumniId, eventType: 'request_accepted', payload: { requestId: payload.requestId, connectionId: payload.connectionId }, isDigested: false },
    ],
  });
  console.log('[Listener] Notification events created');
});

// Listener 2: Chat thread provisioning
eventBus.on<RequestAcceptedPayload>(Events.REQUEST_ACCEPTED, async (payload: RequestAcceptedPayload) => {
  console.log('[Listener] Provisioning chat thread for connection', payload.connectionId);
  await prisma.chatMessage.create({
    data: {
      connectionId: payload.connectionId,
      senderId: payload.alumniId,
      messageType: 'text',
      content: ' Your mentorship connection is confirmed! Feel free to start the conversation.',
    },
  });
  console.log('[Listener] Chat thread provisioned');
});

// Listener 3: Dual email dispatch
eventBus.on<RequestAcceptedPayload>(Events.REQUEST_ACCEPTED, async (payload: RequestAcceptedPayload) => {
  console.log('[Listener] Dispatching connection confirmation emails');
  const [student, alumni] = await Promise.all([
    prisma.user.findUnique({ where: { id: payload.studentId } }),
    prisma.user.findUnique({ where: { id: payload.alumniId } }),
  ]);
  if (!student || !alumni) return;
  const { emailService } = await import('../services/email/EmailService');
  await emailService.sendConnectionConfirmation(student.email, alumni.email, student.fullName, alumni.fullName);
  console.log('[Listener] Connection emails dispatched');
});

export function registerRequestObservers() {
  console.log('[Observer] Request acceptance listeners registered (3 independent listeners)');
}
