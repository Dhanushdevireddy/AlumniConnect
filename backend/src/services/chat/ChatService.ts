import prisma from '../../db/prismaClient';
import path from 'path';

export class ChatService {
  async getMessages(connectionId: string, userId: string, page = 1, limit = 50) {
    const conn = await prisma.connection.findUnique({ where: { id: connectionId } });
    if (!conn) throw new Error('Connection not found');
    if (conn.studentId !== userId && conn.alumniId !== userId) throw new Error('Not authorized');

    const skip = (page - 1) * limit;
    const [messages, total] = await Promise.all([
      prisma.chatMessage.findMany({
        where: { connectionId },
        include: { sender: { select: { id: true, fullName: true, profilePhotoUrl: true } } },
        orderBy: { sentAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.chatMessage.count({ where: { connectionId } }),
    ]);
    return { messages: messages.reverse(), total, page, limit };
  }

  async sendTextMessage(connectionId: string, senderId: string, content: string) {
    const conn = await prisma.connection.findUnique({ where: { id: connectionId } });
    if (!conn) throw new Error('Connection not found');
    if (conn.studentId !== senderId && conn.alumniId !== senderId) throw new Error('Not authorized');

    const message = await prisma.chatMessage.create({
      data: { connectionId, senderId, messageType: 'text', content, deliveredAt: new Date() },
      include: { sender: { select: { id: true, fullName: true, profilePhotoUrl: true } } },
    });

    // Notification for the other party
    const recipientId = conn.studentId === senderId ? conn.alumniId : conn.studentId;
    const senderUser = await prisma.user.findUnique({ where: { id: senderId }, select: { fullName: true } });
    await prisma.notificationEvent.create({
      data: { userId: recipientId, eventType: 'new_message', payload: { connectionId, messageId: message.id, senderId, senderName: senderUser?.fullName ?? 'Someone' }, isDigested: false },
    });

    return message;
  }

  async saveFileMessage(connectionId: string, senderId: string, filePath: string, fileName: string) {
    const conn = await prisma.connection.findUnique({ where: { id: connectionId } });
    if (!conn) throw new Error('Connection not found');
    if (conn.studentId !== senderId && conn.alumniId !== senderId) throw new Error('Not authorized');

    const fileUrl = `/uploads/${path.basename(filePath)}`;
    const message = await prisma.chatMessage.create({
      data: { connectionId, senderId, messageType: 'file', fileUrl, fileName, deliveredAt: new Date() },
      include: { sender: { select: { id: true, fullName: true, profilePhotoUrl: true } } },
    });

    const recipientId = conn.studentId === senderId ? conn.alumniId : conn.studentId;
    const senderUserFile = await prisma.user.findUnique({ where: { id: senderId }, select: { fullName: true } });
    await prisma.notificationEvent.create({
      data: { userId: recipientId, eventType: 'new_message', payload: { connectionId, messageId: message.id, senderId, senderName: senderUserFile?.fullName ?? 'Someone', type: 'file' }, isDigested: false },
    });

    return message;
  }
}

export const chatService = new ChatService();
