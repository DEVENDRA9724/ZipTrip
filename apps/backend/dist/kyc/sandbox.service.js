"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var SandboxService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SandboxService = void 0;
const common_1 = require("@nestjs/common");
let SandboxService = SandboxService_1 = class SandboxService {
    logger = new common_1.Logger(SandboxService_1.name);
    token;
    expires = 0;
    environment() {
        return process.env.SANDBOX_ENV === 'live' ? 'live' : 'test';
    }
    configured() {
        return Boolean(process.env.SANDBOX_API_KEY && process.env.SANDBOX_API_SECRET);
    }
    async request(path, method, body, authenticate = false) {
        if (!this.configured()) {
            throw new common_1.ServiceUnavailableException('Configure Sandbox key and secret on the server');
        }
        const base = this.environment() === 'live' ? 'https://api.sandbox.co.in' : 'https://test-api.sandbox.co.in';
        const headers = {
            'x-api-key': process.env.SANDBOX_API_KEY,
            'x-api-version': '1.0',
            'Content-Type': 'application/json',
        };
        if (authenticate) {
            headers['x-api-secret'] = process.env.SANDBOX_API_SECRET;
        }
        else {
            headers.Authorization = this.token;
        }
        try {
            const response = await fetch(base + path, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
                signal: AbortSignal.timeout(20000),
                redirect: 'error',
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || (result.code !== 200 && result.status !== 200)) {
                this.logger.error(`Sandbox API error [${response.status}] on ${path}: ${JSON.stringify(result)}`);
                throw new Error(result.message || result.error || 'Provider failure');
            }
            return result.data || result;
        }
        catch (err) {
            this.logger.error(`Sandbox request failed: ${err.message}`, err.stack);
            throw new common_1.BadGatewayException(err.message || 'Verification provider could not complete the request.');
        }
    }
    async call(path, method = 'GET', body) {
        if (!this.token || this.expires < Date.now()) {
            const auth = await this.request('/authenticate', 'POST', undefined, true);
            const token = auth.access_token || auth.data?.access_token;
            if (typeof token !== 'string') {
                throw new common_1.BadGatewayException('Invalid provider authentication response');
            }
            this.token = token;
            this.expires = Date.now() + 23 * 3600000;
        }
        return this.request(path, method, body);
    }
};
exports.SandboxService = SandboxService;
exports.SandboxService = SandboxService = SandboxService_1 = __decorate([
    (0, common_1.Injectable)()
], SandboxService);
//# sourceMappingURL=sandbox.service.js.map