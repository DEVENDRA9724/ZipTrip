import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';

type Msg91Response = Record<string, any>;

/**
 * Server-side adapter for MSG91's OTP APIs. The auth key never leaves the API
 * process, so browsers and mobile clients only talk to our own auth endpoints.
 */
@Injectable()
export class Msg91Service {
  readonly provider = (process.env.OTP_PROVIDER || 'local').trim().toLowerCase();

  isEnabled() {
    return this.provider === 'msg91';
  }

  normalizePhone(input: unknown) {
    if (typeof input !== 'string') throw new BadRequestException('Phone is required');
    let value = input.trim().replace(/[\s()-]/g, '');
    if (!value) throw new BadRequestException('Phone is required');
    if (value.startsWith('00')) value = `+${value.slice(2)}`;
    if (!/^\+?\d{10,15}$/.test(value)) throw new BadRequestException('Invalid phone number');

    let digits = value.replace(/^\+/, '');
    // Safar currently operates in India. Accept the common local formats while
    // still allowing an international number with its country code.
    if (digits.length === 10) digits = `91${digits}`;
    if (digits.length === 11 && digits.startsWith('0')) digits = `91${digits.slice(1)}`;
    if (digits.length < 10 || digits.length > 15) throw new BadRequestException('Invalid phone number');
    return `+${digits}`;
  }

  providerPhone(phone: string) {
    return this.normalizePhone(phone).slice(1);
  }

  private config() {
    const authkey = process.env.MSG91_AUTHKEY?.trim();
    const templateId = process.env.MSG91_OTP_TEMPLATE_ID?.trim();
    if (!authkey || !templateId) {
      throw new ServiceUnavailableException('MSG91 OTP is not configured. Set MSG91_AUTHKEY and MSG91_OTP_TEMPLATE_ID.');
    }
    return { authkey, templateId };
  }

  private async parse(response: Response): Promise<Msg91Response> {
    const raw = await response.text();
    try {
      return raw ? JSON.parse(raw) : {};
    } catch {
      return { message: raw };
    }
  }

  private successful(response: Response, payload: Msg91Response) {
    if (!response.ok) return false;
    // MSG91 has returned both `{type: "success"}` and message-only success
    // payloads over time. HTTP 2xx is accepted when no explicit failure state
    // is present; explicit error/failure states still fail closed.
    const state = String(payload.type || payload.status || '').toLowerCase();
    return !state || state === 'success' || state === 'ok' || state === 'true' || state.includes('success');
  }

  private providerError(payload: Msg91Response) {
    const message = payload.message || payload.error || payload.detail;
    return typeof message === 'string' && message.length < 240 ? message : 'MSG91 rejected the OTP request';
  }

  async sendOtp(phone: string) {
    const { authkey, templateId } = this.config();
    const url = new URL(process.env.MSG91_OTP_SEND_URL || 'https://control.msg91.com/api/v5/otp');
    url.searchParams.set('template_id', templateId);
    url.searchParams.set('mobile', this.providerPhone(phone));
    const response = await fetch(url, {
      method: 'POST',
      headers: { authkey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({}),
    });
    const payload = await this.parse(response);
    if (!this.successful(response, payload)) {
      throw new ServiceUnavailableException(this.providerError(payload));
    }
    return { requestId: payload.request_id || payload.reqId || payload.requestId || null };
  }

  async verifyOtp(phone: string, otp: string) {
    const { authkey } = this.config();
    const code = String(otp || '').trim();
    if (!/^\d{6}$/.test(code)) throw new BadRequestException('Enter a valid 6-digit OTP');
    const url = new URL(process.env.MSG91_OTP_VERIFY_URL || 'https://control.msg91.com/api/v5/otp/verify');
    url.searchParams.set('mobile', this.providerPhone(phone));
    url.searchParams.set('otp', code);
    const response = await fetch(url, {
      method: 'GET',
      headers: { authkey, Accept: 'application/json' },
    });
    const payload = await this.parse(response);
    if (!this.successful(response, payload)) {
      throw new BadRequestException('Invalid or expired OTP code. Please try again.');
    }
    return { verified: true };
  }
}
