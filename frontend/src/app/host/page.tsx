'use client';

import React, { useEffect, useState } from 'react';
import { useStore } from '../../store/store';
import {
  Car,
  TrendingUp,
  CircleDollarSign,
  Plus,
  ShieldCheck,
  Loader2,
  Lock,
  ArrowRight,
  Sparkles,
  Calendar,
  Layers,
  MapPin,
  CheckCircle2,
  X
} from 'lucide-react';
import Link from 'next/link';

const API_BASE_URL = 'http://localhost:5000/api';

export default function HostPortal() {
  const { user, token, locations, fetchLocations, logout, fetchHostDashboard, setAuthModalOpen } = useStore();
  const [hostedVehicles, setHostedVehicles] = useState<any[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Analytics Dashboard Tab states
  const [activeTab, setActiveTab] = useState<'listings' | 'analytics'>('listings');
  const [hostMetrics, setHostMetrics] = useState<any>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);

  const loadHostMetrics = async () => {
    setMetricsLoading(true);
    const data = await fetchHostDashboard();
    if (data) {
      setHostMetrics(data);
    }
    setMetricsLoading(false);
  };

  // Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('2023');
  const [licensePlate, setLicensePlate] = useState('');
  const [typeId, setTypeId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [featuresText, setFeaturesText] = useState('Android Auto, Rear Camera, Air Conditioning');
  const [imagesText, setImagesText] = useState('https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&q=80&w=600');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Earnings simulation
  const [simDays, setSimDays] = useState(15);
  const [simPrice, setSimPrice] = useState(2500);

  const fetchHostData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch locations if not done yet
      await fetchLocations();

      // Fetch dashboard metrics to extract vehicleTypes list
      const resDash = await fetch(`${API_BASE_URL}/admin/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (resDash.status === 401) {
        logout();
        throw new Error('Your session has expired. Please log in again.');
      }
      const dataDash = await resDash.json();
      if (resDash.ok) {
        setVehicleTypes(dataDash.vehicleTypes || []);
        if (dataDash.vehicleTypes?.length > 0) setTypeId(dataDash.vehicleTypes[0].id);
        if (dataDash.locations?.length > 0) setLocationId(dataDash.locations[0].id);

        // Filter vehicles hosted by this user
        const mine = (dataDash.vehicles || []).filter((v: any) => v.host_id === user?.id);
        setHostedVehicles(mine);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchHostData();
    }
  }, [token]);

  useEffect(() => {
    if (activeTab === 'analytics' && token) {
      loadHostMetrics();
    }
  }, [activeTab, token]);

  const handleAddHostVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);

    const features = featuresText.split(',').map(f => f.trim()).filter(Boolean);
    const images = imagesText.split(',').map(i => i.trim()).filter(Boolean);

    try {
      const res = await fetch(`${API_BASE_URL}/host/vehicles/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type_id: typeId,
          location_id: locationId,
          license_plate: licensePlate,
          make,
          model,
          year,
          features,
          images
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to onboard vehicle');

      // Success
      setShowAddModal(false);
      setMake('');
      setModel('');
      setLicensePlate('');
      alert('Your car has been listed successfully! It is now live in Ahmedabad searches.');
      fetchHostData(); // reload
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // 60% host revenue split calculation
  const getHostEarning = () => {
    return simDays * simPrice * 0.60;
  };

  if (!token) {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 bg-white border border-slate-200 rounded-2xl text-center shadow-lg animate-fade-in-up">
        <Lock className="w-12 h-12 text-brand-600 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-800">Hosting Access Denied</h3>
        <p className="text-slate-500 text-sm mt-2 leading-relaxed">
          You must be registered and signed in to list your private vehicle on the ZipTrip platform.
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
        <p className="text-slate-600 font-medium">Loading host portal configurations...</p>
      </div>
    );
  }

  return (
    <div className="max-width-container py-10">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Host Dashboard</h2>
          <p className="text-sm text-slate-500 mt-1">Rent out your vehicle when you are not using it. Earn passive revenue with our 60% host share split.</p>
        </div>
        <button
          onClick={() => {
            setSubmitError(null);
            setShowAddModal(true);
          }}
          className="bg-brand-600 hover:bg-brand-700 text-white font-bold px-4 py-2.5 rounded-lg text-sm flex items-center gap-1.5 shadow-md hover:shadow-lg transition-all cursor-pointer"
        >
          <Plus size={16} /> List Your Vehicle
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 mb-8">
        <button
          onClick={() => setActiveTab('listings')}
          className={`pb-3 text-sm font-bold border-b-2 px-4 transition-colors ${activeTab === 'listings' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          My Listings ({hostedVehicles.length})
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`pb-3 text-sm font-bold border-b-2 px-4 transition-colors ${activeTab === 'analytics' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          Host Earnings & Analytics Dashboard
        </button>
      </div>

      {activeTab === 'listings' ? (
        <>
          {/* Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hosted Vehicles</p>
                <p className="text-3xl font-extrabold text-slate-900 mt-1">{hostedVehicles.length}</p>
                <p className="text-xs text-slate-500 mt-1">Live listings in Ahmedabad hubs</p>
              </div>
              <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-lg flex items-center justify-center">
                <Car size={24} />
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider font-bold">Estimated Host Share</p>
                <p className="text-3xl font-extrabold text-slate-900 mt-1">60% Payout</p>
                <p className="text-xs text-slate-500 mt-1">Of gross booking rates disbursed weekly</p>
              </div>
              <div className="w-12 h-12 bg-success-50 text-success-600 rounded-lg flex items-center justify-center">
                <CircleDollarSign size={24} />
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Host Protection</p>
                <p className="text-3xl font-extrabold text-slate-900 mt-1">₹0 Liability</p>
                <p className="text-xs text-slate-500 mt-1">Comprehensive vehicle damage insurance covered</p>
              </div>
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center">
                <ShieldCheck size={24} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Listed Vehicles Inventory */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 text-lg">My Listed Vehicles</h3>
                <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded font-bold">
                  {hostedVehicles.length} Listed
                </span>
              </div>

              {hostedVehicles.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-sm">
                  <Car className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="font-semibold text-slate-700">You haven't listed any cars yet.</p>
                  <p className="text-xs text-slate-400 mt-1">List your Swift, City, or XUV700 to start generating earnings.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {hostedVehicles.map((v) => (
                    <div key={v.id} className="p-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between animate-fade-in-up">
                      <div className="flex gap-4">
                        <img
                          src={v.images[0]}
                          alt={v.make}
                          className="w-20 h-14 object-cover rounded bg-slate-100 shrink-0"
                        />
                        <div>
                          <h4 className="font-bold text-slate-900 leading-tight">{v.make} {v.model}</h4>
                          <p className="text-xs text-slate-400 font-mono mt-1">{v.license_plate} | {v.type.category_name}</p>
                          <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
                            <MapPin size={12} className="text-brand-500" />
                            <span>Home Hub: <strong>{v.location.hub_name}</strong></span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${v.status === 'AVAILABLE' ? 'bg-success-50 text-success-700 border border-success-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                          {v.status === 'AVAILABLE' ? 'Active & Searchable' : v.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Earning Calculator Widget */}
            <div className="bg-slate-950 text-white rounded-2xl p-6 shadow-xl border border-slate-800 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold border-b border-slate-800 pb-3 mb-5 flex items-center gap-1.5">
                  <Sparkles size={18} className="text-brand-400" /> Host Earnings Calculator
                </h3>

                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Estimated Rental Price (₹/day):
                    </label>
                    <div className="flex items-center justify-between gap-4">
                      <input
                        type="range"
                        min={1000}
                        max={4000}
                        step={100}
                        value={simPrice}
                        onChange={(e) => setSimPrice(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
                      />
                      <span className="font-extrabold text-sm shrink-0 min-w-[70px] text-right">₹{simPrice}/d</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Active Rental Days per month:
                    </label>
                    <div className="flex items-center justify-between gap-4">
                      <input
                        type="range"
                        min={5}
                        max={30}
                        step={1}
                        value={simDays}
                        onChange={(e) => setSimDays(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
                      />
                      <span className="font-extrabold text-sm shrink-0 min-w-[70px] text-right">{simDays} days</span>
                    </div>
                  </div>
                </div>

                <div className="my-6 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2 text-xs text-slate-400">
                  <div className="flex justify-between">
                    <span>Gross Rental Income:</span>
                    <span className="text-slate-200">₹{simDays * simPrice}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Platform Commission (40%):</span>
                    <span className="text-rose-400">-₹{simDays * simPrice * 0.40}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800 pt-2 text-sm font-bold text-slate-200">
                    <span>Your Payout (60% share):</span>
                    <span className="text-success-500 font-extrabold">₹{getHostEarning()}</span>
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-slate-500 leading-normal">
                Calculations are estimations. Actual weekly payouts will scale with regional demand modifiers, holiday surges, and vehicle categorization.
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-8 animate-fade-in-up">
          {metricsLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-10 h-10 text-brand-600 animate-spin" />
              <p className="text-slate-600 font-medium">Fetching host earnings metrics...</p>
            </div>
          ) : hostMetrics ? (
            <div className="space-y-8">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Gross Earnings</span>
                  <p className="text-2xl font-black text-slate-800 mt-2">₹{hostMetrics.metrics.grossEarnings}</p>
                  <p className="text-xs text-slate-400 mt-1">Total customer booking value</p>
                </div>
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm border-brand-500/20 shadow-brand-500/5">
                  <span className="text-[10px] text-brand-500 font-bold uppercase tracking-wider block">Your 60% Share</span>
                  <p className="text-2xl font-black text-brand-600 mt-2">₹{hostMetrics.metrics.hostShare}</p>
                  <p className="text-xs text-brand-400 mt-1">Net earnings generated</p>
                </div>
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Simulated Occupancy</span>
                  <p className="text-2xl font-black text-slate-800 mt-2">{hostMetrics.metrics.occupancyRate}%</p>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2">
                    <div style={{ width: `${hostMetrics.metrics.occupancyRate}%` }} className="bg-brand-600 h-1.5 rounded-full" />
                  </div>
                </div>
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Bookings Logs</span>
                  <p className="text-2xl font-black text-slate-800 mt-2">{hostMetrics.metrics.totalBookings} trips</p>
                  <p className="text-xs text-slate-400 mt-1">Rentals fulfilled</p>
                </div>
              </div>

              {/* Main analytics panels */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Host Fleet lists */}
                <div className="lg:col-span-2 bg-white border border-slate-200 shadow-sm rounded-3xl overflow-hidden flex flex-col">
                  <div className="px-6 py-4 border-b border-slate-100">
                    <h3 className="font-bold text-slate-800 text-sm">Vehicle Occupancy Breakdown</h3>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {hostMetrics.vehicles.map((vh: any) => (
                      <div key={vh.id} className="p-5 flex justify-between items-center text-xs">
                        <div>
                          <p className="font-bold text-slate-800">{vh.make} {vh.model}</p>
                          <p className="text-slate-400 mt-0.5 font-mono">{vh.license_plate}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-slate-800">{vh.bookingsCount} bookings</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${vh.status === 'AVAILABLE' ? 'bg-success-50 text-success-700' : 'bg-amber-50 text-amber-700'}`}>
                            {vh.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Customer Reviews */}
                <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 space-y-4 font-semibold">
                  <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-3">Renter Reviews</h3>
                  <div className="space-y-4">
                    {hostMetrics.feedback.map((f: any, idx: number) => (
                      <div key={idx} className="space-y-1.5 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span className="font-bold text-slate-600">{f.author}</span>
                          <span>{f.date}</span>
                        </div>
                        <div className="flex text-amber-500">
                          {Array.from({ length: f.rating }).map((_, i) => (
                            <span key={i}>★</span>
                          ))}
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed font-semibold">"{f.comment}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 bg-white border border-slate-200 border-dashed rounded-3xl text-slate-500 text-sm">
              Failed to load analytics. Please try again.
            </div>
          )}
        </div>
      )}

      {/* Onboarding Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl relative border border-gray-100 overflow-y-auto max-h-[90vh]">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>

            <h3 className="text-xl font-bold text-slate-800 mb-2">Onboard Host Vehicle</h3>
            <p className="text-sm text-slate-500 mb-6">List your vehicle for self-drive and start generating earnings.</p>

            {submitError && (
              <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded-lg p-3 text-sm mb-4">
                {submitError}
              </div>
            )}

            <form onSubmit={handleAddHostVehicle} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Make / Brand</label>
                  <input
                    type="text"
                    required
                    value={make}
                    onChange={(e) => setMake(e.target.value)}
                    placeholder="e.g. Maruti Suzuki"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Model Name</label>
                  <input
                    type="text"
                    required
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="e.g. Swift"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Year of manufacture</label>
                  <input
                    type="number"
                    required
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">License Plate No (Unique)</label>
                  <input
                    type="text"
                    required
                    value={licensePlate}
                    onChange={(e) => setLicensePlate(e.target.value)}
                    placeholder="e.g. GJ-01-XX-9999"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Category Type</label>
                  <select
                    value={typeId}
                    onChange={(e) => setTypeId(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-brand-600 focus:outline-none bg-white"
                  >
                    {vehicleTypes.map((t: any) => (
                      <option key={t.id} value={t.id}>{t.category_name} ({t.transmission})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Home Hub Location</label>
                  <select
                    value={locationId}
                    onChange={(e) => setLocationId(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-brand-600 focus:outline-none bg-white"
                  >
                    {locations.map((l: any) => (
                      <option key={l.id} value={l.id}>{l.hub_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Features (Comma separated)</label>
                <input
                  type="text"
                  value={featuresText}
                  onChange={(e) => setFeaturesText(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Image URLs (Comma separated)</label>
                <input
                  type="text"
                  value={imagesText}
                  onChange={(e) => setImagesText(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-2.5 rounded-lg text-sm transition-all shadow-md mt-6 disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'Registering with platforms...' : 'Register Vehicle for Hosting'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
