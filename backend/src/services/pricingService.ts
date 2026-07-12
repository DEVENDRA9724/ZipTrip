export interface PricingResult {
  baseFare: number;
  durationHours: number;
  durationDays: number;
  weekendSurge: boolean;
  airportSurge: boolean;
  weekendSurgeAmount: number;
  airportSurgeAmount: number;
  totalPrice: number;
}

export class PricingStrategy {
  /**
   * Check if a date falls in the weekend surge window (Friday 18:00 to Sunday 23:59)
   */
  public static isWeekendWindow(date: Date): boolean {
    const day = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
    const hours = date.getHours();

    if (day === 5 && hours >= 18) {
      return true; // Friday evening
    }
    if (day === 6 || day === 0) {
      return true; // Saturday or Sunday
    }
    return false;
  }

  /**
   * Calculate total price with base rates and surges
   */
  public static calculatePrice(
    pickupTime: Date,
    dropoffTime: Date,
    basePricePerHour: number,
    basePricePerDay: number,
    hubName: string
  ): PricingResult {
    const durationMs = dropoffTime.getTime() - pickupTime.getTime();
    if (durationMs <= 0) {
      throw new Error("Dropoff time must be after pickup time");
    }

    const durationHours = Math.ceil(durationMs / (1000 * 60 * 60));
    const durationDays = durationHours / 24;

    // Determine the base fare: use daily rate if duration exceeds 18 hours, otherwise hourly rate
    let baseFare = 0;
    if (durationHours >= 18) {
      baseFare = Math.ceil(durationDays) * basePricePerDay;
    } else {
      baseFare = durationHours * basePricePerHour;
    }

    // Check for surges
    // 1. Weekend surge: applies 20% multiplier if any part of the trip touches the weekend window
    let weekendSurge = false;
    // Sample pickup, dropoff, and a few points in between to detect weekend
    const checkInterval = 2 * 60 * 60 * 1000; // Check every 2 hours
    for (let time = pickupTime.getTime(); time <= dropoffTime.getTime(); time += checkInterval) {
      if (this.isWeekendWindow(new Date(time))) {
        weekendSurge = true;
        break;
      }
    }
    // Also check the exact dropoff time
    if (!weekendSurge && this.isWeekendWindow(dropoffTime)) {
      weekendSurge = true;
    }

    // 2. Location-based surge: 15% surcharge if pickup location contains "Airport"
    const airportSurge = hubName.toLowerCase().includes("airport");

    let totalPrice = baseFare;
    let weekendSurgeAmount = 0;
    let airportSurgeAmount = 0;

    if (weekendSurge) {
      weekendSurgeAmount = baseFare * 0.20;
      totalPrice += weekendSurgeAmount;
    }

    if (airportSurge) {
      airportSurgeAmount = baseFare * 0.15;
      totalPrice += airportSurgeAmount;
    }

    // Round total price to 2 decimal places
    totalPrice = Math.round(totalPrice * 100) / 100;

    return {
      baseFare: Math.round(baseFare * 100) / 100,
      durationHours,
      durationDays: Math.round(durationDays * 10) / 10,
      weekendSurge,
      airportSurge,
      weekendSurgeAmount: Math.round(weekendSurgeAmount * 100) / 100,
      airportSurgeAmount: Math.round(airportSurgeAmount * 100) / 100,
      totalPrice
    };
  }
}
