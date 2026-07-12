'use client';

import React, { useEffect, useState } from 'react';
import { useStore } from '../../store/store';
import {
  Calendar,
  MapPin,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  Loader2,
  Lock,
  ArrowLeft,
  XCircle,
  HelpCircle,
  ShieldCheck,
  MessageSquare,
  Send,
  PenTool,
  Check,
  Fingerprint,
  FileText
} from 'lucide-react';
import Link from 'next/link';

const API_BASE_URL = 'http://localhost:5000/api';

export default function MyBookings() {
  const { user, token, logout, extendBooking, esignBooking, setAuthModalOpen } = useStore();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Extension Modal States
  const [selectedBookingForExtension, setSelectedBookingForExtension] = useState<string | null>(null);
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [extensionHours, setExtensionHours] = useState(2);
  const [extending, setExtending] = useState(false);
  const [extensionResult, setExtensionResult] = useState<{ success: boolean; fare?: number; error?: string } | null>(null);

  // P2P Masked Chat States
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatBookingId, setChatBookingId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInputText, setChatInputText] = useState('');
  const [chatReplying, setChatReplying] = useState(false);

  // Aadhaar e-Sign States
  const [showEsignModal, setShowEsignModal] = useState(false);
  const [esignBookingId, setEsignBookingId] = useState<string | null>(null);
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [otpText, setOtpText] = useState('');
  const [esignStep, setEsignStep] = useState<'aadhaar' | 'otp' | 'success'>('aadhaar');
  const [esignConsent, setEsignConsent] = useState(false);
  const [esignError, setEsignError] = useState<string | null>(null);
  const [esignLoading, setEsignLoading] = useState(false);

  const handleStartEsign = (bookingId: string) => {
    setEsignBookingId(bookingId);
    setAadhaarNumber('');
    setOtpText('');
    setEsignStep('aadhaar');
    setEsignConsent(false);
    setEsignError(null);
    setEsignLoading(false);
    setShowEsignModal(true);
  };

  const handleRequestOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (aadhaarNumber.length !== 12) {
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

  const handleVerifyEsign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!esignBookingId) return;
    if (otpText !== '123456') {
      setEsignError('Invalid Aadhaar OTP. Enter the testing code: 123456');
      return;
    }
    setEsignError(null);
    setEsignLoading(true);
    const success = await esignBooking(esignBookingId, aadhaarNumber, otpText);
    setEsignLoading(false);
    if (success) {
      setEsignStep('success');
      fetchBookings(); // refresh bookings status
    } else {
      setEsignError('Aadhaar sign verification failed. Please try again.');
    }
  };

  const openHostChat = (booking: any) => {
    setChatBookingId(booking.id);
    setShowChatModal(true);
    setChatMessages([
      {
        id: 1,
        sender: 'host',
        text: `Hello! I am the host of the vehicle. Let me know when you'd like to coordinate handoff! I will meet you at the ${booking.vehicle.location.hub_name}.`
      }
    ]);
  };

  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInputText.trim() || !chatBookingId) return;

    const userText = chatInputText.trim();
    const nextId = chatMessages.length + 1;

    setChatMessages(prev => [...prev, { id: nextId, sender: 'guest', text: userText }]);
    setChatInputText('');
    setChatReplying(true);

    setTimeout(() => {
      let reply = "Perfect! See you there. The car has been cleaned and the fuel tank is filled.";
      const textLower = userText.toLowerCase();
      if (textLower.includes('delay') || textLower.includes('late') || textLower.includes('time')) {
        reply = "No problem! Please make sure to extend the booking in your ZipTrip dashboard if you're running late to avoid automated late penalties.";
      } else if (textLower.includes('where') || textLower.includes('location') || textLower.includes('pick')) {
        reply = "I am currently waiting at the hub parking lot. Look for the ZipTrip sign!";
      }

      setChatMessages(prev => [...prev, {
        id: nextId + 1,
        sender: 'host',
        text: reply
      }]);
      setChatReplying(false);
    }, 1200);
  };

  // Telemetry updates
  const [telemetryTick, setTelemetryTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTelemetryTick(t => t + 1);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const getSimulatedSpeed = (bookingId: string, speedLimit: number) => {
    const base = 80;
    const offset = (telemetryTick + bookingId.charCodeAt(0)) % 10;
    const speed = base + offset * 8; // fluctuates 80-152
    return speed;
  };

  const getLateReturnCalculation = (dropoffTimeStr: string) => {
    const dropoff = new Date(dropoffTimeStr).getTime();
    const now = Date.now();
    const diffMs = now - dropoff;
    if (diffMs <= 0) {
      return { isLate: false, text: "No late penalty active. Returning on time." };
    }
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const penaltyRatePerMin = 10; // ₹10/minute late fee
    const penaltyAmt = diffMins * penaltyRatePerMin;
    return {
      isLate: true,
      minsLate: diffMins,
      penalty: penaltyAmt,
      text: `🚨 VEHICLE RETURN LATE: Overdue by ${diffMins} minutes. Late penalty of ₹${penaltyAmt} applied (charged at ₹10/minute).`
    };
  };

  const fetchBookings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/bookings/my`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.status === 401) {
        logout();
        throw new Error('Your session has expired. Please log in again.');
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to retrieve bookings');
      setBookings(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExtend = async () => {
    if (!selectedBookingForExtension) return;
    setExtending(true);
    setExtensionResult(null);
    const res = await extendBooking(selectedBookingForExtension, extensionHours);
    setExtending(false);
    setExtensionResult(res);
    if (res.success) {
      fetchBookings(); // reload bookings
      setTimeout(() => {
        setShowExtensionModal(false);
        setExtensionResult(null);
      }, 2500);
    }
  };

  useEffect(() => {
    if (token) {
      fetchBookings();
    }
  }, [token]);

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm('Are you sure you want to cancel this self-drive booking? A cancellation fee of 10% may apply.')) {
      return;
    }

    try {
      // For demo, let's update locally first to make it fast, and log it.
      setBookings(prev =>
        prev.map(b => b.id === bookingId ? { ...b, status: 'CANCELLED' } : b)
      );
      alert('Your booking has been successfully cancelled. The refund will be credited to your original payment mode within 5-7 business days.');
    } catch (err: any) {
      alert('Error cancelling booking: ' + err.message);
    }
  };

  if (!token) {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 bg-white border border-slate-200 rounded-2xl text-center shadow-lg animate-fade-in-up">
        <Lock className="w-12 h-12 text-brand-600 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-800">Sign In Required</h3>
        <p className="text-slate-500 text-sm mt-2 leading-relaxed">
          You must be logged in to access your self-drive booking history and agreements.
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-10 h-10 text-brand-600 animate-spin" />
        <p className="text-slate-600 font-medium">Synchronizing your booking records...</p>
      </div>
    );
  }

  return (
    <div className="max-width-container py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">My Rental Bookings</h2>
          <p className="text-sm text-slate-500 mt-1">Review active trips, download e-stamped legal contracts, and manage cancellations.</p>
        </div>
        <Link href="/" className="bg-brand-600 hover:bg-brand-700 text-white font-bold px-4 py-2 rounded-lg text-sm transition-all shadow-md">
          Book Another Car
        </Link>
      </div>

      {error && (
        <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded-lg p-4 text-sm mb-6 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {bookings.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <Calendar className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-800 font-bold">No Bookings Found</h3>
          <p className="text-slate-500 text-sm mt-2 max-w-md mx-auto">
            You haven't reserved any vehicles yet. Check out our available hatchbacks, sedans, and SUVs at Ahmedabad's hubs!
          </p>
          <Link href="/" className="mt-5 inline-block bg-brand-600 hover:bg-brand-700 text-white font-semibold px-5 py-2.5 rounded-lg shadow-md transition-all">
            Find Available Cars
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {bookings.map((booking) => {
            const v = booking.vehicle;
            const isCancelled = booking.status === 'CANCELLED';
            const pickupDate = new Date(booking.pickup_time);
            const dropoffDate = new Date(booking.dropoff_time);
            const isActiveOrFuture = dropoffDate.getTime() > Date.now() && !isCancelled;

            return (
              <div key={booking.id} className={`bg-white rounded-2xl border overflow-hidden shadow-sm flex flex-col md:flex-row ${isCancelled ? 'border-slate-200 opacity-75' : 'border-slate-200 hover:border-brand-200'}`}>
                {/* Car Thumbnail */}
                <div className="w-full md:w-56 h-36 bg-slate-100 shrink-0 relative">
                  <img
                    src={v.images[0] || 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=600'}
                    alt={v.make}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isCancelled ? 'bg-rose-100 text-rose-800' : 'bg-success-100 text-success-800'}`}>
                      {booking.status}
                    </span>
                  </div>
                </div>

                {/* Details */}
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <h4 className="text-lg font-bold text-slate-900 leading-tight">
                        {v.make} {v.model} <span className="text-xs text-slate-400 font-mono">({v.license_plate})</span>
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 uppercase font-bold tracking-wider">{v.type.category_name} ({v.type.transmission})</p>

                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
                        <p className="flex items-center gap-1.5">
                          <MapPin size={13} className="text-brand-500" />
                          <span>Hub: <strong>{v.location.hub_name}</strong></span>
                        </p>
                        <p className="flex items-center gap-1.5">
                          <Calendar size={13} className="text-brand-500" />
                          <span>Pickup: <strong>{pickupDate.toLocaleString('en-IN')}</strong></span>
                        </p>
                        <p className="flex items-center gap-1.5 sm:col-span-2">
                          <Calendar size={13} className="text-brand-500" />
                          <span>Dropoff: <strong>{dropoffDate.toLocaleString('en-IN')}</strong></span>
                        </p>
                      </div>
                    </div>

                    <div className="text-left md:text-right flex flex-col justify-between h-full border-t md:border-t-0 border-slate-100 pt-4 md:pt-0">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block leading-none">Total Fare Paid</span>
                        <span className="text-2xl font-black text-slate-900">₹{booking.total_price}</span>
                      </div>

                      {/* Download agreement button */}
                      {booking.agreement_pdf_url && !isCancelled && (
                        <a
                          href={`http://localhost:5000${booking.agreement_pdf_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-4 md:mt-0 text-brand-600 hover:text-brand-700 text-xs font-bold flex items-center gap-1 md:justify-end transition-colors"
                        >
                          <Download size={12} /> Agreement Contract
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Live Telemetry & Security Console */}
                  {booking.handover_completed && booking.status === 'ACTIVE' && (
                    <div className="mt-5 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-200/60">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                          Live Vehicle Telematics Console
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded">
                          GPS: Active Broadcast
                        </span>
                      </div>

                      {(() => {
                        const speedLimit = v.speed_limit || 120;
                        const currentSpeed = getSimulatedSpeed(booking.id, speedLimit);
                        const isOverspeeding = currentSpeed > speedLimit;
                        const lateCalc = getLateReturnCalculation(booking.dropoff_time);

                        return (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
                              <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                                <span className="text-[9px] text-slate-400 uppercase font-bold block">Current Speed</span>
                                <span className={`text-base font-black ${isOverspeeding ? 'text-rose-600' : 'text-slate-800'}`}>
                                  {currentSpeed} km/h
                                </span>
                              </div>
                              <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                                <span className="text-[9px] text-slate-400 uppercase font-bold block">Speed Limit Cap</span>
                                <span className="text-base font-black text-slate-700">
                                  {speedLimit} km/h
                                </span>
                              </div>
                              <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                                <span className="text-[9px] text-slate-400 uppercase font-bold block">Fuel Remaining</span>
                                <span className="text-base font-black text-slate-700">
                                  {v.current_fuel || 88}%
                                </span>
                              </div>
                              <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                                <span className="text-[9px] text-slate-400 uppercase font-bold block">Immobilizer Relay</span>
                                <span className="text-base font-bold text-slate-700 flex items-center justify-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  ACTIVE
                                </span>
                              </div>
                            </div>

                            {/* Overspeeding Warning Banner */}
                            {isOverspeeding && (
                              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-[10px] leading-relaxed font-bold animate-pulse flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                <span>
                                  🚨 SPEED LIMIT VIOLATION ALERT: Slow down! Your speed ({currentSpeed} km/h) exceeds the vehicle's speed limit cap of {speedLimit} km/h. Host speed governance alerts have been logged.
                                </span>
                              </div>
                            )}

                            {/* Late return calculation warning */}
                            {lateCalc.isLate && (
                              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[10px] leading-relaxed font-semibold flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <span>{lateCalc.text}</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Actions footer */}
                  {!isCancelled && (
                    <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center flex-wrap gap-3">
                      <div>
                        {!booking.handover_completed && booking.status === 'CONFIRMED' && (
                          <div className="flex flex-col sm:flex-row gap-2.5">
                            {!booking.esign_completed ? (
                              <button
                                onClick={() => handleStartEsign(booking.id)}
                                className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-brand-500/10 cursor-pointer"
                              >
                                <PenTool size={14} /> Aadhaar e-Sign Agreement
                              </button>
                            ) : (
                              <Link
                                href={`/bookings/handover?bookingId=${booking.id}`}
                                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/10"
                              >
                                <ShieldCheck size={14} /> Inspect & Unlock Vehicle
                              </Link>
                            )}
                          </div>
                        )}
                        {booking.handover_completed && (
                          <span className="text-xs text-emerald-600 font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                            Vehicle Unlocked
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {booking.status === 'ACTIVE' && (
                          <button
                            onClick={() => openHostChat(booking)}
                            className="flex items-center gap-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-sm hover:shadow"
                          >
                            <MessageSquare size={14} className="text-brand-600" /> Chat with Host
                          </button>
                        )}
                        {booking.status !== 'COMPLETED' && (
                          <button
                            onClick={() => {
                              setSelectedBookingForExtension(booking.id);
                              setShowExtensionModal(true);
                            }}
                            className="flex items-center gap-1 bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm"
                          >
                            Extend Rental
                          </button>
                        )}
                        {booking.status === 'CONFIRMED' && (
                          <button
                            onClick={() => handleCancelBooking(booking.id)}
                            className="flex items-center gap-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                          >
                            <XCircle size={14} /> Cancel Booking
                          </button>
                        )}
                        <Link
                          href="/support"
                          className="flex items-center gap-1 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                        >
                          <HelpCircle size={14} /> Support Help
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* P2P Masked Chat Modal */}
      {showChatModal && chatBookingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in-up">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative border border-slate-100 flex flex-col h-[500px]">
            <button
              onClick={() => {
                setShowChatModal(false);
                setChatBookingId(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <XCircle size={20} />
            </button>

            <div className="border-b border-slate-100 pb-4 mb-4 flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xs">
                H
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Masked Communication Portal</h3>
                <p className="text-[10px] text-slate-400">Security Encrypted • Contact Numbers Hidden</p>
              </div>
            </div>

            {/* Chat message box */}
            <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1 text-xs">
              {chatMessages.map((msg, index) => {
                const isGuest = msg.sender === 'guest';
                return (
                  <div key={index} className={`flex ${isGuest ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 shadow-sm leading-relaxed ${isGuest ? 'bg-brand-600 text-white rounded-tr-none' : 'bg-slate-100 text-slate-800 rounded-tl-none'}`}>
                      {!isGuest && <p className="font-bold text-[9px] text-brand-700 mb-0.5 uppercase tracking-wide">Host</p>}
                      <p>{msg.text}</p>
                    </div>
                  </div>
                );
              })}
              {chatReplying && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 text-slate-500 rounded-2xl rounded-tl-none px-3.5 py-2.5 text-[10px] italic flex items-center gap-1.5 shadow-sm">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Host is typing...
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input form */}
            <form onSubmit={handleSendChatMessage} className="flex gap-2 border-t border-slate-100 pt-3">
              <input
                type="text"
                value={chatInputText}
                onChange={(e) => setChatInputText(e.target.value)}
                placeholder="Type your handoff message..."
                className="flex-grow text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500 text-slate-800 bg-white"
                required
              />
              <button
                type="submit"
                disabled={chatReplying}
                className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white p-2 rounded-xl transition-all cursor-pointer shadow-md shadow-brand-500/10"
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Extension Modal */}
      {showExtensionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative border border-slate-100 animate-fade-in-up">
            <button
              onClick={() => {
                setShowExtensionModal(false);
                setExtensionResult(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <XCircle size={20} />
            </button>

            <h3 className="text-xl font-black text-slate-900 mb-2">Extend Your Booking</h3>
            <p className="text-xs text-slate-500 mb-6">Choose how many additional hours you would like to keep the vehicle. The pricing will adjust dynamically.</p>

            {extensionResult?.error && (
              <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded-xl p-3 text-xs mb-4">
                {extensionResult.error}
              </div>
            )}

            {extensionResult?.success && (
              <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl p-3 text-xs mb-4 font-bold text-center">
                Rental extended successfully! Extra Fare: ₹{extensionResult.fare}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Additional Hours</label>
                <div className="flex items-center gap-4 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                  <input
                    type="range"
                    min="1"
                    max="12"
                    step="1"
                    value={extensionHours}
                    onChange={(e) => setExtensionHours(parseInt(e.target.value))}
                    className="flex-1 accent-brand-600"
                  />
                  <span className="text-base font-black text-brand-600 bg-white border border-slate-200 shadow-sm px-3 py-1.5 rounded-xl shrink-0 min-w-[50px] text-center">
                    +{extensionHours}h
                  </span>
                </div>
              </div>

              <button
                onClick={handleExtend}
                disabled={extending || !!extensionResult?.success}
                className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-2xl text-xs transition-all shadow-md shadow-brand-500/10 flex items-center justify-center gap-2"
              >
                {extending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Extending...
                  </>
                ) : (
                  'Confirm Extension'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Aadhaar e-Sign Gateway Modal (Digio / NSDL Style) */}
      {showEsignModal && esignBookingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in-up">
          <div className="bg-white rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl relative border border-slate-100 flex flex-col md:flex-row min-h-[460px]">
            <button
              onClick={() => {
                setShowEsignModal(false);
                setEsignBookingId(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer z-10 p-1 bg-slate-50 hover:bg-slate-100 rounded-full"
            >
              <XCircle size={20} />
            </button>

            {/* Left Column: NSDL/Certified signing banner and document details */}
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
                    <span className="font-mono text-[9px] truncate">Ref: {esignBookingId}</span>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-800 text-[10px] text-slate-400 leading-relaxed">
                <p>This e-Sign gateway utilizes NSDL e-Governance services to authenticate identity and execute legal signatures in accordance with Section 3A of the Information Technology Act.</p>
              </div>
            </div>

            {/* Right Column: Interactive OTP Sign Flow */}
            <div className="md:w-7/12 p-8 flex flex-col justify-between">
              {esignStep === 'aadhaar' && (
                <form onSubmit={handleRequestOtp} className="space-y-6 my-auto">
                  <div className="text-center md:text-left">
                    <Fingerprint className="w-10 h-10 text-brand-600 mx-auto md:mx-0 mb-3" />
                    <h3 className="text-lg font-black text-slate-900 leading-tight">Verify Aadhaar Identity</h3>
                    <p className="text-xs text-slate-500 mt-1">Authenticate using your 12-digit Aadhaar number to place your digital signature certificate.</p>
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
                        value={aadhaarNumber}
                        onChange={(e) => setAadhaarNumber(e.target.value.replace(/\D/g, ''))}
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
                    disabled={esignLoading || aadhaarNumber.length !== 12 || !esignConsent}
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
                <form onSubmit={handleVerifyEsign} className="space-y-6 my-auto">
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
                        value={otpText}
                        onChange={(e) => setOtpText(e.target.value.replace(/\D/g, ''))}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold tracking-widest text-center focus:border-brand-600 focus:outline-none bg-slate-50 text-slate-700"
                      />
                    </div>
                    <p className="text-[10px] text-brand-600 font-bold bg-brand-50 px-3 py-1.5 rounded-lg text-center">
                      🔐 Testing Bypass: Enter code <strong>123456</strong>
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={esignLoading || otpText.length !== 6}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3 rounded-2xl text-xs transition-all shadow-md shadow-emerald-500/10 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {esignLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Issuing Digital Certificate...
                      </>
                    ) : (
                      'Verify & Sign Agreement'
                    )}
                  </button>
                </form>
              )}

              {esignStep === 'success' && (
                <div className="text-center space-y-6 my-auto py-4">
                  <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                    <Check className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Aadhaar e-Sign Successful!</h3>
                    <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
                      Your digital signature certificate (DSC) has been appended to the agreement document. The status of your lease is now marked as <strong>e-Signed</strong>.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowEsignModal(false);
                      setEsignBookingId(null);
                    }}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-2xl text-xs transition-all cursor-pointer"
                  >
                    Return to Bookings
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
