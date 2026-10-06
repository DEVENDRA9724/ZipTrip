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
});
