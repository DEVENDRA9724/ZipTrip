'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '../store/store';
import { Calendar, MapPin, Search, ShieldCheck, Zap, Compass, FileSpreadsheet, Star, ChevronRight, Coins, Key, Loader2, Award, Heart } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const router = useRouter();
  const { locations, fetchLocations, setSearchParams, searchVehicles, availableVehicles, setSelectedVehicle, loading } = useStore();

  const [selectedHub, setSelectedHub] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [dropoffTime, setDropoffTime] = useState('');

  // Active search tab (Screenshot 1)
  const [activeSearchTab, setActiveSearchTab] = useState<'daily' | 'subscription' | 'pass'>('daily');

  // Category filter tag (Screenshot 2)
  const [activeCategoryTag, setActiveCategoryTag] = useState<'ALL' | 'PROFESSIONAL' | 'SUV' | 'HATCHBACK' | 'SEDAN'>('ALL');

  // Host Calculator State
  const [calcVehicleClass, setCalcVehicleClass] = useState<'hatchback' | 'sedan' | 'suv'>('suv');
  const [calcDays, setCalcDays] = useState(15);

  useEffect(() => {
    fetchLocations();

    // Set default dates: tomorrow 10:00 AM to day after tomorrow 10:00 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);
    dayAfter.setHours(10, 0, 0, 0);

    const formatDateTime = (date: Date) => {
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    setPickupTime(formatDateTime(tomorrow));
    setDropoffTime(formatDateTime(dayAfter));
  }, [fetchLocations]);

  // Set default hub on load
  useEffect(() => {
    if (locations.length > 0 && !selectedHub) {
      setSelectedHub(locations[0].id);
    }
  }, [locations, selectedHub]);

  // Fetch featured vehicles preview when locations & parameters align
  useEffect(() => {
    if (locations.length > 0 && selectedHub && pickupTime && dropoffTime) {
      searchVehicles(selectedHub, pickupTime, dropoffTime);
    }
  }, [locations, selectedHub, pickupTime, dropoffTime, searchVehicles]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHub || !pickupTime || !dropoffTime) return;

    setSearchParams({
      locationId: selectedHub,
      pickupTime,
      dropoffTime
    });

    router.push(`/vehicles?locationId=${selectedHub}&pickupTime=${pickupTime}&dropoffTime=${dropoffTime}`);
  };

  const handleFeaturedBook = (vehicle: any) => {
    setSelectedVehicle(vehicle);
    setSearchParams({
      locationId: selectedHub,
      pickupTime,
      dropoffTime
    });
    router.push('/checkout');
  };

  // Host Calculator Calculation
  const calculateHostEarnings = () => {
    let baseRate = 1200; // Hatchback default daily rate
    if (calcVehicleClass === 'sedan') baseRate = 1800;
    else if (calcVehicleClass === 'suv') baseRate = 2700;

    const gross = baseRate * calcDays;
    const netShare = gross * 0.60; // 60% Host split
    return Math.round(netShare);
  };

  // Filter vehicles client-side for landing page category tags
  const filteredVehicles = availableVehicles.filter((v: any) => {
    if (activeCategoryTag === 'ALL') return true;
    if (activeCategoryTag === 'PROFESSIONAL') {
      return v.type.category_name.toLowerCase() === 'suv' || v.type.category_name.toLowerCase() === 'sedan';
    }
    return v.type.category_name.toLowerCase() === activeCategoryTag.toLowerCase();
  });

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background gradients */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-200/20 rounded-full blur-3xl animate-float-slow" />
        <div className="absolute top-1/3 right-1/4 w-[450px] h-[450px] bg-indigo-200/20 rounded-full blur-3xl animate-float-slower" />
        <div className="absolute bottom-10 left-1/3 w-80 h-80 bg-emerald-50/40 rounded-full blur-3xl animate-float" />
      </div>

      {/* Hero Section (Screenshot 1 Styling) */}
      <div className="max-width-container pt-12 pb-24 text-center">
        <div className="max-w-3xl mx-auto mb-8">
          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            Self Drive Car Rental in Ahmedabad - Book Affordable Cars Instantly
          </h1>
          {/* Trip stats */}
          <div className="flex justify-center items-center gap-4 sm:gap-6 mt-5 text-[11px] sm:text-xs text-slate-500 font-bold uppercase tracking-wider">
            <span>50,00,000+ Trips</span>
            <span className="text-slate-300">•</span>
            <span>30,00,000+ User Ratings</span>
            <span className="text-slate-300">•</span>
            <span>4.8+ Average Trip Rating</span>
          </div>
        </div>

        {/* Polaroid Card Slideshow (Screenshot 1 Visuals) */}
        <div className="relative max-w-5xl mx-auto flex items-center justify-center gap-4 overflow-x-auto pb-10 pt-4 px-4 scrollbar-hide">
          {/* Polaroid 1 */}
          <div className="w-36 sm:w-44 bg-white p-2.5 rounded-xl shadow-md border border-slate-100 transform rotate-[-4deg] hover:rotate-0 hover:scale-105 transition-all shrink-0">
            <img src="https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=300" alt="Trip 1" className="w-full h-24 sm:h-32 object-cover rounded-lg" />
            <p className="text-[10px] text-slate-400 font-bold mt-2 text-center">Outdoors Camping</p>
          </div>
          {/* Polaroid 2 */}
          <div className="w-36 sm:w-44 bg-white p-2.5 rounded-xl shadow-md border border-slate-100 transform rotate-[2deg] hover:rotate-0 hover:scale-105 transition-all shrink-0">
            <img src="https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&q=80&w=300" alt="Trip 2" className="w-full h-24 sm:h-32 object-cover rounded-lg" />
            <p className="text-[10px] text-slate-400 font-bold mt-2 text-center">Road Trips</p>
          </div>
          {/* Polaroid 3 */}
          <div className="w-36 sm:w-44 bg-white p-2.5 rounded-xl shadow-md border border-slate-100 transform rotate-[-2deg] hover:rotate-0 hover:scale-105 transition-all shrink-0">
            <img src="https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&q=80&w=300" alt="Trip 3" className="w-full h-24 sm:h-32 object-cover rounded-lg" />
            <p className="text-[10px] text-slate-400 font-bold mt-2 text-center">Scenic Highways</p>
          </div>
          {/* Polaroid 4 */}
          <div className="w-36 sm:w-44 bg-white p-2.5 rounded-xl shadow-md border border-slate-100 transform rotate-[3deg] hover:rotate-0 hover:scale-105 transition-all shrink-0">
            <img src="https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?auto=format&fit=crop&q=80&w=300" alt="Trip 4" className="w-full h-24 sm:h-32 object-cover rounded-lg" />
            <p className="text-[10px] text-slate-400 font-bold mt-2 text-center">Weekend Escapes</p>
          </div>
          {/* Polaroid 5 */}
          <div className="w-36 sm:w-44 bg-white p-2.5 rounded-xl shadow-md border border-slate-100 transform rotate-[-3deg] hover:rotate-0 hover:scale-105 transition-all shrink-0">
            <img src="https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&q=80&w=300" alt="Trip 5" className="w-full h-24 sm:h-32 object-cover rounded-lg" />
            <p className="text-[10px] text-slate-400 font-bold mt-2 text-center">Luxury SUV Rides</p>
          </div>
        </div>

        {/* Search Widget Card (Screenshot 1 tabs + form) */}
        <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden mt-6">
          {/* Tabs bar */}
          <div className="flex border-b border-slate-100 text-xs font-extrabold text-slate-500 uppercase tracking-wider bg-slate-50/50">
            <button
              onClick={() => setActiveSearchTab('daily')}
              className={`flex-1 py-4 text-center transition-all cursor-pointer ${activeSearchTab === 'daily' ? 'bg-white text-brand-600 border-b-2 border-brand-500' : 'hover:text-slate-700'}`}
            >
              Daily Drives
              <span className="block text-[8px] text-slate-400 lowercase font-medium mt-0.5">Upto 7 days</span>
            </button>
            <button
              onClick={() => setActiveSearchTab('subscription')}
              className={`flex-1 py-4 text-center transition-all cursor-pointer ${activeSearchTab === 'subscription' ? 'bg-white text-brand-600 border-b-2 border-brand-500' : 'hover:text-slate-700'}`}
            >
              Subscription
              <span className="block text-[8px] text-slate-400 lowercase font-medium mt-0.5">7day+ rides</span>
            </button>
            <button
              onClick={() => setActiveSearchTab('pass')}
              className={`flex-1 py-4 text-center transition-all cursor-pointer ${activeSearchTab === 'pass' ? 'bg-white text-brand-600 border-b-2 border-brand-500' : 'hover:text-slate-700'}`}
            >
              Weekday Pass
              <span className="block text-[8px] text-slate-400 lowercase font-medium mt-0.5">Mon-Fri rates</span>
            </button>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="p-6 sm:p-8 space-y-6 sm:space-y-0 sm:flex sm:items-end sm:gap-4 text-left">
            <div className="flex-1 space-y-2">
              <label className="flex items-center gap-1.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                <MapPin size={12} className="text-brand-600" /> Pickup Hub
              </label>
              <select
                value={selectedHub}
                onChange={(e) => setSelectedHub(e.target.value)}
                className="w-full h-11 border border-slate-200 rounded-xl px-3 text-xs focus:border-brand-600 focus:outline-none bg-white font-bold text-slate-700 shadow-sm cursor-pointer"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.hub_name} ({loc.address.split(',')[1] || loc.address})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 space-y-2">
              <label className="flex items-center gap-1.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                <Calendar size={12} className="text-brand-600" /> Start Date & Time
              </label>
              <input
                type="datetime-local"
                value={pickupTime}
                onChange={(e) => setPickupTime(e.target.value)}
                className="w-full h-11 border border-slate-200 rounded-xl px-3 text-xs focus:border-brand-600 focus:outline-none bg-white font-bold text-slate-700 shadow-sm"
              />
            </div>

            <div className="flex-1 space-y-2">
              <label className="flex items-center gap-1.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                <Calendar size={12} className="text-brand-600" /> End Date & Time
              </label>
              <input
                type="datetime-local"
                value={dropoffTime}
                onChange={(e) => setDropoffTime(e.target.value)}
                className="w-full h-11 border border-slate-200 rounded-xl px-3 text-xs focus:border-brand-600 focus:outline-none bg-white font-bold text-slate-700 shadow-sm"
              />
            </div>

            <button
              type="submit"
              className="w-full sm:w-auto h-11 bg-brand-600 hover:bg-brand-700 text-white font-bold px-8 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <Search size={14} /> Search Cars
            </button>
          </form>
        </div>

        {/* Dynamic Featured Fleet Preview Section */}
        <div className="mt-24 text-left">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-8">
            <div>
              <span className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-bold uppercase tracking-wide">
                Available Fleet Preview
              </span>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-2">
                Featured Vehicles at Sardar Patel / SG Highway
              </h3>
            </div>
            <Link
              href={`/vehicles?locationId=${selectedHub}&pickupTime=${pickupTime}&dropoffTime=${dropoffTime}`}
              className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1 mt-2 sm:mt-0 hover:underline"
            >
              Explore Entire Catalog <ChevronRight size={14} />
            </Link>
          </div>

          {/* Category Filter Tags (Screenshot 2 styling) */}
          <div className="flex gap-2.5 overflow-x-auto pb-4 scrollbar-hide text-xs mb-8">
            <button
              onClick={() => setActiveCategoryTag('ALL')}
              className={`py-2 px-4 rounded-full font-bold transition-all border shrink-0 cursor-pointer ${activeCategoryTag === 'ALL' ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            >
              All Category
            </button>
            <button
              onClick={() => setActiveCategoryTag('PROFESSIONAL')}
              className={`py-2 px-4 rounded-full font-bold transition-all border shrink-0 cursor-pointer ${activeCategoryTag === 'PROFESSIONAL' ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            >
              Professional Host
            </button>
            <button
              onClick={() => setActiveCategoryTag('SUV')}
              className={`py-2 px-4 rounded-full font-bold transition-all border shrink-0 cursor-pointer ${activeCategoryTag === 'SUV' ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            >
              SUV
            </button>
            <button
              onClick={() => setActiveCategoryTag('HATCHBACK')}
              className={`py-2 px-4 rounded-full font-bold transition-all border shrink-0 cursor-pointer ${activeCategoryTag === 'HATCHBACK' ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            >
              Hatchback
            </button>
            <button
              onClick={() => setActiveCategoryTag('SEDAN')}
              className={`py-2 px-4 rounded-full font-bold transition-all border shrink-0 cursor-pointer ${activeCategoryTag === 'SEDAN' ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            >
              Sedan
            </button>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
              <p className="text-xs text-slate-500 font-medium">Fetching available vehicles...</p>
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
              <Compass className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="font-semibold text-slate-700">No vehicles available for this filter status.</p>
              <p className="text-xs text-slate-400 mt-1">Select a different tab or change dates to query listings.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {filteredVehicles.slice(0, 3).map((vehicle) => {
                const isSuv = vehicle.type.category_name.toLowerCase() === 'suv';
                const isSedan = vehicle.type.category_name.toLowerCase() === 'sedan';
                const mockRating = isSuv ? '4.88' : isSedan ? '4.72' : '4.54';
                const mockTrips = isSuv ? '48' : isSedan ? '32' : '52';
                
                // Calculate hourly rate (daily base price / 24)
                const hourlyRate = Math.round(vehicle.type.base_price_per_day / 24);
                const simulatedDistance = (vehicle.license_plate.charCodeAt(9) % 25) + 3; // stable distance 3-28 km

                return (
                  <div
                    key={vehicle.id}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg hover:border-brand-200 transition-all duration-300 flex flex-col group"
                  >
                    {/* Image Box */}
                    <div className="h-44 bg-slate-100 relative overflow-hidden shrink-0">
                      <img
                        src={vehicle.images[0] || 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=600'}
                        alt={vehicle.make}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute top-3.5 left-3.5">
                        <span className="bg-slate-900/90 text-white font-bold text-[9px] px-2 py-0.5 rounded uppercase tracking-wider">
                          {vehicle.type.category_name}
                        </span>
                      </div>
                      <div className="absolute top-3.5 right-3.5 bg-white/95 backdrop-blur-sm px-2 py-0.5 rounded shadow-sm text-[10px] font-bold text-slate-800 flex items-center gap-0.5 border border-slate-100">
                        <Star size={10} className="fill-amber-400 text-amber-400 shrink-0" />
                        {mockRating} <span className="text-slate-400 font-normal">({mockTrips})</span>
                      </div>
                    </div>
                    
                    {/* Content Box */}
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-base leading-tight">
                          {vehicle.make} {vehicle.model}
                        </h4>
                        <div className="flex gap-2.5 mt-2 text-[10px] text-slate-400 uppercase font-bold tracking-wide">
                          <span>{vehicle.type.transmission}</span>
                          <span>•</span>
                          <span>{vehicle.type.seating_capacity} Seats</span>
                        </div>
                        <div className="flex items-center gap-1 mt-3 text-[10px] text-slate-500">
                          <MapPin size={12} className="text-slate-400 shrink-0" />
                          <span>{simulatedDistance} km away • {vehicle.location.hub_name.split(' ')[0]} Hub</span>
                        </div>
                      </div>

                      {/* Pricing and Action button (Screenshot 2 layout) */}
                      <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-end justify-between">
                        <div>
                          <span className="text-lg font-black text-slate-900 block leading-none">
                            ₹{hourlyRate} <span className="text-xs font-normal text-slate-400">/ hr</span>
                          </span>
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mt-1">
                            ₹{vehicle.type.base_price_per_day} total / day
                          </span>
                        </div>
                        <button
                          onClick={() => handleFeaturedBook(vehicle)}
                          className="bg-brand-600 hover:bg-slate-900 text-white font-bold text-xs py-2 px-4 rounded-xl transition-all hover:scale-[1.03] active:scale-[0.97] cursor-pointer"
                        >
                          Book Ride
                        </button>
                      </div>
                    </div>

                    {/* Professional Host golden footer banner (Screenshot 2 layout) */}
                    {(isSuv || isSedan) && (
                      <div className="bg-amber-50/70 border-t border-amber-100 py-1.5 px-4 text-center shrink-0">
                        <span className="text-[9px] font-bold text-amber-700 tracking-wider flex items-center justify-center gap-1 uppercase">
                          <Award size={10} className="text-amber-600" /> Professional Host Asset
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* How It Works Section */}
        <div className="mt-28 bg-slate-900 text-white rounded-3xl p-10 md:p-12 shadow-xl border border-slate-800 relative overflow-hidden text-left">
          <div className="absolute top-0 right-0 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="text-center max-w-xl mx-auto mb-12">
            <span className="text-xs bg-brand-500/20 text-brand-400 px-3 py-1 rounded-full font-bold uppercase tracking-wide">
              The ZipTrip Flow
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-3">
              Rent Without the Paperwork
            </h3>
            <p className="text-slate-400 text-sm mt-2">
              Our automated architecture bypasses physical rental counters, getting you on the road instantly.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-slate-950/60 p-6 rounded-2xl border border-slate-800 relative">
              <div className="w-9 h-9 rounded-lg bg-brand-500/20 flex items-center justify-center text-brand-400 mb-4 font-bold text-sm">
                1
              </div>
              <h4 className="font-bold text-white text-base">Select Your Car</h4>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Browse SUVs, Sedans, and Hatchbacks. Choose a convenient local hub, select your travel dates, and reserve in under a minute.
              </p>
            </div>

            <div className="bg-slate-950/60 p-6 rounded-2xl border border-slate-800 relative">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4 font-bold text-sm">
                2
              </div>
              <h4 className="font-bold text-white text-base">Complete Fast KYC</h4>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Take a selfie and upload your Aadhaar/DL documents. Our FaceMatch biometric score verifies your profile under 2 minutes.
              </p>
            </div>

            <div className="bg-slate-950/60 p-6 rounded-2xl border border-slate-800 relative">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 font-bold text-sm">
                3
              </div>
              <h4 className="font-bold text-white text-base">Verify & Unlock</h4>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Complete the condition check-in (log fuel and scratches on the visual layout). The doors automatically unlock via remote IoT controls.
              </p>
            </div>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 text-left">
          <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-lg bg-brand-100 flex items-center justify-center text-brand-700 mb-4">
              <Zap size={20} />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Dynamic Pricing</h3>
            <p className="text-sm text-slate-600 mt-2">
              Our automated pricing strategy calculates optimal base, airport location modifiers (15%), and weekend demand multipliers (20%) instantly.
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-lg bg-success-100 flex items-center justify-center text-success-700 mb-4">
              <ShieldCheck size={20} />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Aadhaar Paperless KYC</h3>
            <p className="text-sm text-slate-600 mt-2">
              Verify identity securely via simulated FaceMatch scoring matching biometric parameters of selfie uploads with driving license documents.
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center text-sky-700 mb-4">
              <FileSpreadsheet size={20} />
            </div>
            <h3 className="text-lg font-bold text-slate-800">e-Stamped Agreements</h3>
            <p className="text-sm text-slate-600 mt-2">
              Legally compliant digital contracting generated on-the-fly using Puppeteer, with stamped duty validations conforming to the Indian Contract Act.
            </p>
          </div>
        </div>

        {/* Host Onboarding Calculator Section */}
        <div className="mt-28 bg-white border border-slate-200 rounded-3xl p-8 sm:p-10 shadow-sm grid grid-cols-1 lg:grid-cols-2 gap-10 items-center text-left">
          <div className="space-y-5">
            <span className="text-xs bg-brand-50 text-brand-700 px-3 py-1 rounded-full font-bold uppercase tracking-wide">
              Earn Passive Income
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Rent Out Your Car & Keep 60% of the Revenue
            </h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              List your idle Hatchback, Sedan, or SUV on ZipTrip. Benefit from our integrated legal bailment contracts, remote GPS trackers, speed governance, and automated late penalty calculator.
            </p>
            <div className="space-y-3.5 pt-2 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <Coins size={14} className="text-brand-500 shrink-0" />
                <span>60% revenue split paid directly to your bank account weekly</span>
              </div>
              <div className="flex items-center gap-2">
                <Key size={14} className="text-brand-500 shrink-0" />
                <span>Simulated IoT lock tracking blocks unauthorized users</span>
              </div>
            </div>
            <Link
              href="/host"
              className="inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white font-bold px-6 py-3 rounded-2xl text-xs transition-all shadow-md shadow-brand-500/10 cursor-pointer"
            >
              Start Hosting Today <ChevronRight size={14} />
            </Link>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-inner space-y-6">
            <h4 className="font-bold text-slate-800 text-sm">Host Revenue Calculator</h4>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Vehicle Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['hatchback', 'sedan', 'suv'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setCalcVehicleClass(type)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold capitalize transition-all border cursor-pointer ${calcVehicleClass === type ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Days Listed per Month</label>
                  <span className="text-xs font-extrabold text-slate-900">{calcDays} Days</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="30"
                  step="1"
                  value={calcDays}
                  onChange={(e) => setCalcDays(parseInt(e.target.value))}
                  className="w-full accent-slate-900 cursor-pointer"
                />
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Estimated Monthly Payout</span>
              <span className="text-3xl font-black text-brand-600 mt-1 block">
                ₹{calculateHostEarnings().toLocaleString('en-IN')}
              </span>
              <span className="text-[9px] text-slate-400 mt-1.5 block">Estimated at 60% host revenue split with standard occupancy.</span>
            </div>
          </div>
        </div>

        {/* Regional Destinations / Recommendations Section */}
        <div className="mt-28 border-t border-slate-200/60 pt-16 text-left">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-2">Planning a Weekend Road Trip?</h2>
          <p className="text-sm text-slate-500 mb-8">Popular destinations from Ahmedabad. Book an SUV for long trips.</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="relative rounded-2xl overflow-hidden group shadow-lg h-64">
              <img
                src="https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&q=80&w=600"
                alt="Statue of Unity"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent p-6 flex flex-col justify-end">
                <span className="text-xs bg-brand-500 text-white w-max px-2 py-0.5 rounded font-bold mb-2">SUV Pick</span>
                <h4 className="text-lg font-bold text-white">Statue of Unity, Kevadia</h4>
                <p className="text-xs text-slate-300 mt-1">200 km | Ideal for family trips.</p>
              </div>
            </div>

            <div className="relative rounded-2xl overflow-hidden group shadow-lg h-64">
              <img
                src="https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?auto=format&fit=crop&q=80&w=600"
                alt="Saputara"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent p-6 flex flex-col justify-end">
                <span className="text-xs bg-brand-500 text-white w-max px-2 py-0.5 rounded font-bold mb-2">SUV / Sedan</span>
                <h4 className="text-lg font-bold text-white">Saputara Hill Station</h4>
                <p className="text-xs text-slate-300 mt-1">400 km | Scenic monsoon mountain drive.</p>
              </div>
            </div>

            <div className="relative rounded-2xl overflow-hidden group shadow-lg h-64">
              <img
                src="https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&q=80&w=600"
                alt="Udaipur"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent p-6 flex flex-col justify-end">
                <span className="text-xs bg-brand-500 text-white w-max px-2 py-0.5 rounded font-bold mb-2">Sedan Pick</span>
                <h4 className="text-lg font-bold text-white">Udaipur, Rajasthan</h4>
                <p className="text-xs text-slate-300 mt-1">260 km | Smooth highways to the Lake City.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
