import { Request, Response } from 'express';
import { AuthenticatedRequest } from './authController';
import { prisma } from '../db';
import { PricingStrategy } from '../services/pricingService';
import { ContractService, ContractData } from '../services/contractService';

/**
 * Fetch all location hubs
 */
export const getLocations = async (req: Request, res: Response) => {
  try {
    const locations = await prisma.location.findMany();
    return res.status(200).json(locations);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Fetch available vehicles for a location and datetime range
 */
export const getAvailableVehicles = async (req: Request, res: Response) => {
  try {
    const { pickup_time, dropoff_time, location_id } = req.query;

    if (!pickup_time || !dropoff_time || !location_id) {
      return res.status(400).json({ error: 'pickup_time, dropoff_time, and location_id are required parameters' });
    }

    const pickupDate = new Date(pickup_time as string);
    const dropoffDate = new Date(dropoff_time as string);

    if (isNaN(pickupDate.getTime()) || isNaN(dropoffDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date formats for pickup_time or dropoff_time' });
    }

    if (pickupDate >= dropoffDate) {
      return res.status(400).json({ error: 'Dropoff time must be strictly after pickup time' });
    }

    // Step 1: Find all overlapping bookings for this period
    // Overlap condition: booking.pickup_time < requested.dropoff_time AND booking.dropoff_time > requested.pickup_time
    const overlappingBookings = await prisma.booking.findMany({
      where: {
        status: { not: 'CANCELLED' },
        pickup_time: { lt: dropoffDate },
        dropoff_time: { gt: pickupDate }
      },
      select: {
        vehicle_id: true
      }
    });

    const bookedVehicleIds = overlappingBookings.map(b => b.vehicle_id);

    // Step 2: Retrieve all vehicles at this location that are not in the booked list
    const vehicles = await prisma.vehicle.findMany({
      where: {
        location_id: location_id as string,
        status: 'AVAILABLE',
        id: { notIn: bookedVehicleIds }
      },
      include: {
        type: true,
        location: true
      }
    });

    // Step 3: Map pricing dynamically using PricingStrategy and parse JSON strings
    const vehiclesWithPricing = vehicles.map(vehicle => {
      const pricing = PricingStrategy.calculatePrice(
        pickupDate,
        dropoffDate,
        vehicle.type.base_price_per_hour,
        vehicle.type.base_price_per_day,
        vehicle.location.hub_name
      );

      return {
        ...vehicle,
        features: typeof vehicle.features === 'string' ? JSON.parse(vehicle.features) : vehicle.features,
        images: typeof vehicle.images === 'string' ? JSON.parse(vehicle.images) : vehicle.images,
        pricing
      };
    });

    return res.status(200).json(vehiclesWithPricing);
  } catch (error: any) {
    console.error('Error fetching available vehicles:', error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Create a new vehicle booking (preventing double booking via transactional safety)
 */
export const createBooking = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }

    const { vehicle_id, pickup_time, dropoff_time, esign_completed } = req.body;

    if (!vehicle_id || !pickup_time || !dropoff_time) {
      return res.status(400).json({ error: 'vehicle_id, pickup_time, and dropoff_time are required' });
    }

    const pickupDate = new Date(pickup_time);
    const dropoffDate = new Date(dropoff_time);

    if (pickupDate >= dropoffDate) {
      return res.status(400).json({ error: 'Dropoff time must be after pickup time' });
    }

    // Retrieve User and verify KYC status
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.kyc_status !== 'VERIFIED') {
      return res.status(403).json({
        error: 'KYC Verification Required',
        kyc_status: user.kyc_status
      });
    }

    // Retrieve Vehicle and Type details
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicle_id },
      include: { type: true, location: true }
    });

    if (!vehicle || vehicle.status === 'MAINTENANCE') {
      return res.status(400).json({ error: 'Vehicle is unavailable or undergoing maintenance' });
    }

    // Step 4: Perform transactional availability check to prevent race conditions
    const booking = await prisma.$transaction(async (tx) => {
      // Recheck overlaps inside transaction
      const overlap = await tx.booking.findFirst({
        where: {
          vehicle_id,
          status: { not: 'CANCELLED' },
          pickup_time: { lt: dropoffDate },
          dropoff_time: { gt: pickupDate }
        }
      });

      if (overlap) {
        throw new Error('Vehicle was booked by another user during this request session');
      }

      // Calculate final pricing
      const pricing = PricingStrategy.calculatePrice(
        pickupDate,
        dropoffDate,
        vehicle.type.base_price_per_hour,
        vehicle.type.base_price_per_day,
        vehicle.location.hub_name
      );

      // Create Booking record
      const newBooking = await tx.booking.create({
        data: {
          user_id: userId,
          vehicle_id,
          pickup_time: pickupDate,
          dropoff_time: dropoffDate,
          total_price: pricing.totalPrice,
          status: 'CONFIRMED',
          esign_completed: esign_completed === true
        }
      });

      return { newBooking, pricing };
    });

    // Step 5: Generate PDF Rental Agreement asynchronously using Puppeteer
    const contractData: ContractData = {
      bookingId: booking.newBooking.id,
      customerName: user.full_name,
      customerAadhaar: user.aadhaar_number || 'XXXXXXXXXXXX',
      customerPhone: user.phone,
      vehicleMakeModel: `${vehicle.make} ${vehicle.model}`,
      licensePlate: vehicle.license_plate,
      pickupLocation: vehicle.location.hub_name,
      pickupTime: pickupDate.toLocaleString('en-IN'),
      dropoffTime: dropoffDate.toLocaleString('en-IN'),
      totalCost: booking.pricing.totalPrice
    };

    let agreementUrl = '';
    try {
      agreementUrl = await ContractService.generateAgreementPDF(contractData);
      // Update booking with the PDF URL
      await prisma.booking.update({
        where: { id: booking.newBooking.id },
        data: { agreement_pdf_url: agreementUrl }
      });
    } catch (pdfErr) {
      console.error('Failed to generate contract PDF:', pdfErr);
      // Fail gracefully
    }

    return res.status(201).json({
      message: 'Booking created successfully',
      booking: {
        ...booking.newBooking,
        agreement_pdf_url: agreementUrl || null
      },
      pricing: booking.pricing
    });
  } catch (error: any) {
    console.error('Booking creation error:', error);
    return res.status(400).json({ error: error.message || 'Error occurred while creating booking' });
  }
};

