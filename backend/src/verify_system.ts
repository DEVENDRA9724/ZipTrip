import { PricingStrategy } from './services/pricingService';

function testPricing() {
  console.log('--- Testing Pricing Strategy Engine ---');

  // Test Case 1: Weekday Swift Hatchback (50/hr, 1000/day) - 4 hours, Non-airport
  const pickupWeekday = new Date('2026-06-29T10:00:00'); // Monday 10:00 AM
  const dropoffWeekday = new Date('2026-06-29T14:00:00'); // Monday 2:00 PM
  const result1 = PricingStrategy.calculatePrice(pickupWeekday, dropoffWeekday, 50, 1000, 'SG Highway Hub');

  console.assert(result1.baseFare === 200, `Expected base fare to be 200, got ${result1.baseFare}`);
  console.assert(result1.weekendSurge === false, 'Expected no weekend surge');
  console.assert(result1.airportSurge === false, 'Expected no airport surge');
  console.assert(result1.totalPrice === 200, `Expected total price to be 200, got ${result1.totalPrice}`);
  console.log('✓ Test Case 1 Passed: Weekday 4 hours, standard hub.');

  // Test Case 2: Weekend Swift Hatchback (50/hr, 1000/day) - 4 hours, Non-airport
  const pickupWeekend = new Date('2026-06-27T10:00:00'); // Saturday 10:00 AM
  const dropoffWeekend = new Date('2026-06-27T14:00:00'); // Saturday 2:00 PM
  const result2 = PricingStrategy.calculatePrice(pickupWeekend, dropoffWeekend, 50, 1000, 'SG Highway Hub');

  console.assert(result2.baseFare === 200, `Expected base fare to be 200, got ${result2.baseFare}`);
  console.assert(result2.weekendSurge === true, 'Expected weekend surge');
  console.assert(result2.weekendSurgeAmount === 40, `Expected weekend surge to be 40, got ${result2.weekendSurgeAmount}`);
  console.assert(result2.totalPrice === 240, `Expected total price to be 240, got ${result2.totalPrice}`);
  console.log('✓ Test Case 2 Passed: Weekend 4 hours (20% surge).');

  // Test Case 3: Weekday Verna Sedan (75/hr, 1600/day) - 4 hours, Airport Hub
  const result3 = PricingStrategy.calculatePrice(pickupWeekday, dropoffWeekday, 75, 1600, 'AMD Airport Arrivals Hub');

  console.assert(result3.baseFare === 300, `Expected base fare to be 300, got ${result3.baseFare}`);
  console.assert(result3.airportSurge === true, 'Expected airport surge');
  console.assert(result3.airportSurgeAmount === 45, `Expected airport surge to be 45, got ${result3.airportSurgeAmount}`);
  console.assert(result3.totalPrice === 345, `Expected total price to be 345, got ${result3.totalPrice}`);
  console.log('✓ Test Case 3 Passed: Weekday 4 hours, Airport Hub (+15% surge).');

  // Test Case 4: Weekend Verna Sedan (75/hr, 1600/day) - 4 hours, Airport Hub (Double surge)
  const result4 = PricingStrategy.calculatePrice(pickupWeekend, dropoffWeekend, 75, 1600, 'AMD Airport Arrivals Hub');

  console.assert(result4.baseFare === 300, `Expected base fare to be 300, got ${result4.baseFare}`);
  console.assert(result4.weekendSurge === true, 'Expected weekend surge');
  console.assert(result4.airportSurge === true, 'Expected airport surge');
  // Weekend surge: 20% of 300 = 60
  // Airport surge: 15% of 300 = 45
  // Total: 300 + 60 + 45 = 405
  console.assert(result4.weekendSurgeAmount === 60, `Expected weekend surge 60, got ${result4.weekendSurgeAmount}`);
  console.assert(result4.airportSurgeAmount === 45, `Expected airport surge 45, got ${result4.airportSurgeAmount}`);
  console.assert(result4.totalPrice === 405, `Expected total 405, got ${result4.totalPrice}`);
  console.log('✓ Test Case 4 Passed: Weekend 4 hours, Airport Hub (Double surge, total 35%).');

  // Test Case 5: 2-Day Booking (exceeds 18 hours, daily rate: 1000/day)
  const pickupLong = new Date('2026-06-29T10:00:00'); // Monday
  const dropoffLong = new Date('2026-07-01T10:00:00'); // Wednesday
  const result5 = PricingStrategy.calculatePrice(pickupLong, dropoffLong, 50, 1000, 'SG Highway Hub');

  console.assert(result5.baseFare === 2000, `Expected daily base fare 2000, got ${result5.baseFare}`);
  console.log('✓ Test Case 5 Passed: Multi-day booking daily rate scaling.');
}

try {
  testPricing();
  console.log('\nAll Pricing tests completed successfully!');
} catch (error) {
  console.error('Pricing test failed:', error);
}
