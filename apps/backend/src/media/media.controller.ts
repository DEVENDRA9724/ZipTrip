import { Controller, Get, Post, Param, Query, Request, Res, UploadedFile, UseInterceptors, UseGuards } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from './media.service';
import type { Response } from 'express';
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
      const token = req.headers.authorization?.slice(7) || req.headers.cookie?.split(';').map((s: string) => s.trim()).find((s: string) => s.startsWith('safar_session='))?.slice(14);
      if (token) { const payload = await this.jwt.verifyAsync(token); user = await this.prisma.user.findUnique({ where: { id: payload.id }, select: { id: true, role: true } }); }
    } catch {}
    const result = await this.media.read(id, user);
    res.setHeader('Cache-Control', 'private, no-store');
    if (download === '1') res.setHeader('Content-Disposition', 'attachment; filename="safar-original-document"');
    res.type(result.mimeType).send(result.buffer);
  }
}

