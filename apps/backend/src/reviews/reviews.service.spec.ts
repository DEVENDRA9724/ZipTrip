import { ReviewsService } from './reviews.service';

describe('ReviewsService', () => {
  it('only accepts a completed customer booking and prevents duplicate vehicle reviews', async () => {
    const prisma: any = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({ id: 'booking-1', customerId: 'customer-1', vehicleId: 'vehicle-1', status: 'COMPLETED', vehicle: {} }),
      },
      review: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'review-1', rating: 5 }),
      },
    };
    const result = await new ReviewsService(prisma).create('customer-1', { bookingId: 'booking-1', rating: 5, comment: 'Clean car' });
    expect(result).toEqual({ id: 'review-1', rating: 5 });
    expect(prisma.review.create).toHaveBeenCalledWith({ data: { authorId: 'customer-1', vehicleId: 'vehicle-1', rating: 5, comment: 'Clean car' } });
  });

  it('rejects a review from the wrong user', async () => {
    const prisma: any = { booking: { findUnique: jest.fn().mockResolvedValue({ id: 'booking-1', customerId: 'other', vehicleId: 'vehicle-1', status: 'COMPLETED', vehicle: {} }) } };
    await expect(new ReviewsService(prisma).create('customer-1', { bookingId: 'booking-1', rating: 5 })).rejects.toThrow('Only the customer');
  });

  it('lets a completed customer booking rate its host', async () => {
    const prisma: any = {
      booking: { findUnique: jest.fn().mockResolvedValue({ id: 'booking-1', customerId: 'customer-1', status: 'COMPLETED', vehicle: { hostId: 'host-1' } }) },
      partyRating: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'rating-1', targetRole: 'HOST', rating: 5 }),
      },
    };
    const result = await new ReviewsService(prisma).createParty({ id: 'customer-1', role: 'CUSTOMER' }, { bookingId: 'booking-1', targetRole: 'HOST', rating: 5 });
    expect(result).toEqual({ id: 'rating-1', targetRole: 'HOST', rating: 5 });
    expect(prisma.partyRating.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ bookingId: 'booking-1', authorId: 'customer-1', targetId: 'host-1', targetRole: 'HOST', rating: 5 }) }));
  });

  it('lets the vehicle host rate the completed customer', async () => {
    const prisma: any = {
      booking: { findUnique: jest.fn().mockResolvedValue({ id: 'booking-1', customerId: 'customer-1', status: 'COMPLETED', vehicle: { hostId: 'host-1' } }) },
      partyRating: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ targetRole: 'CUSTOMER', rating: 4 }) },
    };
    await new ReviewsService(prisma).createParty({ id: 'host-1', role: 'HOST' }, { bookingId: 'booking-1', targetRole: 'CUSTOMER', rating: 4, comment: 'Returned on time' });
    expect(prisma.partyRating.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ targetId: 'customer-1', targetRole: 'CUSTOMER' }) }));
  });

  it('rejects a party rating from an unrelated account', async () => {
    const prisma: any = { booking: { findUnique: jest.fn().mockResolvedValue({ id: 'booking-1', customerId: 'customer-1', status: 'COMPLETED', vehicle: { hostId: 'host-1' } }) } };
    await expect(new ReviewsService(prisma).createParty({ id: 'other', role: 'HOST' }, { bookingId: 'booking-1', targetRole: 'CUSTOMER', rating: 5 })).rejects.toThrow('vehicle host');
  });
});
