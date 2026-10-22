-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "phoneVerifiedAt" DATETIME,
    "otpCodeHash" TEXT,
    "otpExpiresAt" DATETIME,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CUSTOMER',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "profileImage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "dlValidUntil" DATETIME
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT 'Ahmedabad',
    "state" TEXT NOT NULL DEFAULT 'Gujarat',
    "postalCode" TEXT,
    "aadhaarNumberHash" TEXT,
    "aadhaarNumberMasked" TEXT,
    "panNumberHash" TEXT,
    "panNumberMasked" TEXT,
    "drivingLicenseHash" TEXT,
    "drivingLicenseMasked" TEXT,
    "dlExpiryDate" DATETIME,
    "profileImageUrl" TEXT,
    "selfieMediaId" TEXT,
    "faceMatchScore" REAL,
    "faceMatchStatus" TEXT DEFAULT 'UNVERIFIED',
    "isKycVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Hub" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hubName" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "address" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "VehicleModel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brand" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "transmission" TEXT NOT NULL,
    "fuelType" TEXT NOT NULL,
    "seatingCapacity" INTEGER NOT NULL,
    "baseHourlyRate" DECIMAL NOT NULL,
    "freeKmPerHour" INTEGER NOT NULL DEFAULT 12,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hostId" TEXT NOT NULL,
    "modelSpecId" TEXT,
    "currentHubId" TEXT,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "transmission" TEXT NOT NULL,
    "fuelType" TEXT NOT NULL,
    "seats" INTEGER NOT NULL,
    "pricePerDay" DECIMAL NOT NULL,
    "extraKmCharge" DECIMAL NOT NULL DEFAULT 12,
    "includedKilometresPerDay" INTEGER NOT NULL DEFAULT 300,
    "securityDeposit" DECIMAL NOT NULL DEFAULT 2000,
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "serviceType" TEXT NOT NULL DEFAULT 'self_drive',
    "locationCity" TEXT NOT NULL,
    "pickupAddress" TEXT,
    "dropAddress" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "images" TEXT NOT NULL,
    "features" TEXT,
    "vinNumber" TEXT,
    "gpsDeviceImei" TEXT,
    "fuelLevelPercent" INTEGER NOT NULL DEFAULT 100,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "registrationNumber" TEXT,
    "odometer" INTEGER NOT NULL DEFAULT 0,
    "reviewNote" TEXT,
    "approvalStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "availability" TEXT NOT NULL DEFAULT 'INACTIVE',
    "availabilityReason" TEXT,
    "approvedById" TEXT,
    "approvedAt" DATETIME,
    "rejectedReason" TEXT,
        CONSTRAINT "Vehicle_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Vehicle_modelSpecId_fkey" FOREIGN KEY ("modelSpecId") REFERENCES "VehicleModel" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Vehicle_currentHubId_fkey" FOREIGN KEY ("currentHubId") REFERENCES "Hub" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AvailabilityBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "reason" TEXT NOT NULL,
    "releasedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AvailabilityBlock_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingRef" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT,
    "pickupHubId" TEXT,
    "dropoffHubId" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "tenureHours" INTEGER NOT NULL DEFAULT 24,
    "serviceType" TEXT NOT NULL DEFAULT 'self_drive',
    "baseFare" DECIMAL NOT NULL DEFAULT 0,
    "securityDeposit" DECIMAL NOT NULL DEFAULT 0,
    "insuranceFee" DECIMAL NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL NOT NULL DEFAULT 0,
    "platformFee" DECIMAL NOT NULL DEFAULT 0,
    "hostRevenue" DECIMAL NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME,
    "requestKey" TEXT,
    "dailyRate" DECIMAL NOT NULL DEFAULT 0,
    "rentalDays" INTEGER NOT NULL DEFAULT 1,
    "includedKilometres" INTEGER,
    "agreementVersion" TEXT NOT NULL DEFAULT 'safarcars-car-sharing-v2',
    "agreementSnapshot" TEXT,
    "agreementAcceptedAt" DATETIME,
    CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Booking_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Booking_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Booking_pickupHubId_fkey" FOREIGN KEY ("pickupHubId") REFERENCES "Hub" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Booking_dropoffHubId_fkey" FOREIGN KEY ("dropoffHubId") REFERENCES "Hub" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "actualStartTime" DATETIME,
    "actualEndTime" DATETIME,
    "startOdometer" INTEGER,
    "endOdometer" INTEGER,
    "startFuelLevel" INTEGER,
    "endFuelLevel" INTEGER,
    "startChecklistImages" TEXT,
    "endChecklistImages" TEXT,
    "startSelfieUrl" TEXT,
    "endSelfieUrl" TEXT,
    "extraKmDriven" INTEGER NOT NULL DEFAULT 0,
    "extraHours" DECIMAL NOT NULL DEFAULT 0.0,
    "penaltyCharges" DECIMAL NOT NULL DEFAULT 0.0,
    "tripStatus" TEXT NOT NULL DEFAULT 'not_started',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Trip_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TripTelematics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tripId" TEXT NOT NULL,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "speedKmph" DECIMAL,
    "fuelLevel" INTEGER,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TripTelematics_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "kind" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Media_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Media_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "kind" TEXT NOT NULL,
    "documentNumberMasked" TEXT,
    "documentFrontUrl" TEXT,
    "documentBackUrl" TEXT,
    "mediaId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "source" TEXT NOT NULL DEFAULT 'UPLOAD',
    "providerSessionId" TEXT,
    "validUntil" DATETIME,
    "reviewNote" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Document_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KycSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "consentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consentVersion" TEXT NOT NULL DEFAULT 'rental-kyc-v1',
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "KycSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'PAID',
    "snapshot" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invoice_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "odometer" INTEGER NOT NULL,
    "mediaId" TEXT NOT NULL,
    "mediaIds" TEXT,
    "selfieMediaId" TEXT,
    "note" TEXT,
    "fuelPercent" INTEGER,
    "damageNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Inspection_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "gatewayProvider" TEXT NOT NULL DEFAULT 'Razorpay',
    "paymentType" TEXT NOT NULL DEFAULT 'booking_fare',
    "amount" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "authorId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Review_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Review_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "balance" DECIMAL NOT NULL DEFAULT 0.00,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PartyRating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetRole" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PartyRating_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PartyRating_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PartyRating_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "bookingId" TEXT,
    "metadata" TEXT,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PayoutAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "accountHolderName" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumberLast4" TEXT NOT NULL,
    "ifscCode" TEXT NOT NULL,
    "encryptedAccountNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "fingerprint" TEXT,
    "changedById" TEXT,
    "changedAt" DATETIME,
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "verifiedRevision" INTEGER,
    CONSTRAINT "PayoutAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reference" TEXT,
    "periodStart" DATETIME,
    "periodEnd" DATETIME,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME,
    "destinationState" TEXT NOT NULL DEFAULT 'RECONCILIATION_REQUIRED',
    "destinationAccountHolderName" TEXT,
    "destinationBankName" TEXT,
    "destinationIfscCode" TEXT,
    "destinationAccountNumberLast4" TEXT,
    "destinationEncryptedAccountNumber" TEXT,
    "destinationFingerprint" TEXT,
    "destinationAccountRevision" INTEGER,
    "destinationCapturedAt" DATETIME,
    CONSTRAINT "Payout_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PayoutAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BookingSettlement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "depositHeld" DECIMAL NOT NULL,
    "automaticCharges" DECIMAL NOT NULL DEFAULT 0,
    "damageCharges" DECIMAL NOT NULL DEFAULT 0,
    "fuelCharges" DECIMAL NOT NULL DEFAULT 0,
    "tollCharges" DECIMAL NOT NULL DEFAULT 0,
    "fineCharges" DECIMAL NOT NULL DEFAULT 0,
    "cleaningCharges" DECIMAL NOT NULL DEFAULT 0,
    "otherCharges" DECIMAL NOT NULL DEFAULT 0,
    "totalDeduction" DECIMAL NOT NULL DEFAULT 0,
    "refundAmount" DECIMAL NOT NULL DEFAULT 0,
    "additionalAmountDue" DECIMAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "reviewedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BookingSettlement_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_phone_email_idx" ON "User"("phone", "email");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_aadhaarNumberHash_key" ON "UserProfile"("aadhaarNumberHash");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_panNumberHash_key" ON "UserProfile"("panNumberHash");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_drivingLicenseHash_key" ON "UserProfile"("drivingLicenseHash");

