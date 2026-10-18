"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const adapter_better_sqlite3_1 = require("@prisma/adapter-better-sqlite3");
const adapter_pg_1 = require("@prisma/adapter-pg");
const dotenv = __importStar(require("dotenv"));
const node_path_1 = require("node:path");
const node_fs_1 = require("node:fs");
const envPaths = [
    (0, node_path_1.resolve)(__dirname, '../../.env'),
    (0, node_path_1.resolve)(__dirname, '../.env'),
    (0, node_path_1.resolve)(process.cwd(), '.env'),
    (0, node_path_1.resolve)(process.cwd(), 'apps/backend/.env'),
];
for (const p of envPaths) {
    if ((0, node_fs_1.existsSync)(p)) {
        dotenv.config({ path: p });
    }
}
dotenv.config();
let PrismaService = class PrismaService extends client_1.PrismaClient {
    constructor() {
        const url = process.env.DATABASE_URL || 'file:./portal.db';
        const isPostgres = /^postgres(ql)?:\/\//.test(url);
        const adapter = isPostgres
            ? new adapter_pg_1.PrismaPg({ connectionString: url })
            : new adapter_better_sqlite3_1.PrismaBetterSqlite3({ url });
        super({ adapter });
    }
    async onModuleInit() {
        try {
            await this.$connect();
            console.log('[PrismaService] Database connected successfully.');
        }
        catch (err) {
            console.error('[PrismaService] Failed to connect to database:', err);
            throw err;
        }
    }
    async onModuleDestroy() {
        await this.$disconnect();
    }
};
exports.PrismaService = PrismaService;
exports.PrismaService = PrismaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], PrismaService);
//# sourceMappingURL=prisma.service.js.map