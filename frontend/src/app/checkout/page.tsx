'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '../../store/store';
import {
  ShieldAlert,
  CheckCircle,
  FileText,
  UserCheck,
  CreditCard,
  Download,
  AlertCircle,
  MapPin,
  Calendar,
  Lock,
  ArrowRight,
  Loader2,
  Fingerprint,
  Check,
  PenTool,
  XCircle
} from 'lucide-react';
import Link from 'next/link';

export default function Checkout() {
  const router = useRouter();
  const {
    user,
    selectedVehicle,
    searchParams,
    currentBooking,
    createBooking,
    verifyKYC,
    loading,
    error,
    clearError,
    setAuthModalOpen
  } = useStore();

  // Delivery options
  const [deliveryType, setDeliveryType] = useState<'hub' | 'doorstep'>('hub');
  const [deliveryArea, setDeliveryArea] = useState('bopal');
  const [deliveryAddress, setDeliveryAddress] = useState('');

  // KYC Inputs
  const [aadhaarNum, setAadhaarNum] = useState('');
  const [dlNum, setDlNum] = useState('');
  const [dlFile, setDlFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);

  // e-KYC Verification States
  const [isKycAadhaarVerified, setIsKycAadhaarVerified] = useState(false);
  const [showKycOtpModal, setShowKycOtpModal] = useState(false);
  const [kycOtpCode, setKycOtpCode] = useState('');
  const [kycOtpError, setKycOtpError] = useState<string | null>(null);
  const [kycOtpLoading, setKycOtpLoading] = useState(false);

  const handleStartKycEsign = () => {
    if (aadhaarNum.length !== 12) {
      alert("Please enter a valid 12-digit Aadhaar number first.");
      return;
    }
    setKycOtpCode('');
    setKycOtpError(null);
    setKycOtpLoading(false);
    setShowKycOtpModal(true);
  };

  const handleVerifyKycOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (kycOtpCode !== '123456') {
      setKycOtpError('Invalid Aadhaar OTP. Enter testing code: 123456');
      return;
    }
    setKycOtpError(null);
    setKycOtpLoading(true);
    setTimeout(() => {
      setIsKycAadhaarVerified(true);
      setShowKycOtpModal(false);
      setKycOtpLoading(false);
    }, 600);
  };

  // Sign contract State
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [eSignStep, setESignStep] = useState<'checkout' | 'signing' | 'success'>('checkout');

  // Checkout Aadhaar e-Sign States
  const [showCheckoutEsignModal, setShowCheckoutEsignModal] = useState(false);
  const [esignAadhaarNumber, setEsignAadhaarNumber] = useState('');
  const [esignOtp, setEsignOtp] = useState('');
  const [esignConsent, setEsignConsent] = useState(false);
  const [esignError, setEsignError] = useState<string | null>(null);
  const [esignStep, setEsignStep] = useState<'aadhaar' | 'otp' | 'success'>('aadhaar');
  const [esignLoading, setEsignLoading] = useState(false);

  const handleStartCheckoutEsign = () => {
    if (!agreeTerms) {
      alert("Please agree to the contract terms before signing.");
      return;
    }
    setEsignAadhaarNumber('');
    setEsignOtp('');
    setEsignStep('aadhaar');
    setEsignConsent(false);
    setEsignError(null);
    setEsignLoading(false);
    setShowCheckoutEsignModal(true);
  };

  const handleRequestCheckoutOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (esignAadhaarNumber.length !== 12) {
      setEsignError('Please enter a valid 12-digit Aadhaar number.');
      return;
    }
    if (!esignConsent) {
      setEsignError('You must consent to the e-sign authorization.');
      return;
    }
    setEsignError(null);
    setEsignLoading(true);
    setTimeout(() => {
      setEsignStep('otp');
      setEsignLoading(false);
    }, 800);
  };

  const handleVerifyCheckoutEsign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle || !searchParams) return;
    if (esignOtp !== '123456') {
      setEsignError('Invalid Aadhaar OTP. Enter testing code: 123456');
      return;
    }
    setEsignError(null);
    setEsignLoading(true);
    const success = await createBooking(
      selectedVehicle.id,
      searchParams.pickupTime,
      searchParams.dropoffTime,
      true // esignCompleted
    );
    setEsignLoading(false);
    if (success) {
      setShowCheckoutEsignModal(false);
    } else {
      setEsignError('Booking reservation failed. Please verify your connection.');
    }
  };

  // Sync state for booking success
  useEffect(() => {
    if (currentBooking) {
      setESignStep('success');
    }
  }, [currentBooking]);

  if (!selectedVehicle || !searchParams) {
    return (
      <div className="max-w-md mx-auto mt-20 p-6 bg-white border border-slate-200 rounded-xl text-center shadow-sm">
        <ShieldAlert className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-800">No Booking Active</h3>
        <p className="text-slate-500 text-sm mt-2">Please go back to search and select a vehicle to rent.</p>
        <Link href="/" className="mt-4 inline-flex items-center gap-1.5 text-sm bg-brand-600 hover:bg-brand-700 text-white font-semibold px-4 py-2 rounded-lg shadow-md transition-all">
          Find Cars
        </Link>
      </div>
    );
  }

  // Auth Wall
  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 bg-white border border-slate-200 rounded-2xl text-center shadow-lg animate-fade-in-up">
        <Lock className="w-12 h-12 text-brand-600 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-800">Authentication Required</h3>
        <p className="text-slate-500 text-sm mt-2 leading-relaxed">
          You must be logged in to reserve a self-drive car and submit your documents for KYC clearance.
        </p>
        <button
          onClick={() => setAuthModalOpen(true)}
          className="mt-6 w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-2.5 rounded-xl text-sm transition-all shadow-md shadow-brand-500/10 cursor-pointer"
        >
          Sign In / Sign Up
        </button>
      </div>
    );
  }

  // Delivery Fee Calculation
  const getDeliveryFee = () => {
    if (deliveryType === 'hub') return 0;
    switch (deliveryArea) {
      case 'bopal': return 300;
      case 'chandkheda': return 250;
      case 'naroda': return 350;
      default: return 0;
    }
  };

  const getFinalTotal = () => {
    return selectedVehicle.pricing!.totalPrice + getDeliveryFee();
  };

  const handleKYCSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (!isKycAadhaarVerified) {
      alert('Please verify your Aadhaar number via NSDL e-KYC OTP first.');
      return;
    }

    if (!dlFile || !selfieFile) {
      alert('Please upload your Driving License and capture/select a Selfie.');
      return;
    }

    const formData = new FormData();
    formData.append('aadhaar_number', aadhaarNum);
    formData.append('dl_number', dlNum);
    formData.append('dl_file', dlFile);
    formData.append('selfie_file', selfieFile);

    await verifyKYC(formData);
  };

  const handleCreateBooking = async () => {
    if (!agreeTerms) return;
    clearError();
    setESignStep('signing');

    // Simulate digital stamping and certificate procurement
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const success = await createBooking(
      selectedVehicle.id,
      searchParams.pickupTime,
      searchParams.dropoffTime
    );

    if (!success) {
      setESignStep('checkout');
    }
  };

  return (
    <div className="max-width-container py-10">
      <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-8">Confirm Booking & Checkout</h2>

      {eSignStep === 'success' && currentBooking ? (
        /* Booking Confirmation Panel */
        <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden p-8 text-center">
          <div className="w-16 h-16 bg-success-50 text-success-500 rounded-full flex items-center justify-center mx-auto mb-6 border border-success-500/20">
            <CheckCircle size={36} />
          </div>
          <h3 className="text-2xl font-extrabold text-slate-900">Booking Confirmed!</h3>
          <p className="text-slate-600 mt-2">
            Your vehicle has been successfully reserved. A legally binding car rental agreement has been compiled and executed.
          </p>

          <div className="my-8 bg-slate-50 border border-slate-200 rounded-xl p-5 text-left max-w-lg mx-auto text-sm space-y-3">
            <div className="flex justify-between border-b border-slate-200/60 pb-2">
              <span className="text-slate-500">Booking Ref ID:</span>
              <span className="font-mono font-semibold text-slate-800">{currentBooking.id}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200/60 pb-2">
              <span className="text-slate-500">Legal Stamping ID:</span>
              <span className="font-mono font-semibold text-slate-800">IN-GJ92837492837492U</span>
            </div>
            <div className="flex justify-between border-b border-slate-200/60 pb-2">
              <span className="text-slate-500">Vehicle Registered:</span>
              <span className="font-semibold text-slate-800">{selectedVehicle.make} {selectedVehicle.model} ({selectedVehicle.license_plate})</span>
            </div>
            <div className="flex justify-between pb-1">
              <span className="text-slate-500">Total Fare Paid:</span>
              <span className="font-bold text-slate-900">₹{getFinalTotal()}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {currentBooking.agreement_pdf_url && (
              <a
                href={`http://localhost:5000${currentBooking.agreement_pdf_url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto bg-brand-600 hover:bg-brand-700 text-white font-bold px-6 py-3 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <Download size={16} /> Open Rental Agreement PDF
              </a>
            )}
            <Link
              href="/"
              className="w-full sm:w-auto border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-6 py-3 rounded-lg transition-all"
            >
              Go to Homepage
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Main Form Area */}
          <div className="lg:col-span-2 space-y-8">
            {/* Step 1: Doorstep Delivery Settings */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <MapPin size={18} className="text-brand-600" /> 1. Delivery & Fulfillment Mode
              </h3>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <button
                  type="button"
                  onClick={() => setDeliveryType('hub')}
                  className={`border p-4 rounded-xl text-left transition-all ${deliveryType === 'hub' ? 'border-brand-600 bg-brand-50/50 shadow-sm' : 'border-slate-200 hover:bg-slate-50'}`}
                >
                  <p className="font-bold text-slate-800 text-sm">Self Pickup</p>
                  <p className="text-xs text-slate-500 mt-1">Collect vehicle directly from the operational hub.</p>
                  <p className="text-xs font-bold text-brand-600 mt-2">Free</p>
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryType('doorstep')}
                  className={`border p-4 rounded-xl text-left transition-all ${deliveryType === 'doorstep' ? 'border-brand-600 bg-brand-50/50 shadow-sm' : 'border-slate-200 hover:bg-slate-50'}`}
                >
                  <p className="font-bold text-slate-800 text-sm">Doorstep Delivery</p>
                  <p className="text-xs text-slate-500 mt-1">Delivered to your home, office, or residential address.</p>
                  <p className="text-xs font-bold text-brand-600 mt-2">Starts from ₹250</p>
                </button>
              </div>

              {deliveryType === 'doorstep' && (
                <div className="space-y-4 border-t border-slate-100 pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Select Delivery Hub Zone</label>
                      <select
                        value={deliveryArea}
                        onChange={(e) => setDeliveryArea(e.target.value)}
                        className="w-full h-11 border border-slate-200 rounded-lg px-3 text-sm focus:border-brand-600 focus:outline-none bg-white font-medium"
                      >
                        <option value="bopal">Bopal Area (₹300 fee)</option>
                        <option value="chandkheda">Chandkheda Area (₹250 fee)</option>
                        <option value="naroda">Naroda Area (₹350 fee)</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Exact Delivery Address</label>
                    <textarea
                      required
                      rows={2}
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Flat/House number, Building name, Sector, Neighborhood, Ahmedabad"
                      className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:border-brand-600 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: KYC Identity Verification */}
            {user.kyc_status !== 'VERIFIED' ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                  <UserCheck size={18} className="text-amber-600" /> 2. KYC Document Verification (Required)
                </h3>
                <p className="text-xs text-slate-500 mb-6">
                  In compliance with RBI regulations and self-drive leasing laws in India. Identity is analyzed via facial recognition mapping comparing selfie streams to official driving license uploads.
                </p>

                {error && (
                  <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded-lg p-3 text-sm mb-6 flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleKYCSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-end">
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Aadhaar Card Number</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          required
                          disabled={isKycAadhaarVerified}
                          maxLength={12}
                          value={aadhaarNum}
                          onChange={(e) => setAadhaarNum(e.target.value.replace(/\D/g, ''))}
                          placeholder="12-digit number"
                          className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-brand-600 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500 font-bold"
                        />
                        {isKycAadhaarVerified ? (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1">
                            <Check size={14} /> Verified
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={handleStartKycEsign}
                            disabled={aadhaarNum.length !== 12}
                            className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer shrink-0"
                          >
                            Verify via OTP
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Driving License No</label>
                      <input
                        type="text"
                        required
                        value={dlNum}
                        onChange={(e) => setDlNum(e.target.value)}
                        placeholder="GJ0120220034567"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:border-brand-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  {isKycAadhaarVerified && (
                    <div className="p-3 bg-brand-50 border border-brand-100 rounded-xl text-[11px] text-brand-700 space-y-1">
                      <p className="font-bold flex items-center gap-1">
                        <CheckCircle size={14} className="text-brand-600" /> e-KYC Data Retrieved from UIDAI:
                      </p>
                      <p className="font-mono text-[10px] pl-5">
                        Name: Devendra Kumar | DOB: 15-08-1995 | Address: Ahmedabad, Gujarat, India
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-t border-slate-100 pt-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">Driving License Front (Image/PDF)</label>
                      <input
                        type="file"
                        required
                        onChange={(e) => setDlFile(e.target.files?.[0] || null)}
                        className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">Real-Time Selfie Capture</label>
                      <input
                        type="file"
                        required
                        onChange={(e) => setSelfieFile(e.target.files?.[0] || null)}
                        className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                      />
                    </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-lg leading-relaxed">
                    <strong>Demo Alert:</strong> Entering Aadhaar <strong>000000000000</strong> will trigger a mock FaceMatch failure (score &lt; 85) to demonstrate reject cases. Standard input will match successfully (score &ge; 85).
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !isKycAadhaarVerified}
                    className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Verifying Biometrics (FaceMatch API)...
                      </>
                    ) : (
                      <>
                        Submit Documents & Verify Identity <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </form>
              </div>
            ) : (
              /* Step 3: E-Sign Contract */
              <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                  <FileText size={18} className="text-brand-600" /> 2. e-Sign Car Rental Agreement
                </h3>
                <p className="text-xs text-slate-500 mb-6">
                  Please review the legal terms of bailment and authorize electronically. This digital signature is legally binding under Section 10-A of the IT Act, 2000.
                </p>

                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 text-xs text-slate-600 space-y-4 max-h-60 overflow-y-auto mb-6 leading-relaxed">
                  <p className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">Legal Terms of Bailment (Sections 148-181 of Indian Contract Act, 1872)</p>
                  <p>
                    <strong>1. Scope of Use:</strong> The Renter agrees that they are the primary driver of the vehicle. Under no circumstances shall the vehicle be sub-leased, hired, or lent to another driver. The driver warrants that they possess a valid license for operating this vehicle category in India.
                  </p>
                  <p>
                    <strong>2. Geographical Boundaries:</strong> The vehicle must remain within the physical borders of India. Operations outside local designated zones without written permit authorizations are strictly prohibited.
                  </p>
                  <p>
                    <strong>3. Indemnification:</strong> The Renter agrees to indemnify, save, and hold harmless ZipTrip and the host vehicle owner from any and all damages, claims, traffic fines, legal proceedings, and towage charges incurred during the booking period.
                  </p>
                  <p>
                    <strong>4. Stamping & Executions:</strong> This contract is digitally stamped with INR 100 denomination. The OTP verification constitutes Aadhaar-linked electronic signature consent.
                  </p>
                </div>

                <div className="space-y-6">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={(e) => setAgreeTerms(e.target.checked)}
                      className="mt-1 rounded text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-sm text-slate-600 select-none">
                      I agree to the terms of the car rental bailment contract, and authorize ZipTrip to stamp and sign this document using my Aadhaar-linked identity.
                    </span>
                  </label>

                  {error && (
                    <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded-lg p-3 text-sm">
                      {error}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleStartCheckoutEsign}
                    disabled={!agreeTerms}
                    className="w-full bg-brand-600 hover:bg-brand-700 text-white font-extrabold py-3 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50 cursor-pointer"
                  >
                    Confirm Booking & Aadhaar e-Sign <CreditCard size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Booking Summary Sidebar */}
          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl border border-slate-800">
            <h3 className="text-lg font-bold border-b border-slate-800 pb-3 mb-4">Rental Summary</h3>

            {/* Vehicle Details */}
            <div className="flex items-center gap-4 mb-6">
              <img
                src={selectedVehicle.images[0]}
                alt={selectedVehicle.make}
                className="w-16 h-12 object-cover rounded bg-slate-800"
              />
              <div>
                <p className="font-bold text-sm leading-tight">{selectedVehicle.make} {selectedVehicle.model}</p>
                <p className="text-xs text-slate-400 mt-1 uppercase font-semibold">{selectedVehicle.license_plate}</p>
              </div>
            </div>

            {/* Date Details */}
            <div className="space-y-4 mb-6 border-b border-slate-800 pb-6 text-sm">
              <div className="flex items-start gap-3">
                <MapPin size={16} className="text-brand-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase">Pickup Location Hub</p>
                  <p className="font-medium text-slate-200 mt-0.5">{selectedVehicle.location.hub_name}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar size={16} className="text-brand-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase">Commences</p>
                  <p className="font-medium text-slate-200 mt-0.5">{new Date(searchParams.pickupTime).toLocaleString('en-IN')}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar size={16} className="text-brand-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase">Expires</p>
                  <p className="font-medium text-slate-200 mt-0.5">{new Date(searchParams.dropoffTime).toLocaleString('en-IN')}</p>
                </div>
              </div>
            </div>

            {/* Fare Breakdown */}
            <div className="space-y-2.5 text-xs text-slate-400 border-b border-slate-800 pb-6 mb-6">
              <div className="flex justify-between text-slate-200 text-sm">
                <span>Base Fare:</span>
                <span>₹{selectedVehicle.pricing!.baseFare}</span>
              </div>
              {selectedVehicle.pricing!.airportSurge && (
                <div className="flex justify-between text-brand-300">
                  <span>Airport Hub Modifer (+15%):</span>
                  <span>+₹{selectedVehicle.pricing!.airportSurgeAmount}</span>
                </div>
              )}
              {selectedVehicle.pricing!.weekendSurge && (
                <div className="flex justify-between text-indigo-300">
                  <span>Weekend Surcharge (+20%):</span>
                  <span>+₹{selectedVehicle.pricing!.weekendSurgeAmount}</span>
                </div>
              )}
              {deliveryType === 'doorstep' && (
                <div className="flex justify-between text-emerald-300">
                  <span>Doorstep Delivery:</span>
                  <span>+₹{getDeliveryFee()}</span>
                </div>
              )}
            </div>

            {/* Total */}
            <div className="flex justify-between items-baseline mb-4">
              <span className="text-sm font-bold uppercase tracking-wider text-slate-400">Total Price:</span>
              <span className="text-3xl font-black text-white">₹{getFinalTotal()}</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              Includes unlimited kilometers, state taxes, general third party insurance, and dynamic surges.
            </p>
          </div>
        </div>
      )}

      {/* Checkout Aadhaar e-Sign Gateway Modal (NSDL Style) */}
      {showCheckoutEsignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in-up">
          <div className="bg-white rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl relative border border-slate-100 flex flex-col md:flex-row min-h-[460px]">
            <button
              onClick={() => setShowCheckoutEsignModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer z-10 p-1 bg-slate-50 hover:bg-slate-100 rounded-full"
            >
              <XCircle size={20} className="text-slate-400" />
            </button>

            {/* Left Column: NSDL certified provider banner */}
            <div className="md:w-5/12 bg-slate-900 text-white p-6 flex flex-col justify-between border-r border-slate-800">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center font-black text-xs text-brand-300">
                    NSDL
                  </div>
                  <div>
                    <h5 className="font-extrabold text-[10px] uppercase tracking-wider text-slate-400 leading-none">e-Sign Gateway</h5>
                    <p className="text-[8px] text-slate-500 font-semibold mt-0.5 leading-none">CCA CERTIFIED PROVIDER</p>
                  </div>
                </div>

                <div className="pt-6 space-y-3">
                  <span className="text-[9px] bg-brand-500/20 text-brand-300 font-bold px-2 py-0.5 rounded uppercase tracking-wider">Document for Signing</span>
                  <h4 className="font-extrabold text-sm leading-snug">ZipTrip Vehicle Bailment & Rental Agreement</h4>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <FileText size={14} className="shrink-0" />
                    <span className="font-mono text-[9px] truncate">Ref: PENDING_CONFIRMATION</span>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-800 text-[10px] text-slate-400 leading-relaxed">
                <p>This e-Sign gateway utilizes NSDL e-Governance services to authenticate identity and execute legal signatures in accordance with Section 3A of the Information Technology Act.</p>
              </div>
            </div>

            {/* Right Column: OTP Form */}
            <div className="md:w-7/12 p-8 flex flex-col justify-between">
              {esignStep === 'aadhaar' && (
                <form onSubmit={handleRequestCheckoutOtp} className="space-y-6 my-auto">
                  <div className="text-center md:text-left">
                    <Fingerprint className="w-10 h-10 text-brand-600 mx-auto md:mx-0 mb-3" />
                    <h3 className="text-lg font-black text-slate-900 leading-tight">Verify Aadhaar Identity</h3>
                    <p className="text-xs text-slate-500 mt-1">Authenticate using your 12-digit Aadhaar number to place your digital signature certificate on the rental agreement.</p>
                  </div>

                  {esignError && (
                    <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded-xl p-3 text-xs font-semibold">
                      {esignError}
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Aadhaar Card Number</label>
                      <input
                        type="text"
                        maxLength={12}
                        required
                        placeholder="e.g. 5432 9876 1234"
                        value={esignAadhaarNumber}
                        onChange={(e) => setEsignAadhaarNumber(e.target.value.replace(/\D/g, ''))}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold tracking-widest focus:border-brand-600 focus:outline-none bg-slate-50 text-slate-700"
                      />
                    </div>

                    <label className="flex items-start gap-2.5 cursor-pointer text-slate-600 select-none">
                      <input
                        type="checkbox"
                        checked={esignConsent}
                        onChange={(e) => setEsignConsent(e.target.checked)}
                        className="rounded text-brand-600 focus:ring-brand-500 mt-0.5 border-slate-300"
                      />
                      <span className="text-[10px] leading-relaxed font-bold">
                        I hereby authorize NSDL e-Sign Gateway to verify my credentials with UIDAI and generate my digital signature certificate for this ZipTrip Rental Agreement.
                      </span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={esignLoading || esignAadhaarNumber.length !== 12 || !esignConsent}
                    className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold py-3 rounded-2xl text-xs transition-all shadow-md shadow-brand-500/10 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {esignLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying Credentials...
                      </>
                    ) : (
                      'Request Aadhaar OTP'
                    )}
                  </button>
                </form>
              )}

              {esignStep === 'otp' && (
                <form onSubmit={handleVerifyCheckoutEsign} className="space-y-6 my-auto">
                  <div className="text-center md:text-left">
                    <h3 className="text-lg font-black text-slate-900 leading-tight">Enter Aadhaar OTP</h3>
                    <p className="text-xs text-slate-500 mt-1">A 6-digit verification code has been dispatched to the mobile number associated with your Aadhaar ending in <strong>******8890</strong>.</p>
                  </div>

                  {esignError && (
                    <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded-xl p-3 text-xs font-semibold">
                      {esignError}
                    </div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Aadhaar OTP (6-digits)</label>
                      <input
                        type="text"
                        maxLength={6}
                        required
                        placeholder="Enter 6-digit OTP code"
                        value={esignOtp}
                        onChange={(e) => setEsignOtp(e.target.value.replace(/\D/g, ''))}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold tracking-widest text-center focus:border-brand-600 focus:outline-none bg-slate-50 text-slate-700"
                      />
                    </div>
                    <p className="text-[10px] text-brand-600 font-bold bg-brand-50 px-3 py-1.5 rounded-lg text-center">
                      🔐 Testing Bypass: Enter code <strong>123456</strong>
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={esignLoading || esignOtp.length !== 6}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3 rounded-2xl text-xs transition-all shadow-md shadow-emerald-500/10 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {esignLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying OTP & Generating Lease...
                      </>
                    ) : (
                      'Verify & Confirm Booking'
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
      {/* KYC Aadhaar e-KYC OTP Gateway Modal */}
      {showKycOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in-up">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl relative p-6 border border-slate-100 space-y-6">
            <button
              onClick={() => setShowKycOtpModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer p-1 bg-slate-50 hover:bg-slate-100 rounded-full"
            >
              <XCircle size={18} />
            </button>

            <div className="text-center">
              <Fingerprint className="w-12 h-12 text-brand-600 mx-auto mb-3" />
              <h3 className="text-lg font-black text-slate-900 leading-tight">NSDL e-KYC Authentication</h3>
              <p className="text-xs text-slate-500 mt-1.5">
                We have dispatched a simulated 6-digit e-KYC OTP to the mobile registered with your Aadhaar Card.
              </p>
            </div>

            {kycOtpError && (
              <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded-xl p-3 text-xs font-semibold">
                {kycOtpError}
              </div>
            )}

            <form onSubmit={handleVerifyKycOtp} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Enter OTP Code</label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  placeholder="Enter 6-digit OTP code"
                  value={kycOtpCode}
                  onChange={(e) => setKycOtpCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold tracking-widest text-center focus:border-brand-600 focus:outline-none bg-slate-50 text-slate-700"
                />
              </div>
              
              <p className="text-[10px] text-brand-600 font-bold bg-brand-50 px-3 py-1.5 rounded-lg text-center">
                🔐 Testing Bypass: Enter code <strong>123456</strong>
              </p>

              <button
                type="submit"
                disabled={kycOtpLoading || kycOtpCode.length !== 6}
                className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl text-xs transition-all shadow-md shadow-brand-500/10 flex items-center justify-center gap-2 cursor-pointer"
              >
                {kycOtpLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying OTP...
                  </>
                ) : (
                  'Verify Aadhaar OTP'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