-- CreateIndex
CREATE INDEX "Hub_city_isActive_idx" ON "Hub"("city", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleModel_brand_modelName_transmission_fuelType_key" ON "VehicleModel"("brand", "modelName", "transmission", "fuelType");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_vinNumber_key" ON "Vehicle"("vinNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_gpsDeviceImei_key" ON "Vehicle"("gpsDeviceImei");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_registrationNumber_key" ON "Vehicle"("registrationNumber");

-- CreateIndex
CREATE INDEX "Vehicle_locationCity_status_idx" ON "Vehicle"("locationCity", "status");

-- CreateIndex
CREATE INDEX "Vehicle_approvalStatus_availability_idx" ON "Vehicle"("approvalStatus", "availability");
CREATE INDEX "Vehicle_currentHubId_status_idx" ON "Vehicle"("currentHubId", "status");

-- CreateIndex
CREATE INDEX "AvailabilityBlock_vehicleId_startDate_endDate_idx" ON "AvailabilityBlock"("vehicleId", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_bookingRef_key" ON "Booking"("bookingRef");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_requestKey_key" ON "Booking"("requestKey");

-- CreateIndex
CREATE INDEX "Booking_customerId_status_idx" ON "Booking"("customerId", "status");

-- CreateIndex
CREATE INDEX "Booking_vehicleId_startDate_endDate_status_idx" ON "Booking"("vehicleId", "startDate", "endDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Trip_bookingId_key" ON "Trip"("bookingId");

-- CreateIndex
CREATE INDEX "TripTelematics_tripId_recordedAt_idx" ON "TripTelematics"("tripId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Media_storageKey_key" ON "Media"("storageKey");

-- CreateIndex
CREATE INDEX "Media_ownerId_vehicleId_idx" ON "Media"("ownerId", "vehicleId");

-- CreateIndex
CREATE INDEX "Document_userId_kind_status_idx" ON "Document"("userId", "kind", "status");

-- CreateIndex
CREATE UNIQUE INDEX "KycSession_providerId_key" ON "KycSession"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_bookingId_key" ON "Invoice"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Inspection_bookingId_stage_key" ON "Inspection"("bookingId", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_bookingId_key" ON "Payment"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_transactionId_key" ON "Payment"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- CreateIndex
CREATE INDEX "PartyRating_targetId_createdAt_idx" ON "PartyRating"("targetId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PartyRating_bookingId_authorId_targetId_key" ON "PartyRating"("bookingId", "authorId", "targetId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutAccount_userId_key" ON "PayoutAccount"("userId");

-- CreateIndex
CREATE INDEX "Payout_accountId_status_idx" ON "Payout"("accountId", "status");

-- CreateIndex
CREATE INDEX "Payout_destinationState_idx" ON "Payout"("destinationState");

-- CreateIndex
CREATE UNIQUE INDEX "BookingSettlement_bookingId_key" ON "BookingSettlement"("bookingId");

-- CreateIndex
CREATE INDEX "BookingSettlement_status_createdAt_idx" ON "BookingSettlement"("status", "createdAt");
