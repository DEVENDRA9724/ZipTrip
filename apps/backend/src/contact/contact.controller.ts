import { Controller, Get } from '@nestjs/common';

// Public business contact details for the website, taken only from server configuration (the same BUSINESS_* values
// printed on rental agreements). Unset or malformed values are returned as null so pages show an honest
// "not published" state instead of placeholder numbers.
export function businessContact(env: NodeJS.ProcessEnv = process.env) {
  const clean = (value: string | undefined, max: number) => {
    const trimmed = value?.trim();
    return trimmed && trimmed.length <= max ? trimmed : null;
  };
  const phone = clean(env.BUSINESS_PHONE, 20);
  const phoneDigits =
    phone && /^\+?[0-9][0-9 -]{6,18}$/.test(phone)
      ? phone.replace(/[^0-9]/g, '')
      : null;
  const email = clean(env.BUSINESS_EMAIL, 254);
  return {
    name: clean(env.BUSINESS_NAME, 120) || 'Safar Self Drive',
    phone: phoneDigits ? phone : null,
    // wa.me expects the international number without "+" or separators.
    whatsapp: phoneDigits && phoneDigits.length >= 10 ? phoneDigits : null,
    email:
      email && /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(email)
        ? email
        : null,
    address: clean(env.BUSINESS_ADDRESS, 500),
  };
}

@Controller('contact')
export class ContactController {
  @Get()
  contact() {
    return businessContact();
  }
}
