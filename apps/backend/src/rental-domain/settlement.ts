export type SettlementCharges = {
  depositHeld: number;
  automaticCharges?: number;
  damageCharges?: number;
  fuelCharges?: number;
  tollCharges?: number;
  fineCharges?: number;
  cleaningCharges?: number;
  otherCharges?: number;
};

/** Calculates the escrow result for a returned/cancelled booking. */
export function calculateSettlement(charges: SettlementCharges) {
  const automaticCharges = Math.max(0, charges.automaticCharges || 0);
  const damageCharges = Math.max(0, charges.damageCharges || 0);
  const fuelCharges = Math.max(0, charges.fuelCharges || 0);
  const tollCharges = Math.max(0, charges.tollCharges || 0);
  const fineCharges = Math.max(0, charges.fineCharges || 0);
  const cleaningCharges = Math.max(0, charges.cleaningCharges || 0);
  const otherCharges = Math.max(0, charges.otherCharges || 0);
  const depositHeld = Math.max(0, charges.depositHeld || 0);
  const totalDeduction = automaticCharges + damageCharges + fuelCharges + tollCharges + fineCharges + cleaningCharges + otherCharges;
  return {
    depositHeld,
    automaticCharges,
    damageCharges,
    fuelCharges,
    tollCharges,
    fineCharges,
    cleaningCharges,
    otherCharges,
    totalDeduction,
    refundAmount: Math.max(0, depositHeld - totalDeduction),
    additionalAmountDue: Math.max(0, totalDeduction - depositHeld),
  };
}
