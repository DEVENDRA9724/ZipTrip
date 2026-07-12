'use client';

import React, { useEffect, useState } from 'react';
import { useStore } from '../../store/store';
import {
  ShieldAlert,
  Loader2,
  Plus,
  Car,
  Users,
  CalendarDays,
  TrendingUp,
  X,
  FileSpreadsheet,
  Camera,
  Trash2,
  Upload
} from 'lucide-react';
import Link from 'next/link';

const API_BASE_URL = 'http://localhost:5000/api';

export default function AdminConsole() {
  const { user, token, logout } = useStore();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Onboarding & Editing Form Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('2023');
  const [licensePlate, setLicensePlate] = useState('');
  const [typeId, setTypeId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [featuresText, setFeaturesText] = useState('Sunroof, GPS, Air Conditioning, Bluetooth');
  const [uploadedImages, setUploadedImages] = useState<string[]>(['', '', '', '']);
  const [speedLimit, setSpeedLimit] = useState(120);
  const [vehicleStatus, setVehicleStatus] = useState('AVAILABLE');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleImageUpload = (index: number, file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setUploadedImages(prev => {
        const next = [...prev];
        next[index] = base64String;
        return next;
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = (index: number) => {
    setUploadedImages(prev => {
      const next = [...prev];
      next[index] = '';
      return next;
    });
  };

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.status === 401) {
        logout();
        throw new Error('Your session has expired. Please log in again.');
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch admin metrics');
      setDashboardData(data);

      // Pre-select defaults for onboarding form
      if (data.vehicleTypes?.length > 0) setTypeId(data.vehicleTypes[0].id);
      if (data.locations?.length > 0) setLocationId(data.locations[0].id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token && user?.role === 'ADMIN') {
      fetchDashboard();
    }
  }, [token, user]);

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);

    const features = featuresText.split(',').map(f => f.trim()).filter(Boolean);
    const images = uploadedImages.filter(Boolean);
    const finalImages = images.length > 0 ? images : ['https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&q=80&w=600'];

    try {
      const isEditing = !!editingVehicleId;
      const url = isEditing 
        ? `${API_BASE_URL}/admin/vehicles/edit/${editingVehicleId}` 
        : `${API_BASE_URL}/admin/vehicles/add`;
      const method = isEditing ? 'PUT' : 'POST';

      const bodyData = {
        type_id: typeId,
        location_id: locationId,
        license_plate: licensePlate,
        make,
        model,
        year,
        features,
        images: finalImages,
        ...(isEditing && {
          status: vehicleStatus,
          speed_limit: speedLimit
        })
      };

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(bodyData)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to process vehicle asset');

      // Success Reset
      setShowAddModal(false);
      setEditingVehicleId(null);
      setMake('');
      setModel('');
      setYear('2023');
      setLicensePlate('');
      setFeaturesText('Sunroof, GPS, Air Conditioning, Bluetooth');
      setUploadedImages(['', '', '', '']);
      setSpeedLimit(120);
      setVehicleStatus('AVAILABLE');
      fetchDashboard(); // reload metrics
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (vehicle: any) => {
    setEditingVehicleId(vehicle.id);
    setMake(vehicle.make);
    setModel(vehicle.model);
    setYear(vehicle.year.toString());
    setLicensePlate(vehicle.license_plate);
    setTypeId(vehicle.type_id);
    setLocationId(vehicle.location_id);
    
    try {
      const parsedFeatures = JSON.parse(vehicle.features);
      setFeaturesText(Array.isArray(parsedFeatures) ? parsedFeatures.join(', ') : vehicle.features);
    } catch {
      setFeaturesText(vehicle.features);
    }

    try {
      const parsedImages = JSON.parse(vehicle.images);
      if (Array.isArray(parsedImages)) {
        const mapped = ['', '', '', ''];
        parsedImages.forEach((img, idx) => {
          if (idx < 4) mapped[idx] = img;
        });
        setUploadedImages(mapped);
      } else {
        setUploadedImages([vehicle.images, '', '', '']);
      }
    } catch {
      setUploadedImages([vehicle.images, '', '', '']);
    }

    setSpeedLimit(vehicle.speed_limit || 120);
    setVehicleStatus(vehicle.status || 'AVAILABLE');
    setSubmitError(null);
    setShowAddModal(true);
  };

  if (!token || user?.role !== 'ADMIN') {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 bg-white border border-slate-200 rounded-2xl text-center shadow-lg">
        <ShieldAlert className="w-12 h-12 text-rose-600 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-800">Admin Access Denied</h3>
        <p className="text-slate-500 text-sm mt-2 leading-relaxed">
          You must be logged in as an administrator to access the fleet management dashboard. Try signing in using <strong>admin@ziptrip.com</strong>.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-10 h-10 text-brand-600 animate-spin" />
        <p className="text-slate-600 font-medium">Loading administrative dashboard metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-20 p-6 bg-rose-50 border border-rose-200 rounded-xl text-center shadow-sm">
        <ShieldAlert className="w-12 h-12 text-rose-600 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-rose-800">Metrics Sync Failed</h3>
        <p className="text-slate-600 text-sm mt-2">{error}</p>
        <button onClick={fetchDashboard} className="mt-4 bg-brand-600 hover:bg-brand-700 text-white font-semibold px-4 py-2 rounded-lg transition-all shadow-md">
          Retry Sync
        </button>
      </div>
    );
  }

  const { metrics, vehicles, recentBookings, locations, vehicleTypes } = dashboardData;

  return (
    <div className="max-width-container py-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Admin Operations Console</h2>
          <p className="text-sm text-slate-500 mt-1">Real-time status monitoring, fleet onboarding, and billing logs.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/gps"
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2.5 rounded-lg text-sm flex items-center gap-1.5 shadow-sm transition-all"
          >
            Live GPS Tracking
          </Link>
          <Link
            href="/admin/documents"
            className="bg-indigo-900 hover:bg-indigo-800 text-white font-bold px-4 py-2.5 rounded-lg text-sm flex items-center gap-1.5 shadow-sm transition-all"
          >
            Review KYC Docs
          </Link>
          <button
            onClick={() => {
              setEditingVehicleId(null);
              setMake('');
              setModel('');
              setYear('2023');
              setLicensePlate('');
              setFeaturesText('Sunroof, GPS, Air Conditioning, Bluetooth');
              setUploadedImages(['', '', '', '']);
              setSpeedLimit(120);
              setVehicleStatus('AVAILABLE');
              setSubmitError(null);
              setShowAddModal(true);
            }}
            className="bg-brand-600 hover:bg-brand-700 text-white font-bold px-4 py-2.5 rounded-lg text-sm flex items-center gap-1.5 shadow-md hover:shadow-lg transition-all cursor-pointer"
          >
            <Plus size={16} /> Onboard New Vehicle
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Fleet Assets</p>
            <p className="text-3xl font-extrabold text-slate-900 mt-1">{metrics.totalVehicles}</p>
            <p className="text-xs text-slate-500 mt-1">
              <span className="text-emerald-600 font-semibold">{metrics.statusDistribution.AVAILABLE} Available</span> | {metrics.statusDistribution.MAINTENANCE} Main.
            </p>
          </div>
          <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-lg flex items-center justify-center">
            <Car size={24} />
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Registered Users</p>
            <p className="text-3xl font-extrabold text-slate-900 mt-1">{metrics.totalUsers}</p>
            <p className="text-xs text-slate-500 mt-1">Active customer profiles</p>
          </div>
          <div className="w-12 h-12 bg-sky-50 text-sky-600 rounded-lg flex items-center justify-center">
            <Users size={24} />
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bookings Logged</p>
            <p className="text-3xl font-extrabold text-slate-900 mt-1">{metrics.totalBookings}</p>
            <p className="text-xs text-slate-500 mt-1">All time checkout counts</p>
          </div>
          <div className="w-12 h-12 bg-violet-50 text-violet-600 rounded-lg flex items-center justify-center">
            <CalendarDays size={24} />
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gross Fleet Revenue</p>
            <p className="text-3xl font-extrabold text-slate-900 mt-1">₹{metrics.revenue.toFixed(2)}</p>
            <p className="text-xs text-slate-500 mt-1">Stamping & taxes included</p>
          </div>
          <div className="w-12 h-12 bg-success-50 text-success-600 rounded-lg flex items-center justify-center">
            <TrendingUp size={24} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Fleet Listings Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-lg">Active Fleet Inventory</h3>
            <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-bold border border-slate-200">
              {vehicles.length} Active
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-400 font-bold text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3">Vehicle Details</th>
                  <th className="px-6 py-3">Hub Location</th>
                  <th className="px-6 py-3">Category</th>
                  <th className="px-6 py-3">Plate No</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {vehicles.map((v: any) => (
                  <tr key={v.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      {v.make} {v.model} <span className="font-normal text-xs text-slate-400">({v.year})</span>
                    </td>
                    <td className="px-6 py-4 text-xs">{v.location.hub_name}</td>
                    <td className="px-6 py-4 text-xs font-semibold text-slate-600">{v.type.category_name}</td>
                    <td className="px-6 py-4 text-xs font-mono font-bold">{v.license_plate}</td>
                    <td className="px-6 py-4 text-xs">
                      <span className={`px-2 py-0.5 rounded-full font-bold ${v.status === 'AVAILABLE' ? 'bg-success-50 text-success-700' : v.status === 'BOOKED' ? 'bg-indigo-50 text-indigo-700' : 'bg-rose-50 text-rose-700'}`}>
                        {v.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs">
                      <button
                        onClick={() => handleStartEdit(v)}
                        className="bg-slate-100 hover:bg-brand-50 text-slate-700 hover:text-brand-700 font-bold px-2.5 py-1 rounded transition-colors cursor-pointer"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Bookings and Contracts Log */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-800 text-lg font-bold">Recent Billing Logs</h3>
          </div>

          <div className="divide-y divide-slate-100 flex-1 overflow-y-auto max-h-[450px]">
            {recentBookings.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">
                No bookings logged in database.
              </div>
            ) : (
              recentBookings.map((b: any) => (
                <div key={b.id} className="p-4 hover:bg-slate-50/50 text-xs space-y-2">
                  <div className="flex justify-between font-semibold">
                    <span className="text-slate-800">{b.user.full_name}</span>
                    <span className="text-slate-900 font-extrabold">₹{b.total_price}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>{b.vehicle.make} {b.vehicle.model}</span>
                    <span className="font-mono">{b.vehicle.license_plate}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-dashed border-slate-100">
                    <span className="text-[10px] text-slate-400">Status: <strong>{b.status}</strong></span>
                    {b.agreement_pdf_url && (
                      <a
                        href={`http://localhost:5000${b.agreement_pdf_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-600 hover:underline flex items-center gap-0.5 font-bold"
                      >
                        <FileSpreadsheet size={10} /> Contract PDF
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

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

            <h3 className="text-xl font-bold text-slate-800 mb-2">
              {editingVehicleId ? 'Modify Fleet Asset' : 'Onboard Fleet Vehicle'}
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              {editingVehicleId ? 'Update details for this registered vehicle asset.' : 'Enter details to catalog a new self-drive rental asset.'}
            </p>

            {submitError && (
              <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded-lg p-3 text-sm mb-4">
                {submitError}
              </div>
            )}

            <form onSubmit={handleAddVehicle} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Make / Brand</label>
                  <input
                    type="text"
                    required
                    value={make}
                    onChange={(e) => setMake(e.target.value)}
                    placeholder="e.g. Mahindra"
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
                    placeholder="e.g. Thar"
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
                    placeholder="e.g. GJ-01-TH-7777"
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

              {editingVehicleId && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Asset Status</label>
                    <select
                      value={vehicleStatus}
                      onChange={(e) => setVehicleStatus(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-brand-600 focus:outline-none bg-white font-bold"
                    >
                      <option value="AVAILABLE">AVAILABLE</option>
                      <option value="BOOKED">BOOKED</option>
                      <option value="MAINTENANCE">MAINTENANCE</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Speed Limit Cap (km/h)</label>
                    <input
                      type="number"
                      required
                      value={speedLimit}
                      onChange={(e) => setSpeedLimit(parseInt(e.target.value))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-brand-600 focus:outline-none font-bold"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Features (Comma separated)</label>
                <input
                  type="text"
                  value={featuresText}
                  onChange={(e) => setFeaturesText(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Upload Vehicle Photos (Multiple Angles)</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {['Front Angle', 'Side Angle', 'Rear Angle', 'Interior'].map((viewName, idx) => {
                    const imgData = uploadedImages[idx];
                    return (
                      <div key={idx} className="relative aspect-video rounded-xl border-2 border-dashed border-slate-200 hover:border-brand-500 flex flex-col items-center justify-center overflow-hidden bg-slate-50 group transition-all h-24">
                        {imgData ? (
                          <>
                            <img src={imgData} alt={viewName} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity gap-2">
                              <button
                                type="button"
                                onClick={() => handleRemoveImage(idx)}
                                className="p-1 rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-colors cursor-pointer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </>
                        ) : (
                          <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer p-2 text-center select-none">
                            <Camera size={18} className="text-slate-400 mb-1 group-hover:scale-105 transition-transform" />
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{viewName}</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleImageUpload(idx, file);
                              }}
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-2.5 rounded-lg text-sm transition-all shadow-md mt-6 disabled:opacity-50 cursor-pointer"
              >
                {submitting 
                  ? (editingVehicleId ? 'Saving Changes...' : 'Adding Vehicle to Database...') 
                  : (editingVehicleId ? 'Save Vehicle Modifications' : 'Register Vehicle Asset')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
