import { Request, Response } from 'express';
import { AuthenticatedRequest } from './authController';
import { prisma } from '../db';
import { PricingStrategy } from '../services/pricingService';
import { ContractService, ContractData } from '../services/contractService';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configure multer storage for admin uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'admin_docs');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `admin-doc-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

export const uploadAdminDoc = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|docx|png|jpg|jpeg|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('PDF, DOCX, TXT, and Images are allowed (max 10MB)'));
  }
}).single('document_file');

/**
 * Dynamic Trip Extension
 */
export const extendBooking = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { bookingId, additionalHours } = req.body;

    if (!bookingId || !additionalHours || additionalHours <= 0) {
      return res.status(400).json({ error: 'bookingId and additionalHours (> 0) are required' });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: true,
        vehicle: {
          include: { type: true, location: true }
        }
      }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.user_id !== userId && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Unauthorized to extend this booking' });
    }

    if (booking.status === 'CANCELLED' || booking.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Cannot extend a cancelled or completed booking' });
    }

    const oldDropoff = new Date(booking.dropoff_time);
    const newDropoff = new Date(oldDropoff.getTime() + additionalHours * 60 * 60 * 1000);

    // Availability Check for the extension window
    const overlap = await prisma.booking.findFirst({
      where: {
        vehicle_id: booking.vehicle_id,
        id: { not: bookingId },
        status: { not: 'CANCELLED' },
        pickup_time: { lt: newDropoff },
        dropoff_time: { gt: oldDropoff }
      }
    });

    if (overlap) {
      return res.status(400).json({ error: 'The vehicle is reserved by another customer during this extension period.' });
    }

    // Calculate extension pricing using PricingStrategy
    const extensionPricing = PricingStrategy.calculatePrice(
      oldDropoff,
      newDropoff,
      booking.vehicle.type.base_price_per_hour,
      booking.vehicle.type.base_price_per_day,
      booking.vehicle.location.hub_name
    );

    const newTotalPrice = booking.total_price + extensionPricing.totalPrice;
    const newExtendedHours = booking.extended_hours + additionalHours;

    // Update Booking
    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        dropoff_time: newDropoff,
        total_price: newTotalPrice,
        extended_hours: newExtendedHours
      }
    });

    // Regenerate Puppeteer PDF
    const contractData: ContractData = {
      bookingId: booking.id,
      customerName: booking.user.full_name,
      customerAadhaar: booking.user.aadhaar_number || 'XXXXXXXXXXXX',
      customerPhone: booking.user.phone,
      vehicleMakeModel: `${booking.vehicle.make} ${booking.vehicle.model}`,
      licensePlate: booking.vehicle.license_plate,
      pickupLocation: booking.vehicle.location.hub_name,
      pickupTime: new Date(booking.pickup_time).toLocaleString('en-IN'),
      dropoffTime: newDropoff.toLocaleString('en-IN'),
      totalCost: newTotalPrice
    };

    let agreementUrl = booking.agreement_pdf_url;
    try {
      agreementUrl = await ContractService.generateAgreementPDF(contractData);
      await prisma.booking.update({
        where: { id: bookingId },
        data: { agreement_pdf_url: agreementUrl }
      });
    } catch (pdfErr) {
      console.error('Failed to regenerate contract PDF:', pdfErr);
    }

    return res.status(200).json({
      message: 'Booking extended successfully',
      booking: {
        ...updatedBooking,
        agreement_pdf_url: agreementUrl
      },
      extensionFare: extensionPricing.totalPrice
    });
  } catch (error: any) {
    console.error('Error extending booking:', error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * IoT Vehicle Telematics Controls
 */
export const controlVehicleTelemetry = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { vehicleId, command, speedLimit } = req.body;

    if (!vehicleId || !command) {
      return res.status(400).json({ error: 'vehicleId and command are required' });
    }

    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    let is_locked = vehicle.is_locked;
    let engine_disabled = vehicle.engine_disabled;
    let limit = vehicle.speed_limit;

    if (command === 'LOCK') is_locked = true;
    else if (command === 'UNLOCK') is_locked = false;
    else if (command === 'IMMOBILIZE') engine_disabled = true;
    else if (command === 'MOBILIZE') engine_disabled = false;

    if (speedLimit !== undefined && speedLimit !== null) {
      limit = parseInt(speedLimit);
    }

    const updated = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        is_locked,
        engine_disabled,
        speed_limit: limit
      }
    });

    return res.status(200).json({
      message: `IoT Command ${command} dispatched successfully`,
      vehicle: updated
    });
  } catch (error: any) {
    console.error('Error in telemetry controls:', error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Host Analytics Dashboard
 */
export const getHostDashboard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }

    // Find host owned vehicles
    const vehicles = await prisma.vehicle.findMany({
      where: { host_id: userId },
      include: {
        bookings: {
          where: { status: { not: 'CANCELLED' } }
        }
      }
    });

    let totalBookings = 0;
    let grossEarnings = 0;
    let totalActiveHours = 0;

    vehicles.forEach(v => {
      totalBookings += v.bookings.length;
      v.bookings.forEach(b => {
        grossEarnings += b.total_price;
        const diffHours = Math.ceil((new Date(b.dropoff_time).getTime() - new Date(b.pickup_time).getTime()) / (1000 * 60 * 60));
        totalActiveHours += diffHours;
      });
    });

    const hostShare = grossEarnings * 0.60; // 60% host revenue split

    // Calculate simulated occupancy percentage
    // (Total booked hours in last 30 days / (30 days * 24h * num_vehicles))
    const totalPossibleHours = 30 * 24 * (vehicles.length || 1);
    const mockOccupancyRate = vehicles.length > 0 
      ? Math.min(Math.round((totalActiveHours / totalPossibleHours) * 100), 100) 
      : 0;

    // Simulate reviews feedback
    const simulatedFeedback = [
      { rating: 5, comment: 'Super clean vehicle, picking up from airport was extremely smooth.', author: 'Rahul S.', date: '2026-06-15' },
      { rating: 4, comment: 'Great mileage on SG Highway trip. Well maintained.', author: 'Pooja M.', date: '2026-06-20' },
      { rating: 5, comment: 'Highly recommended Host! Prompt and responsive remote unlock.', author: 'Jayesh B.', date: '2026-06-24' }
    ];

    return res.status(200).json({
      metrics: {
        vehicleCount: vehicles.length,
        totalBookings,
        grossEarnings,
        hostShare,
        occupancyRate: mockOccupancyRate || 35 // fallback to a baseline of 35% if fresh listing
      },
      vehicles: vehicles.map(v => ({
        id: v.id,
        make: v.make,
        model: v.model,
        license_plate: v.license_plate,
        bookingsCount: v.bookings.length,
        status: v.status
      })),
      feedback: simulatedFeedback
    });
  } catch (error: any) {
    console.error('Error fetching host dashboard:', error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Vehicle Handover Pre-trip Checklist
 */
export const completeBookingHandover = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { bookingId, fuelLevel, scratches } = req.body;

    if (!bookingId || fuelLevel === undefined || !scratches) {
      return res.status(400).json({ error: 'bookingId, fuelLevel, and scratches list are required' });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized checklist completion' });
    }

    // Update Booking Handover parameters
    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        pickup_fuel: parseInt(fuelLevel),
        pickup_scratches: JSON.stringify(scratches),
        handover_completed: true,
        status: 'ACTIVE'
      }
    });

    // Update Vehicle state to reflect booked status, current fuel, and logged scratches
    await prisma.vehicle.update({
      where: { id: booking.vehicle_id },
      data: {
        status: 'BOOKED',
        is_locked: false, // auto unlock on successful check-in handover!
        current_fuel: parseInt(fuelLevel),
        scratches: JSON.stringify(scratches)
      }
    });

    return res.status(200).json({
      message: 'Vehicle handover check-in completed. Remote door unlocked!',
      booking: updatedBooking
    });
  } catch (error: any) {
    console.error('Error during vehicle handover check-in:', error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Admin Upload User Documents
 */
export const uploadAdminUserDoc = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, docName } = req.body;
    const file = req.file;

    if (!userId || !docName || !file) {
      return res.status(400).json({ error: 'userId, docName, and document_file are required' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'Customer user not found' });
    }

    let docsList = [];
    if (user.admin_documents) {
      try {
        docsList = JSON.parse(user.admin_documents);
      } catch (e) {
        docsList = [];
      }
    }

    const newDoc = {
      name: docName,
      url: `/uploads/admin_docs/${file.filename}`,
      uploadedAt: new Date().toISOString()
    };

    docsList.push(newDoc);

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        admin_documents: JSON.stringify(docsList)
      }
    });

    return res.status(200).json({
      message: 'Document uploaded and attached successfully!',
      documents: docsList
    });
  } catch (error: any) {
    console.error('Error uploading admin document:', error);
    return res.status(500).json({ error: error.message });
  }
};
