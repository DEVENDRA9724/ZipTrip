import { Controller, Get, Post, Param, Query, Request, Res, UploadedFile, UseInterceptors, UseGuards } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from './media.service';
import type { Response } from 'express';

const DOWNLOAD_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};
// e.g. "safar-rc-document.jpg". Only letters, digits and dashes reach the header, so the filename cannot break out of it.
export function downloadName(
  kind: string | null | undefined,
  mimeType: string,
) {
  const label = String(kind || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const extension = DOWNLOAD_EXTENSIONS[String(mimeType).toLowerCase()];
  return `${label ? `safar-${label}-document` : 'safar-document'}${extension ? '.' + extension : ''}`;
}

@Controller('media')
export class MediaController {
  constructor(private media: MediaService, private jwt: JwtService, private prisma: PrismaService) {}
  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 0 } }))
  upload(@Request() req: any, @Query('kind') kind: string, @UploadedFile() file: any) { return this.media.upload(req.user.id, kind, file); }
  @Get(':id')
  async read(@Param('id') id: string, @Request() req: any, @Res() res: Response, @Query('download') download?: string) {
    let user: any;
    try {
      const header = typeof req.headers.authorization === 'string' && req.headers.authorization.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined;
      const token = header || req.headers.cookie?.split(';').map((s: string) => s.trim()).find((s: string) => s.startsWith('safar_session='))?.slice(14);
      if (token) {
        const payload = await this.jwt.verifyAsync(token);
        const found = await this.prisma.user.findUnique({ where: { id: payload.id }, select: { id: true, role: true, isBlocked: true } });
        // Blocked accounts keep only anonymous access (public vehicle photos), matching JwtAuthGuard.
        if (found && !found.isBlocked) user = { id: found.id, role: found.role };
      }
    } catch {}
    const result = await this.media.read(id, user);
    res.setHeader('Cache-Control', 'private, no-store');
    // Downloads get a real file extension (from the stored type) so the saved file opens as an image.
    if (download === '1')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${downloadName(result.kind, result.mimeType)}"`,
      );
    res.type(result.mimeType).send(result.buffer);
  }
}