/**
 * Onboard a new vehicle (Admin only)
 */
export const addVehicle = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { type_id, location_id, license_plate, make, model, year, features, images } = req.body;

    if (!type_id || !location_id || !license_plate || !make || !model || !year) {
      return res.status(400).json({ error: 'All primary vehicle details are required' });
    }

    // Verify unique license plate
    const existing = await prisma.vehicle.findUnique({ where: { license_plate } });
    if (existing) {
      return res.status(400).json({ error: 'A vehicle with this license plate is already registered' });
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        type_id,
        location_id,
        license_plate,
        make,
        model,
        year: parseInt(year),
        features: JSON.stringify(features || []),
        images: JSON.stringify(images || []),
        status: 'AVAILABLE'
      }
    });

    return res.status(201).json({
      message: 'Vehicle onboarded successfully',
      vehicle
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Edit an existing vehicle (Admin only)
 */
export const editVehicle = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { type_id, location_id, license_plate, make, model, year, features, images, status, speed_limit } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Vehicle ID is required' });
    }

    const existingVehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!existingVehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    if (license_plate && license_plate !== existingVehicle.license_plate) {
      const duplicatePlate = await prisma.vehicle.findUnique({ where: { license_plate } });
      if (duplicatePlate) {
        return res.status(400).json({ error: 'Another vehicle with this license plate is already registered' });
      }
    }

    const updated = await prisma.vehicle.update({
      where: { id },
      data: {
        type_id: type_id || undefined,
        location_id: location_id || undefined,
        license_plate: license_plate || undefined,
        make: make || undefined,
        model: model || undefined,
        year: year ? parseInt(year) : undefined,
        features: features ? JSON.stringify(features) : undefined,
        images: images ? JSON.stringify(images) : undefined,
        status: status || undefined,
        speed_limit: speed_limit !== undefined ? parseInt(speed_limit) : undefined
      }
    });

    return res.status(200).json({
      message: 'Vehicle updated successfully',
      vehicle: updated
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};


/**
 * Fetch administration dashboard analytics
 */
export const getAdminDashboard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Totals
    const totalVehicles = await prisma.vehicle.count();
    const totalUsers = await prisma.user.count({ where: { role: 'CUSTOMER' } });
    const totalBookings = await prisma.booking.count();

    // Fleet distribution status
    const availableCount = await prisma.vehicle.count({ where: { status: 'AVAILABLE' } });
    const bookedCount = await prisma.vehicle.count({ where: { status: 'BOOKED' } });
    const maintenanceCount = await prisma.vehicle.count({ where: { status: 'MAINTENANCE' } });

    // Active/Completed Bookings total revenue
    const revenueSum = await prisma.booking.aggregate({
      where: { status: { in: ['CONFIRMED', 'ACTIVE', 'COMPLETED'] } },
      _sum: { total_price: true }
    });

    // List all vehicles with details
    const vehicles = await prisma.vehicle.findMany({
      include: {
        type: true,
        location: true
      }
    });

    // Parse JSON features/images for dashboard
    const mappedVehicles = vehicles.map(v => ({
      ...v,
      features: typeof v.features === 'string' ? JSON.parse(v.features) : v.features,
      images: typeof v.images === 'string' ? JSON.parse(v.images) : v.images
    }));

    // List recent bookings
    const recentBookings = await prisma.booking.findMany({
      take: 10,
      orderBy: { pickup_time: 'desc' },
      include: {
        user: { select: { full_name: true, email: true } },
        vehicle: { select: { make: true, model: true, license_plate: true } }
      }
    });

    // Locations and Types for onboarding forms
    const locations = await prisma.location.findMany();
    const vehicleTypes = await prisma.vehicleType.findMany();

    return res.status(200).json({
      metrics: {
        totalVehicles,
        totalUsers,
        totalBookings,
        revenue: revenueSum._sum.total_price || 0,
        statusDistribution: {
          AVAILABLE: availableCount,
          BOOKED: bookedCount,
          MAINTENANCE: maintenanceCount
        }
      },
      vehicles: mappedVehicles,
      recentBookings,
      locations,
      vehicleTypes
    });
  } catch (error: any) {
    console.error('Error fetching admin dashboard:', error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Fetch authenticated user bookings history
 */
export const getMyBookings = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }

    const bookings = await prisma.booking.findMany({
      where: { user_id: userId },
      orderBy: { pickup_time: 'desc' },
      include: {
        vehicle: {
          include: {
            type: true,
            location: true
          }
        }
      }
    });

    const parsedBookings = bookings.map(b => {
      const v = b.vehicle;
      return {
        ...b,
        vehicle: {
          ...v,
          features: typeof v.features === 'string' ? JSON.parse(v.features) : v.features,
          images: typeof v.images === 'string' ? JSON.parse(v.images) : v.images
        }
      };
    });

    return res.status(200).json(parsedBookings);
  } catch (error: any) {
    console.error('Error fetching user bookings:', error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Register user-listed vehicle (Host Onboarding)
 */
export const addHostVehicle = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }

    const { type_id, location_id, license_plate, make, model, year, features, images } = req.body;

    if (!type_id || !location_id || !license_plate || !make || !model || !year) {
      return res.status(400).json({ error: 'All primary vehicle details are required' });
    }

    // Verify unique license plate
    const existing = await prisma.vehicle.findUnique({ where: { license_plate } });
    if (existing) {
      return res.status(400).json({ error: 'A vehicle with this license plate is already registered' });
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        type_id,
        location_id,
        host_id: userId, // associate this customer as host
        license_plate,
        make,
        model,
        year: parseInt(year),
        features: JSON.stringify(features || []),
        images: JSON.stringify(images || []),
        status: 'AVAILABLE'
      }
    });

    return res.status(201).json({
      message: 'Your vehicle has been successfully cataloged for hosting!',
      vehicle
    });
  } catch (error: any) {
    console.error('Error onboarding host vehicle:', error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Fetch GPS telematics parameters for live tracking dashboard
 */
export const getVehiclesGPS = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const region = (req.query.region as string || 'ahmedabad').toLowerCase();

    const vehicles = await prisma.vehicle.findMany({
      include: {
        location: true,
        type: true
      }
    });

    const parsedVehicles = vehicles.map(v => {
      const timeSec = Date.now() / 1000;
      // Oscillate coordinates slightly around the hub location to simulate live movement if booked
      const isBooked = v.status === 'BOOKED' || v.license_plate === 'GJ-01-SE-1357'; // Force simulate motion for one car too
      const jitterLat = Math.sin(timeSec / 10 + v.license_plate.charCodeAt(0)) * 0.005;
      const jitterLng = Math.cos(timeSec / 12 + v.license_plate.charCodeAt(1)) * 0.005;

      const speed = isBooked ? Math.floor(45 + Math.sin(timeSec / 5) * 12) : 0;
      const engine = isBooked ? 'ON' : 'OFF';
      const fuel = isBooked ? Math.floor(75 + Math.sin(timeSec / 100) * 10) : 92;
      const bearing = Math.floor((timeSec * 5 + v.license_plate.charCodeAt(2) * 10) % 360);

      // Default Ahmedabad coordinates
      let baseLat = v.location.latitude;
      let baseLng = v.location.longitude;
      let hubName = v.location.hub_name;

      if (region === 'ny') {
        // Map Ahmedabad hubs to NY hubs dynamically for NY tracking simulation
        if (v.location.hub_name.includes('Airport')) {
          baseLat = 40.7769; // LaGuardia Airport (LGA)
          baseLng = -73.8740;
          hubName = 'LaGuardia Airport Hub (LGA)';
        } else if (v.location.hub_name.includes('SG Highway')) {
          baseLat = 40.7580; // Times Square / Midtown
          baseLng = -73.9855;
          hubName = 'Times Square Hub (Manhattan)';
        } else if (v.location.hub_name.includes('Prahlad')) {
          baseLat = 40.6976; // Brooklyn
          baseLng = -73.9796;
          hubName = 'Brooklyn Hub (DUMBO)';
        } else {
          baseLat = 40.6413; // JFK Airport
          baseLng = -73.7781;
          hubName = 'JFK Airport Arrivals Hub';
        }
      }

      return {
        id: v.id,
        make: v.make,
        model: v.model,
        license_plate: v.license_plate,
        status: v.status,
        category: v.type.category_name,
        hubName,
        is_locked: v.is_locked,
        engine_disabled: v.engine_disabled,
        speed_limit: v.speed_limit,
        telemetry: {
          latitude: baseLat + (isBooked ? jitterLat : 0),
          longitude: baseLng + (isBooked ? jitterLng : 0),
          speed,
          engine,
          fuel,
          bearing
        }
      };
    });

    return res.status(200).json(parsedVehicles);
  } catch (error: any) {
    console.error('Error fetching GPS telematics:', error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Fetch all customer KYC upload submissions
 */
export const getUsersKYC = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        role: 'CUSTOMER',
        aadhaar_number: { not: null }
      },
      orderBy: { created_at: 'desc' }
    });

    // Exclude password hashes
    const cleanedUsers = users.map(u => {
      const { password_hash, ...rest } = u;
      return rest;
    });

    return res.status(200).json(cleanedUsers);
  } catch (error: any) {
    console.error('Error fetching KYC documents:', error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Approve or Reject customer KYC submissions
 */
export const verifyUserKYC = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, status } = req.body;

    if (!userId || !status) {
      return res.status(400).json({ error: 'userId and status are required' });
    }

    if (!['VERIFIED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'Status must be VERIFIED or REJECTED' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { kyc_status: status }
    });

    return res.status(200).json({
      message: `User KYC status updated to ${status} successfully!`,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        kyc_status: updatedUser.kyc_status
      }
    });
  } catch (error: any) {
    console.error('Error verifying user KYC:', error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Simulated Aadhaar e-Sign verification flow
 */
export const esignBooking = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { bookingId, aadhaarNumber, otp } = req.body;

    if (!bookingId || !aadhaarNumber || !otp) {
      return res.status(400).json({ error: 'bookingId, aadhaarNumber, and otp are required' });
    }

    if (otp !== '123456') {
      return res.status(400).json({ error: 'Invalid Aadhaar OTP entered. Please enter 123456 to sign.' });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { user: true, vehicle: true }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking details not found' });
    }

    // Update booking state
    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: { esign_completed: true }
    });

    return res.status(200).json({
      message: 'Aadhaar e-Sign Completed successfully!',
      booking: updated
    });
  } catch (error: any) {
    console.error('Aadhaar e-sign error:', error);
    return res.status(500).json({ error: error.message });
  }
};



