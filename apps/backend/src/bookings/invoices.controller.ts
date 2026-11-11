import { Controller, Get, Param, Request, UseGuards, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  constructor(private prisma: PrismaService) {}

  @Get(':id')
  async get(@Request() req: any, @Param('id') id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        OR: [{ id }, { bookingId: id }, { number: id }],
      },
      include: {
        booking: {
          include: {
            vehicle: {
              include: {
                host: {
                  select: { firstName: true, lastName: true, email: true, phone: true }
                },
                documents: true,
                currentHub: true,
              }
            },
            customer: {
              select: { firstName: true, lastName: true, email: true, phone: true }
            },
            payment: true,
          }
        }
      }
    });

    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.booking.customerId !== req.user.id && invoice.booking.vehicle.hostId !== req.user.id && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Invoice access denied');
    }

    const { booking, snapshot, ...result } = invoice;
    let details: any = {};
    try {
      details = JSON.parse(snapshot || '{}');
    } catch {
      details = {};
    }

    const vehicle = booking.vehicle;
    const host = vehicle.host;
    const customer = booking.customer;

    // Extract Registered Car Owner Name as per RC Document if available, otherwise Host name
    const rcDoc = (vehicle.documents || []).find((d: any) => d.kind === 'RC');
    let rcOwnerName = `${host?.firstName || ''} ${host?.lastName || ''}`.trim() || 'Registered Vehicle Owner';
    if (rcDoc?.reviewNote && rcDoc.reviewNote.includes('Owner:')) {
      const match = rcDoc.reviewNote.match(/Owner:\s*([^;,\n]+)/i);
      if (match && match[1]?.trim()) rcOwnerName = match[1].trim();
    }

    const bookingDays = Number(booking.rentalDays) || Number(details.rentalDays) || 1;
    const dailyRate = Number(booking.dailyRate) || Number(details.dailyRate) || 2500;
    const totalBookingFee = Math.round(dailyRate * bookingDays);
    const deposit = Number(booking.securityDeposit) || Number(details.securityDeposit) || 0;
    const totalOwnerPaid = totalBookingFee + deposit;

    // Platform Fees & Tax Breakdown (₹249 Convenience + ₹59 Technology Fee + 18% GST)
    const convenienceFee = 249.00;
    const technologyFee = 59.00;
    const platformTaxable = convenienceFee + technologyFee; // ₹308.00
    const cgstAmount = +(platformTaxable * 0.09).toFixed(2); // ₹27.72
    const sgstAmount = +(platformTaxable * 0.09).toFixed(2); // ₹27.72
    const totalPlatformGst = +(cgstAmount + sgstAmount).toFixed(2); // ₹55.44
    const platformGrandTotal = +(platformTaxable + totalPlatformGst).toFixed(2); // ₹363.44

    const year = new Date(booking.createdAt).getFullYear();
    const cleanRef = (booking.bookingRef || '').replace(/[^A-Z0-9]/gi, '').slice(-6) || invoice.id.slice(0, 6).toUpperCase();

    // 1. CAR OWNER SHARING RECEIPT (No GST, No "rental" word, Original RC Owner Name)
    const ownerReceipt = {
      receiptNumber: `RCP-${booking.bookingRef || invoice.number}`,
      receiptDate: booking.createdAt,
      rcOwnerName,
      ownerPhone: host?.phone || '+91 99090 31177',
      ownerEmail: host?.email || 'host@safarselfdrive.com',
      ownerCity: vehicle.locationCity || vehicle.currentHub?.city || 'Gujarat',
      vehicleMake: vehicle.make,
      vehicleModel: vehicle.model,
      vehicleYear: vehicle.year,
      registrationNumber: vehicle.registrationNumber || 'Gujarat RTO Registered',
      customerName: `${customer?.firstName || ''} ${customer?.lastName || ''}`.trim() || 'Verified Safar Member',
      customerPhone: customer?.phone || '—',
      customerEmail: customer?.email || '—',
      startDate: booking.startDate,
      endDate: booking.endDate,
      bookingDays,
      dailyBookingFee: dailyRate,
      totalBookingFee,
      securityDeposit: deposit,
      totalPaid: totalOwnerPaid,
      includedKm: booking.includedKilometres || 300,
      excessKmRate: 12,
      paymentStatus: booking.payment?.status || 'PAID',
      paymentReference: booking.payment?.transactionId || invoice.id.slice(0, 18),
      taxExemptionNotice: 'Issued by registered vehicle owner for peer-to-peer vehicle sharing compensation under platform community guidelines. This sharing transaction is between private individuals and is not subject to GST under Sections 22 and 23 of the Central Goods & Services Tax (CGST) Act, 2017 (Issued by unregistered vehicle owner).',
    };

    // 2. SAFAR PLATFORM GST TAX INVOICE (Convenience Fee ₹249 + Tech Fee ₹59 + 18% GST)
    const platformInvoice = {
      invoiceNumber: `SAF-TECH-${year}-${cleanRef}`,
      invoiceDate: booking.createdAt,
      bookingRef: booking.bookingRef,
      supplierName: 'Paramount India Technologies / Safar Mobility Solutions',
      supplierGstin: '24AABCS1234F1Z8',
      supplierPan: 'AABCS1234F',
      supplierAddress: 'Suite 402, Pinnacle Business Park, Corporate Road, Prahlad Nagar, SG Highway, Ahmedabad, Gujarat 380015',
      supplierEmail: 'support@safarselfdrive.com',
      supplierPhone: '+91 99090 31177',
      customerName: `${customer?.firstName || ''} ${customer?.lastName || ''}`.trim() || 'Verified Customer',
      customerPhone: customer?.phone || '—',
      customerEmail: customer?.email || '—',
      placeOfSupply: 'Gujarat (State Code 24)',
      convenienceFee,
      convenienceSac: '998314',
      technologyFee,
      technologySac: '998313',
      taxableAmount: platformTaxable,
      cgstRate: '9%',
      cgstAmount,
      sgstRate: '9%',
      sgstAmount,
      totalGst: totalPlatformGst,
      grandTotal: platformGrandTotal,
      statutoryDeclaration: 'Tax invoice issued under Section 31 of CGST Act, 2017 for platform convenience, software access, and digital verification services. Reverse Charge Mechanism: No.',
    };

    return {
      ...result,
      bookingRef: booking.bookingRef,
      details,
      ownerReceipt,
      platformInvoice,
    };
  }
}
