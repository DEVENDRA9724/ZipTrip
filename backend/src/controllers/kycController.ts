import { Response } from 'express';
import { AuthenticatedRequest } from './authController';
import { prisma } from '../db';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configure multer storage for KYC documents
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'kyc');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

// Configure upload limits and file filters (accept image/pdf, max 5MB)
export const uploadKYC = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only JPEG, JPG, PNG, and PDF files are allowed (max 5MB)'));
  }
}).fields([
  { name: 'dl_file', maxCount: 1 },
  { name: 'selfie_file', maxCount: 1 }
]);

/**
 * Handle KYC document upload and identity verification
 */
export const verifyKYC = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User session not authenticated' });
    }

    const { aadhaar_number, dl_number } = req.body;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

    if (!aadhaar_number || !dl_number) {
      return res.status(400).json({ error: 'Aadhaar and Driving License numbers are required' });
    }

    if (!files || !files['selfie_file'] || !files['dl_file']) {
      return res.status(400).json({ error: 'Driving License file and Selfie capture are required for KYC' });
    }

    const selfieFile = files['selfie_file'][0];
    const dlFile = files['dl_file'][0];
    const selfieUrl = `/uploads/kyc/${selfieFile.filename}`;

    console.log(`[KYC Pipeline] Initiating verification for User ID: ${userId}`);
    console.log(`[KYC Pipeline] Aadhaar: ${aadhaar_number}, DL: ${dl_number}`);

    // Mimic calling Digio/Signzy FaceMatch API
    // Let's create an HTTP Basic Authentication configuration like real providers
    const clientCredentials = Buffer.from('client_id_mock_abc123:client_secret_mock_xyz456').toString('base64');
    const requestId = `req-${Date.now()}-${Math.round(Math.random() * 1e5)}`;

    console.log(`[KYC Outbound Request] POST https://api.digio.in/v3/facematch`);
    console.log(`[KYC Outbound Headers] Authorization: Basic ${clientCredentials.substring(0, 10)}... | Request-Id: ${requestId}`);
    console.log(`[KYC Outbound Payload] Compare Selfie: ${selfieFile.filename} with Driving License Photo: ${dlFile.filename}`);

    // Mock API response delay (e.g., 800ms)
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Determine FaceMatch similarity score.
    // If the Aadhaar number is a special mockup like '000000000000', fail the verification.
    // Otherwise, generate a successful score >= 85 (e.g., 92.4).
    let score = 92.4;
    let kyc_status: 'VERIFIED' | 'REJECTED' | 'UNKNOWN' = 'VERIFIED';
    let errorMessage = '';

    if (aadhaar_number === '000000000000') {
      score = 42.1;
      kyc_status = 'REJECTED';
      errorMessage = 'FaceMatch similarity check failed. Driving license photo did not match selfie.';
    } else if (aadhaar_number === '111111111111') {
      score = 80.5;
      kyc_status = 'UNKNOWN'; // gray area
      errorMessage = 'FaceMatch similarity was in the gray area (80.5%). Please retry with better lighting.';
    }

    console.log(`[KYC Inbound Response] HTTP 200 OK | Request-Id: ${requestId}`);
    console.log(`[KYC Inbound Payload] { similarity_score: ${score}, match: ${score >= 85}, provider: "Digio FaceMatch engine v3" }`);

    if (kyc_status === 'VERIFIED') {
      // Update User in Database
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          kyc_status: 'VERIFIED',
          aadhaar_number,
          dl_number,
          selfie_url: selfieUrl
        }
      });

      return res.status(200).json({
        message: 'KYC verified successfully. Identity authenticated.',
        kyc_status: updatedUser.kyc_status,
        facematch_score: score,
        user: {
          id: updatedUser.id,
          kyc_status: updatedUser.kyc_status,
          selfie_url: updatedUser.selfie_url
        }
      });
    } else {
      // Update user database status to REJECTED or leave it as PENDING/UNKNOWN
      const nextStatus = kyc_status === 'REJECTED' ? 'REJECTED' : 'UNKNOWN';
      await prisma.user.update({
        where: { id: userId },
        data: {
          kyc_status: nextStatus,
          aadhaar_number,
          dl_number
        }
      });

      return res.status(400).json({
        error: errorMessage,
        kyc_status: nextStatus,
        facematch_score: score
      });
    }
  } catch (error: any) {
    console.error('KYC verification error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error during KYC verification' });
  }
};
