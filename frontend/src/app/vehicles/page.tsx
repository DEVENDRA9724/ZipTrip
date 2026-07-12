'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useStore } from '../../store/store';
import { Users, Fuel, ShieldAlert, Award, Calendar, ArrowLeft, Loader2, Sparkles, MapPin, Heart, Search, SlidersHorizontal, Star, Compass } from 'lucide-react';
import Link from 'next/link';

function VehiclesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    availableVehicles,
    loading,
    error,
    searchVehicles,
    setSelectedVehicle
  } = useStore();

  const locationId = searchParams.get('locationId');
  const pickupTime = searchParams.get('pickupTime');
  const dropoffTime = searchParams.get('dropoffTime');

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [maxDistance, setMaxDistance] = useState(50);
  const [minPrice, setMinPrice] = useState(500);
  const [maxPrice, setMaxPrice] = useState(5000);
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'HATCHBACK' | 'SEDAN' | 'SUV'>('ALL');
  const [onlyProfessional, setOnlyProfessional] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    if (locationId && pickupTime && dropoffTime) {
      searchVehicles(locationId, pickupTime, dropoffTime);
    }
  }, [locationId, pickupTime, dropoffTime, searchVehicles]);

  const handleBookNow = (vehicle: any) => {
    setSelectedVehicle(vehicle);
    router.push('/checkout');
  };

  const toggleFavorite = (vehicleId: string) => {
    setFavorites(prev => 
      prev.includes(vehicleId) 
        ? prev.filter(id => id !== vehicleId) 
        : [...prev, vehicleId]
    );
  };

  const getDurationHours = () => {
    if (!pickupTime || !dropoffTime) return 24;
    const p = new Date(pickupTime);
    const d = new Date(dropoffTime);
    const diffHours = Math.ceil((d.getTime() - p.getTime()) / (1000 * 60 * 60));
    return diffHours > 0 ? diffHours : 24;
  };

  const getDurationText = () => {
    const diffHours = getDurationHours();
    const days = Math.floor(diffHours / 24);
    const remainingHours = diffHours % 24;

    if (days > 0) {
      return `${days}d ${remainingHours}h`;
    }
    return `${diffHours} hours`;
  };

  // Filter Vehicles client-side
  const filteredVehicles = availableVehicles.filter((vehicle: any) => {
    // Search Query Match
    if (searchQuery) {
      const matchString = `${vehicle.make} ${vehicle.model} ${vehicle.type.category_name}`.toLowerCase();
      if (!matchString.includes(searchQuery.toLowerCase())) return false;
    }

    // Distance simulation based on license plate (deterministic for UI stability)
    const simulatedDistance = (vehicle.license_plate.charCodeAt(9) % 35) + 3; // 3km to 38km
    if (simulatedDistance > maxDistance) return false;

    // Price range verification
    const dailyPrice = vehicle.type.base_price_per_day;
    if (dailyPrice < minPrice || dailyPrice > maxPrice) return false;

    // Category Pill Match
    if (selectedCategory !== 'ALL') {
      if (vehicle.type.category_name.toUpperCase() !== selectedCategory) return false;
    }

    // Professional Host matches SUVs and Sedans mostly
    if (onlyProfessional) {
      const isProf = vehicle.type.category_name.toUpperCase() === 'SUV' || vehicle.type.category_name.toUpperCase() === 'SEDAN';
      if (!isProf) return false;
    }

    return true;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-10 h-10 text-brand-600 animate-spin" />
        <p className="text-slate-600 font-medium">Scanning fleet availability in Ahmedabad...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-20 p-6 bg-rose-50 border border-rose-200 rounded-xl text-center shadow-sm">
        <ShieldAlert className="w-12 h-12 text-rose-600 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-rose-800">Search Failed</h3>
        <p className="text-slate-600 text-sm mt-2">{error}</p>
        <Link href="/" className="mt-4 inline-flex items-center gap-1.5 text-sm bg-brand-600 hover:bg-brand-700 text-white font-semibold px-4 py-2 rounded-lg shadow-md transition-all">
          <ArrowLeft size={14} /> Back to Search
        </Link>
      </div>
    );
  }

  return (
    <div className="max-width-container py-8">
      {/* Header bar */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <Link href="/" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 mb-1 transition-colors">
            <ArrowLeft size={14} /> Modify Search
          </Link>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Rent Self-Drive Cars in Ahmedabad</h2>
          {pickupTime && dropoffTime && (
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 font-medium">
              <Calendar size={12} className="text-slate-400" /> Duration: <strong className="text-slate-700">{getDurationText()}</strong> | {new Date(pickupTime).toLocaleString('en-IN', {day:'numeric', month:'short', hour:'numeric', minute:'numeric'})} to {new Date(dropoffTime).toLocaleString('en-IN', {day:'numeric', month:'short', hour:'numeric', minute:'numeric'})}
            </p>
          )}
        </div>
        <div className="bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full text-xs font-bold text-slate-700">
          {filteredVehicles.length} Cars Available
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Filter Sidebar */}
        <div className="lg:col-span-3 space-y-6 bg-slate-50 border border-slate-200/80 rounded-2xl p-5">
          <div className="flex justify-between items-center pb-3 border-b border-slate-200">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <SlidersHorizontal size={14} className="text-brand-600" /> Filters
            </h3>
            <button
              onClick={() => {
                setSearchQuery('');
                setMaxDistance(50);
                setMinPrice(500);
                setMaxPrice(5000);
                setSelectedCategory('ALL');
                setOnlyProfessional(false);
              }}
              className="text-[10px] font-bold text-brand-600 hover:text-brand-700 cursor-pointer"
            >
              Reset All
            </button>
          </div>

          {/* Distance Filter */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Hub Distance</label>
              <span className="text-xs font-extrabold text-slate-700">{maxDistance} km</span>
            </div>
            <input
              type="range"
              min="5"
              max="50"
              step="5"
              value={maxDistance}
              onChange={(e) => setMaxDistance(parseInt(e.target.value))}
              className="w-full accent-slate-900 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-bold">
              <span>Near</span>
              <span>Far</span>
            </div>
          </div>

          {/* Home Delivery Filter */}
          <div className="pt-2">
            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-600">
              <input
                type="checkbox"
                checked={onlyProfessional}
                onChange={(e) => setOnlyProfessional(e.target.checked)}
                className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4 border-slate-300"
              />
              <span>Professional Hosts Only</span>
            </label>
          </div>

          {/* Price Range Filter */}
          <div className="space-y-3 pt-3 border-t border-slate-200">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Daily Fare Range</label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-bold block mb-1">Min Fare</span>
                <input
                  type="number"
                  value={minPrice}
                  onChange={(e) => setMinPrice(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 font-bold focus:outline-none"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block mb-1">Max Fare</span>
                <input
                  type="number"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Math.max(minPrice, parseInt(e.target.value) || 0))}
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 font-bold focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Search + Grid */}
        <div className="lg:col-span-9 space-y-6">
          {/* Main search bar */}
          <div className="relative">
            <Search className="absolute left-4 top-3 text-slate-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for car models, brands, or category features..."
              className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-2xl text-xs focus:border-brand-600 focus:outline-none shadow-sm bg-white"
            />
          </div>

          {/* Category filter pills (Screenshot 2 styling) */}
          <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide text-xs">
            {(['ALL', 'SUV', 'SEDAN', 'HATCHBACK'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`py-2 px-4 rounded-full font-bold transition-all border shrink-0 cursor-pointer ${selectedCategory === cat ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              >
                {cat === 'ALL' ? 'All Classes' : cat}
              </button>
            ))}
          </div>


          {/* Vehicles Grid */}
          {filteredVehicles.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-16 text-center text-slate-500">
              <ShieldAlert className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="font-semibold text-slate-700">No vehicles match your active filters.</p>
              <p className="text-xs text-slate-400 mt-1">Try resetting sliders or clearing search parameters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {filteredVehicles.map((vehicle: any) => {
                const pricing = vehicle.pricing;
                const parsedFeatures = typeof vehicle.features === 'string' ? JSON.parse(vehicle.features) : vehicle.features;
                const isFavorite = favorites.includes(vehicle.id);
                
                // Simulated properties based on screenshots
                const isSuv = vehicle.type.category_name.toLowerCase() === 'suv';
                const isSedan = vehicle.type.category_name.toLowerCase() === 'sedan';
                const mockRating = isSuv ? '4.88' : isSedan ? '4.72' : '4.54';
                const mockTrips = isSuv ? '48' : isSedan ? '32' : '52';
                const simulatedDistance = (vehicle.license_plate.charCodeAt(9) % 25) + 3; // stable distance 3-28 km

                // Hourly pricing logic
                const durationHours = getDurationHours();
                const hourlyRate = Math.round(pricing.totalPrice / durationHours);

                return (
                  <div
                    key={vehicle.id}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg hover:border-brand-200 transition-all duration-300 flex flex-col group"
                  >
                    {/* Image Block */}
                    <div className="h-44 bg-slate-100 relative overflow-hidden shrink-0">
                      <img
                        src={vehicle.images[0] || 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=600'}
                        alt={vehicle.make}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      
                      {/* Heart Button Overlay */}
                      <button
                        onClick={() => toggleFavorite(vehicle.id)}
                        className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm shadow-sm flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors focus:outline-none cursor-pointer"
                      >
                        <Heart size={14} className={isFavorite ? 'fill-rose-500 text-rose-500' : ''} />
                      </button>

                      {/* Category Label */}
                      <div className="absolute top-3.5 left-3.5">
                        <span className="bg-slate-900/90 text-white font-bold text-[9px] px-2 py-0.5 rounded uppercase tracking-wider">
                          {vehicle.type.category_name}
                        </span>
                      </div>

                      {/* Rating Overlay */}
                      <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-sm px-2 py-0.5 rounded shadow-sm text-[10px] font-bold text-slate-800 flex items-center gap-0.5 border border-slate-100">
                        <Star size={10} className="fill-amber-400 text-amber-400 shrink-0" />
                        {mockRating} <span className="text-slate-400 font-normal">({mockTrips})</span>
                      </div>
                    </div>

                    {/* Content Block */}
                    <div className="p-4 flex-grow flex flex-col justify-between">
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-base leading-tight">
                          {vehicle.make} {vehicle.model}
                        </h4>
                        <div className="flex gap-2.5 mt-2.5 text-[10px] text-slate-400 uppercase font-bold tracking-wide">
                          <span>{vehicle.type.transmission}</span>
                          <span>•</span>
                          <span>{vehicle.type.seating_capacity} Seats</span>
                        </div>
                        <div className="flex items-center gap-1 mt-3 text-[10px] text-slate-500">
                          <MapPin size={12} className="text-slate-400 shrink-0" />
                          <span>{simulatedDistance} km away • {vehicle.location.hub_name.split(' ')[0]} Hub</span>
                        </div>
                      </div>

                      {/* Pricing and Action button */}
                      <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-end justify-between">
                        <div>
                          <span className="text-lg font-black text-slate-900 block leading-none">
                            ₹{hourlyRate} <span className="text-xs font-normal text-slate-400">/ hr</span>
                          </span>
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mt-1">
                            ₹{pricing.totalPrice} total (excl. fees)
                          </span>
                        </div>
                        <button
                          onClick={() => handleBookNow(vehicle)}
                          className="bg-brand-600 hover:bg-slate-900 text-white font-bold text-xs py-2 px-4 rounded-xl transition-all hover:scale-[1.03] active:scale-[0.97] cursor-pointer shadow-md shadow-brand-500/10 hover:shadow-none"
                        >
                          Book Ride
                        </button>
                      </div>
                    </div>

                    {/* Professional Host Golden Banner */}
                    {(isSuv || isSedan) && (
                      <div className="bg-amber-50/70 border-t border-amber-100 py-1.5 px-4 text-center">
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
      </div>
    </div>
  );
}

export default function Vehicles() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-10 h-10 text-brand-600 animate-spin" />
        <p className="text-slate-600 font-medium">Scanning fleet availability in Ahmedabad...</p>
      </div>
    }>
      <VehiclesContent />
    </Suspense>
  );
}
