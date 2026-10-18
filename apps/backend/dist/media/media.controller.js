"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const jwt_1 = require("@nestjs/jwt");
const prisma_service_1 = require("../prisma/prisma.service");
const media_service_1 = require("./media.service");
let MediaController = class MediaController {
    media;
    jwt;
    prisma;
    constructor(media, jwt, prisma) {
        this.media = media;
        this.jwt = jwt;
        this.prisma = prisma;
    }
    upload(req, kind, file) { return this.media.upload(req.user.id, kind, file); }
    async read(id, req, res, download) {
        let user;
        try {
            const token = req.headers.authorization?.slice(7) || req.headers.cookie?.split(';').map((s) => s.trim()).find((s) => s.startsWith('safar_session='))?.slice(14);
            if (token) {
                const payload = await this.jwt.verifyAsync(token);
                user = await this.prisma.user.findUnique({ where: { id: payload.id }, select: { id: true, role: true } });
            }
        }
        catch { }
        const result = await this.media.read(id, user);
        res.setHeader('Cache-Control', 'private, no-store');
        if (download === '1')
            res.setHeader('Content-Disposition', 'attachment; filename="safar-original-document"');
        res.type(result.mimeType).send(result.buffer);
    }
};
exports.MediaController = MediaController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', { limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 0 } })),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('kind')),
    __param(2, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], MediaController.prototype, "upload", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __param(2, (0, common_1.Res)()),
    __param(3, (0, common_1.Query)('download')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, String]),
    __metadata("design:returntype", Promise)
], MediaController.prototype, "read", null);
exports.MediaController = MediaController = __decorate([
    (0, common_1.Controller)('media'),
    __metadata("design:paramtypes", [media_service_1.MediaService, jwt_1.JwtService, prisma_service_1.PrismaService])
], MediaController);
//# sourceMappingURL=media.controller.js.map