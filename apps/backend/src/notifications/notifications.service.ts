import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { text } from '../common/validation';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async markRead(userId: string, id: string) {
    const result = await this.prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
    if (!result.count) throw new NotFoundException('Notification not found');
    return { id, readAt: new Date() };
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    return { updated: result.count };
  }

  async create(userId: string, data: { type: string; title: string; message: string; bookingId?: string; metadata?: any }) {
    return this.prisma.notification.create({ data: {
      userId,
      type: text(data.type, 'Notification type', 60),
      title: text(data.title, 'Notification title', 160),
      message: text(data.message, 'Notification message', 1000),
      bookingId: data.bookingId || null,
      metadata: data.metadata == null ? null : JSON.stringify(data.metadata),
    } });
  }
}
