import { rentalQuote } from './pricing';

describe('Rental quote policy', () => {
  const start = new Date('2030-01-01T10:00:00Z');
  it.each([[6,75,1],[12,150,1],[24,300,1],[36,450,2],[48,600,2]])('includes prorated kilometres for %s hours', (hours, km, days) => {
    const quote = rentalQuote(1800, start, new Date(+start + hours * 3600000));
    expect(quote.includedKilometres).toBe(km);
    expect(quote.rentalDays).toBe(days);
    expect(quote.securityDeposit).toBe(2000);
    expect(quote.totalAmount).toBe(days * 1800 + 2000);
  });
  it('preserves paise accurately', () => {
    expect(rentalQuote('1000.25', start, new Date(+start + 48 * 3600000)).totalAmount).toBe(4000.5);
  });
});
