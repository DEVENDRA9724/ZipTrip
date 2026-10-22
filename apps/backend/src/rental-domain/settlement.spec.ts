import { calculateSettlement } from './settlement';

describe('calculateSettlement', () => {
  it('releases the remaining deposit when charges are lower', () => {
    expect(calculateSettlement({ depositHeld: 2000, automaticCharges: 350 })).toMatchObject({
      totalDeduction: 350,
      refundAmount: 1650,
      additionalAmountDue: 0,
    });
  });

  it('records an additional amount when charges exceed the deposit', () => {
    expect(calculateSettlement({ depositHeld: 2000, automaticCharges: 500, damageCharges: 2500 })).toMatchObject({
      totalDeduction: 3000,
      refundAmount: 0,
      additionalAmountDue: 1000,
    });
  });
});
