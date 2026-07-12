'use client';

import React, { useEffect, useState } from 'react';
import { useStore } from '../../../store/store';
import {
  Car,
  Compass,
  Gauge,
  Info,
  Map,
  ShieldAlert,
  Loader2,
  Lock,
  Unlock,
  ArrowLeft,
  RefreshCw,
  ZapOff
} from 'lucide-react';
import Link from 'next/link';

const API_BASE_URL = 'http://localhost:5000/api';

export default function GpsDashboard() {
  const { user, token, logout, dispatchTelemetryCommand } = useStore();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [region, setRegion] = useState<'ahmedabad' | 'ny'>('ahmedabad');
  const [speedLimitCap, setSpeedLimitCap] = useState(120);

  const handleTelemetryCommand = async (vehicleId: string, command: string, speedLimit?: number) => {
    const success = await dispatchTelemetryCommand(vehicleId, command, speedLimit);
    if (success) {
      fetchGpsData(false);
      setSelectedVehicle((prev: any) => {
        if (!prev) return null;
        let is_locked = prev.is_locked;
        let engine_disabled = prev.engine_disabled;
        let limit = prev.speed_limit;

        if (command === 'LOCK') is_locked = true;
        else if (command === 'UNLOCK') is_locked = false;
        else if (command === 'IMMOBILIZE') engine_disabled = true;
        else if (command === 'MOBILIZE') engine_disabled = false;

        if (speedLimit !== undefined) limit = speedLimit;

        return { ...prev, is_locked, engine_disabled, speed_limit: limit };
      });
    }
  };

  useEffect(() => {
    if (selectedVehicle) {
      setSpeedLimitCap(selectedVehicle.speed_limit || 120);
    }
  }, [selectedVehicle?.id]);

  const fetchGpsData = async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const query = new URLSearchParams({ region }).toString();
      const res = await fetch(`${API_BASE_URL}/admin/vehicles/gps?${query}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.status === 401) {
        logout();
        throw new Error('Your session has expired. Please log in again.');
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to sync telematics data');
      setVehicles(data);

      // Keep selection in sync
      if (selectedVehicle) {
        const updated = data.find((v: any) => v.id === selectedVehicle.id);
        if (updated) setSelectedVehicle(updated);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  // Poll for live coordinate updates every 3 seconds
  useEffect(() => {
    if (token && user?.role === 'ADMIN') {
      fetchGpsData(true);
      const interval = setInterval(() => {
        fetchGpsData(false);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [token, user, region]);

  if (!token || user?.role !== 'ADMIN') {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 bg-white border border-slate-200 rounded-2xl text-center shadow-lg">
        <ShieldAlert className="w-12 h-12 text-rose-600 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-800">Access Denied</h3>
        <p className="text-slate-500 text-sm mt-2 leading-relaxed">
          Admin privileges are required to view the live GPS telematics dashboard. Please sign in as an admin.
        </p>
      </div>
    );
  }

  // Map coordinates to SVG bounding box representing Ahmedabad Hubs or NY Hubs
  const mapWidth = 500;
  const mapHeight = 500;
  const getSvgCoordinates = (lat: number, lng: number) => {
    let latMin = 22.99;
    let latMax = 23.09;
    let lngMin = 72.48;
    let lngMax = 72.64;

    if (region === 'ny') {
      latMin = 40.62;
      latMax = 40.80;
      lngMin = -74.02;
      lngMax = -73.74;
    }

    const x = ((lng - lngMin) / (lngMax - lngMin)) * mapWidth;
    // Invert Y axis for SVGs
    const y = mapHeight - ((lat - latMin) / (latMax - latMin)) * mapHeight;

    return { x, y };
  };

  // Hubs static coordinates
  const hubs = region === 'ahmedabad' ? [
    { name: 'AMD Airport Arrivals Hub', lat: 23.0725, lng: 72.6247 },
    { name: 'SG Highway Hub', lat: 23.0645, lng: 72.5312 },
    { name: 'Prahlad Nagar Zone', lat: 23.0078, lng: 72.5064 },
    { name: 'Navrangpura Hub', lat: 23.0372, lng: 72.5511 }
  ] : [
    { name: 'LaGuardia Airport Hub (LGA)', lat: 40.7769, lng: -73.8740 },
    { name: 'Times Square Hub (Manhattan)', lat: 40.7580, lng: -73.9855 },
    { name: 'Brooklyn Hub (DUMBO)', lat: 40.6976, lng: -73.9796 },
    { name: 'JFK Airport Arrivals Hub', lat: 40.6413, lng: -73.7781 }
  ];

  return (
    <div className="max-width-container py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link href="/admin" className="flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700 mb-2 transition-colors">
            <ArrowLeft size={16} /> Operations Console
          </Link>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Map className="text-slate-900" size={28} /> Fleet Live GPS Tracking
          </h2>
          <p className="text-sm text-slate-500 mt-1">Real-time GPS telematics linked to vehicles active in the selected region. Updates every 3s.</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={region}
            onChange={(e) => {
              setRegion(e.target.value as 'ahmedabad' | 'ny');
              setSelectedVehicle(null);
            }}
            className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none shadow-sm cursor-pointer"
          >
            <option value="ahmedabad">Ahmedabad Region</option>
            <option value="ny">New York Region</option>
          </select>
          <button
            onClick={() => fetchGpsData(true)}
            className="bg-white hover:bg-slate-50 text-slate-700 font-bold px-4 py-2 border border-slate-200 rounded-lg text-sm flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Force Refresh
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
          <Loader2 className="w-10 h-10 text-brand-600 animate-spin" />
          <p className="text-slate-600 font-medium">Connecting to vehicle telematics servers...</p>
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
          {/* SVG Map Display */}
          <div className="lg:col-span-3 bg-slate-950 rounded-2xl p-6 shadow-xl border border-slate-800 flex flex-col items-center relative overflow-hidden h-[540px]">
            {/* Background elements */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-35" />

            <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-4 z-10 self-start">
              Live {region === 'ahmedabad' ? 'Ahmedabad' : 'New York'} Radar Grid
            </div>

            {/* Radar SVG map */}
            <svg viewBox={`0 0 ${mapWidth} ${mapHeight}`} className="w-full h-full max-h-[440px] z-10">
              {/* Grid Roads simulation */}
              <line x1="50" y1="0" x2="50" y2="500" stroke="#1e293b" strokeWidth="1" strokeDasharray="5,5" />
              <line x1="200" y1="0" x2="200" y2="500" stroke="#1e293b" strokeWidth="1" strokeDasharray="5,5" />
              <line x1="350" y1="0" x2="350" y2="500" stroke="#1e293b" strokeWidth="1" strokeDasharray="5,5" />
              <line x1="0" y1="150" x2="500" y2="150" stroke="#1e293b" strokeWidth="1" strokeDasharray="5,5" />
              <line x1="0" y1="350" x2="500" y2="350" stroke="#1e293b" strokeWidth="1" strokeDasharray="5,5" />

              {/* Draw Hub zones */}
              {hubs.map((hub, idx) => {
                const { x, y } = getSvgCoordinates(hub.lat, hub.lng);
                return (
                  <g key={idx}>
                    {/* Pulsing zone radius */}
                    <circle cx={x} cy={y} r="30" fill="#3b82f6" fillOpacity="0.04" stroke="#3b82f6" strokeWidth="1" strokeDasharray="2,2" />
                    <circle cx={x} cy={y} r="4" fill="#3b82f6" />
                    <text x={x + 8} y={y + 4} fill="#64748b" fontSize="8" fontWeight="bold">
                      {hub.name.split(' ')[0]}
                    </text>
                  </g>
                );
              })}

              {/* Draw Active Vehicle Markers */}
              {vehicles.map((v) => {
                const { x, y } = getSvgCoordinates(v.telemetry.latitude, v.telemetry.longitude);
                const isSelected = selectedVehicle?.id === v.id;
                const isBooked = v.status === 'BOOKED';

                return (
                  <g
                    key={v.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedVehicle(v)}
                  >
                    {isBooked && (
                      <circle
                        cx={x}
                        cy={y}
                        r="12"
                        fill={isSelected ? '#10b981' : '#f59e0b'}
                        fillOpacity="0.15"
                        className="animate-ping"
                        style={{ animationDuration: '3s' }}
                      />
                    )}
                    <rect
                      x={x - 6}
                      y={y - 6}
                      width="12"
                      height="12"
                      rx="3"
                      fill={isSelected ? '#10b981' : isBooked ? '#f59e0b' : '#3b82f6'}
                      stroke="#0f172a"
                      strokeWidth="1.5"
                    />
                    <text x={x + 9} y={y - 2} fill={isSelected ? '#10b981' : '#cbd5e1'} fontSize="7" fontWeight="black" fontFamily="monospace">
                      {v.license_plate.split('-').pop()}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Details Sidebar / Vehicle List */}
          <div className="lg:col-span-2 space-y-6">
            {/* Selected vehicle profile */}
            {selectedVehicle ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
                <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-lg">
                      {selectedVehicle.make} {selectedVehicle.model}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{selectedVehicle.license_plate}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selectedVehicle.status === 'AVAILABLE' ? 'bg-success-50 text-success-700' : 'bg-amber-50 text-amber-700'}`}>
                    {selectedVehicle.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-slate-700 text-xs">
                  <div className="bg-slate-50 p-3 rounded-xl flex items-center gap-3">
                    <Gauge size={20} className="text-brand-500" />
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Speedometer</p>
                      <p className="font-bold text-sm text-slate-800">{selectedVehicle.telemetry.speed} km/h</p>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl flex items-center gap-3">
                    <Compass size={20} className="text-brand-500" />
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Bearing / Dir</p>
                      <p className="font-bold text-sm text-slate-800">{selectedVehicle.telemetry.bearing}° N</p>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl flex items-center gap-3">
                    <div className="w-5 h-5 bg-brand-100 text-brand-600 rounded flex items-center justify-center shrink-0">
                      %
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Fuel Level</p>
                      <p className="font-bold text-sm text-slate-800">{selectedVehicle.telemetry.fuel}% Full</p>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl flex items-center gap-3">
                    <div className="w-5 h-5 bg-brand-100 text-brand-600 rounded flex items-center justify-center shrink-0">
                      E
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Engine State</p>
                      <p className={`font-bold text-sm uppercase ${selectedVehicle.telemetry.engine === 'ON' ? 'text-success-600' : 'text-slate-500'}`}>
                        {selectedVehicle.telemetry.engine}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-500 space-y-2 border-t border-slate-100 pt-4">
                  <div className="flex justify-between">
                    <span>GPS Latitude:</span>
                    <span className="font-mono text-slate-700">{selectedVehicle.telemetry.latitude.toFixed(6)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GPS Longitude:</span>
                    <span className="font-mono text-slate-700">{selectedVehicle.telemetry.longitude.toFixed(6)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Hub Assigned:</span>
                    <span className="font-semibold text-slate-700">{selectedVehicle.hubName}</span>
                  </div>
                </div>

                {/* IoT Remote Controls Panel */}
                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">IoT Telematics Commands</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleTelemetryCommand(selectedVehicle.id, selectedVehicle.is_locked ? 'UNLOCK' : 'LOCK')}
                      className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${selectedVehicle.is_locked ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-rose-600 hover:bg-rose-700 text-white'}`}
                    >
                      {selectedVehicle.is_locked ? <Unlock size={12} /> : <Lock size={12} />}
                      {selectedVehicle.is_locked ? 'Remote Unlock' : 'Remote Lock'}
                    </button>
                    <button
                      onClick={() => handleTelemetryCommand(selectedVehicle.id, selectedVehicle.engine_disabled ? 'MOBILIZE' : 'IMMOBILIZE')}
                      className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${selectedVehicle.engine_disabled ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-800 hover:bg-slate-900 text-white'}`}
                    >
                      {selectedVehicle.engine_disabled ? <Unlock size={12} /> : <Lock size={12} />}
                      {selectedVehicle.engine_disabled ? 'Mobilize Engine' : 'Immobilize Engine'}
                    </button>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-2xl space-y-2 border border-slate-200/50">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Speed Limit Cap</span>
                      <span className="font-bold text-brand-600">{speedLimitCap} km/h</span>
                    </div>
                    <input
                      type="range"
                      min="60"
                      max="180"
                      step="10"
                      value={speedLimitCap}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setSpeedLimitCap(val);
                        handleTelemetryCommand(selectedVehicle.id, 'LIMIT', val);
                      }}
                      className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-600"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-6 text-center text-slate-500 text-sm">
                <Info className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="font-semibold text-slate-700">No Vehicle Selected</p>
                <p className="text-xs text-slate-400 mt-1">Click on any vehicle marker on the radar map to display live GPS coordinates and engine fuel telemetry.</p>
              </div>
            )}

            {/* List scroll ledger */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col max-h-[300px]">
              <div className="px-5 py-3 border-b border-slate-100">
                <h4 className="font-bold text-slate-800 text-sm">Fleet Telematics Ledger</h4>
              </div>
              <div className="divide-y divide-slate-100 overflow-y-auto">
                {vehicles.map((v) => (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVehicle(v)}
                    className={`p-3.5 flex items-center justify-between text-xs cursor-pointer hover:bg-slate-50 transition-colors ${selectedVehicle?.id === v.id ? 'bg-slate-50 font-semibold' : ''}`}
                  >
                    <div>
                      <p className="text-slate-800 font-bold">{v.make} {v.model}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">{v.license_plate}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-700">{v.telemetry.speed} km/h</p>
                      <p className="text-[9px] text-slate-400 mt-0.5 uppercase">Fuel {v.telemetry.fuel}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
