import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { register, login, authenticateJWT, requireAdmin } from './controllers/authController';
import { uploadKYC, verifyKYC } from './controllers/kycController';
import {
  getLocations,
  getAvailableVehicles,
  createBooking,
  addVehicle,
  editVehicle,
  getAdminDashboard,
  getMyBookings,
  addHostVehicle,
  getVehiclesGPS,
  getUsersKYC,
  verifyUserKYC,
  esignBooking
} from './controllers/vehicleController';
import {
  extendBooking,
  controlVehicleTelemetry,
  getHostDashboard,
  completeBookingHandover,
  uploadAdminDoc,
  uploadAdminUserDoc
} from './controllers/advancedController';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root API welcome route
app.get('/', (req, res) => {
  res.json({
    status: 'active',
    message: 'ZipTrip Backend API is running successfully'
  });
});

// Serve static assets (KYC uploads, contract PDFs, etc.)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Authentication Routes
app.post('/api/auth/register', register);
app.post('/api/auth/login', login);

// KYC Verification Route
app.post('/api/kyc/verify', authenticateJWT, uploadKYC, verifyKYC);

// Vehicle & Booking Routes
app.get('/api/locations', getLocations);
app.get('/api/vehicles/available', getAvailableVehicles);
app.post('/api/bookings/create', authenticateJWT, createBooking);
app.get('/api/bookings/my', authenticateJWT, getMyBookings);
app.post('/api/bookings/extend', authenticateJWT, extendBooking);
app.post('/api/bookings/handover', authenticateJWT, completeBookingHandover);
app.post('/api/bookings/esign', authenticateJWT, esignBooking);

// Host Vehicle & Dashboard Routes
app.post('/api/host/vehicles/add', authenticateJWT, addHostVehicle);
app.get('/api/host/dashboard', authenticateJWT, getHostDashboard);

// Administration Routes
app.post('/api/admin/vehicles/add', authenticateJWT, requireAdmin, addVehicle);
app.put('/api/admin/vehicles/edit/:id', authenticateJWT, requireAdmin, editVehicle);
app.get('/api/admin/dashboard', authenticateJWT, requireAdmin, getAdminDashboard);
app.get('/api/admin/vehicles/gps', authenticateJWT, requireAdmin, getVehiclesGPS);
app.post('/api/admin/vehicles/telemetry/control', authenticateJWT, requireAdmin, controlVehicleTelemetry);
app.get('/api/admin/users/kyc', authenticateJWT, requireAdmin, getUsersKYC);
app.post('/api/admin/users/kyc/verify', authenticateJWT, requireAdmin, verifyUserKYC);
app.post('/api/admin/users/documents/upload', authenticateJWT, requireAdmin, uploadAdminDoc, uploadAdminUserDoc);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error occurred' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`[ZipTrip Backend] Server running on http://localhost:${PORT}`);
});
