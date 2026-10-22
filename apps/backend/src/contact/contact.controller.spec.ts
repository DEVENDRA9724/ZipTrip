import { businessContact } from './contact.controller';

describe('Public business contact details', () => {
  it('returns nothing to display when contact details are not configured', () => {
    expect(businessContact({})).toEqual({
      name: 'Safar Self Drive',
      phone: null,
      whatsapp: null,
      email: null,
      address: null,
    });
  });

  it('returns configured details and derives the WhatsApp number', () => {
    expect(
      businessContact({
        BUSINESS_NAME: 'Safar',
        BUSINESS_PHONE: '+91 79 4000 1234',
        BUSINESS_EMAIL: 'help@example.com',
        BUSINESS_ADDRESS: 'Ahmedabad',
      }),
    ).toEqual({
      name: 'Safar',
      phone: '+91 79 4000 1234',
      whatsapp: '917940001234',
      email: 'help@example.com',
      address: 'Ahmedabad',
    });
  });

  it('drops malformed values instead of publishing them', () => {
    const result = businessContact({
      BUSINESS_PHONE: 'call us"><script>',
      BUSINESS_EMAIL: 'not-an-email',
      BUSINESS_ADDRESS: 'x'.repeat(501),
    });
    expect(result).toMatchObject({
      phone: null,
      whatsapp: null,
      email: null,
      address: null,
    });
  });
});
