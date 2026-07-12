'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useStore } from '../../../store/store';
import {
  Compass,
  ArrowLeft,
  Fuel,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  Lock,
  Unlock,
  Plus,
  Trash2
} from 'lucide-react';
import Link from 'next/link';

export default function HandoverCheckin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get('bookingId');
  
  const { token, completeHandover, error, clearError } = useStore();
  const [fuelLevel, setFuelLevel] = useState(100);
  const [scratches, setScratches] = useState<string[]>([]);
  const [newScratch, setNewScratch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [doorAnimation, setDoorAnimation] = useState(false);

  // Clickable car blueprint scratch logger
  const [blueprintScratches, setBlueprintScratches] = useState<{ x: number; y: number; part: string }[]>([]);

  const handleAddScratch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScratch.trim()) return;
    setScratches(prev => [...prev, newScratch.trim()]);
    setNewScratch('');
  };

  const handleRemoveScratch = (idx: number) => {
    setScratches(prev => prev.filter((_, i) => i !== idx));
  };

  const handleBlueprintClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    
    // Estimate part based on click zone
    let part = 'Body Panel';
    if (x < 25) part = 'Front Bumper / Grille';
    else if (x > 75) part = 'Rear Bumper / Trunk';
    else if (y < 30) part = 'Left Side Doors';
    else if (y > 70) part = 'Right Side Doors';
    else part = 'Roof / Hood';

    const scratchDesc = `Scratch on ${part} (Grid: ${x}%, ${y}%)`;
    setBlueprintScratches(prev => [...prev, { x, y, part }]);
    setScratches(prev => [...prev, scratchDesc]);
  };

  const handleClearBlueprintScratch = (idx: number, desc: string) => {
    setBlueprintScratches(prev => prev.filter((_, i) => i !== idx));
    setScratches(prev => prev.filter(s => s !== desc));
  };

  const handleSubmitCheckin = async () => {
    if (!bookingId) return;
    clearError();
    setSubmitting(true);

    const successRes = await completeHandover(bookingId, fuelLevel, scratches);
    setSubmitting(false);

    if (successRes) {
      setDoorAnimation(true);
      // Simulate remote unlocking delay
      setTimeout(() => {
        setSuccess(true);
      }, 2500);
    }
  };

  if (!token) {
    return (
      <div className="max-width-container py-16 text-center">
        <Lock className="w-12 h-12 text-rose-600 mx-auto mb-4" />
        <h3 className="text-xl font-bold">Access Denied</h3>
        <p className="text-slate-500 text-sm mt-2">Log in to complete the vehicle pre-trip handover checklist.</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-width-container py-16 text-center max-w-xl mx-auto">
        <div className="w-20 h-20 rounded-full bg-emerald-50 border border-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/5 animate-bounce">
          <Unlock size={44} className="animate-pulse" />
        </div>
        <h2 className="text-3xl font-black text-slate-800 animate-fade-in-down">Handover Completed!</h2>
        <p className="text-slate-500 text-sm mt-3 leading-relaxed">
          The vehicle check-in was successfully logged. Doors have been unlocked remotely via IoT. Please inspect the key inside the glove box. Have a safe drive!
        </p>

        <div className="mt-8 bg-slate-50 border border-slate-200/80 rounded-2xl p-6 text-left text-xs space-y-2.5">
          <p className="flex justify-between border-b border-slate-200 pb-2">
            <span className="text-slate-400 font-bold uppercase">Log Booking Ref:</span>
            <span className="font-mono font-bold text-slate-800">{bookingId}</span>
          </p>
          <p className="flex justify-between border-b border-slate-200 pb-2">
            <span className="text-slate-400 font-bold uppercase">Handover Fuel Status:</span>
            <span className="font-bold text-slate-800">{fuelLevel}% Full</span>
          </p>
          <p className="flex justify-between">
            <span className="text-slate-400 font-bold uppercase">Reported Damage Spots:</span>
            <span className="font-bold text-slate-800">{scratches.length} items logged</span>
          </p>
        </div>

        <Link
          href="/bookings"
          className="mt-8 inline-block bg-brand-600 hover:bg-brand-700 text-white font-bold px-6 py-3 rounded-xl shadow-md transition-all cursor-pointer"
        >
          Back to Bookings
        </Link>
      </div>
    );
  }

  return (
    <div className="max-width-container py-10">
      <div className="mb-8">
        <Link href="/bookings" className="flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700 mb-2 transition-colors">
          <ArrowLeft size={16} /> Back to Bookings
        </Link>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <ShieldCheck size={28} className="text-brand-600" /> Pre-Trip Handover Check-in
        </h2>
        <p className="text-sm text-slate-500 mt-1">Submit fuel capacity and log pre-existing damage to clear liability before unlocking the vehicle.</p>
      </div>

      {error && (
        <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded-xl p-4 text-sm mb-6 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {doorAnimation ? (
        <div className="bg-slate-950 text-white rounded-3xl p-8 shadow-2xl border border-slate-900 text-center py-20 flex flex-col items-center justify-center max-w-xl mx-auto h-[400px]">
          <div className="relative w-28 h-28 mb-8 flex items-center justify-center">
            {/* Spinning lock rings */}
            <div className="absolute inset-0 border-4 border-dashed border-brand-500 rounded-full animate-spin duration-1000" />
            <div className="absolute inset-2 border-4 border-dashed border-indigo-400 rounded-full animate-spin duration-700 reverse" />
            <Lock className="w-10 h-10 text-white animate-pulse" />
          </div>
          <h3 className="text-xl font-bold tracking-wide text-brand-400">Sending IoT Unlock Command...</h3>
          <p className="text-slate-400 text-xs mt-2 max-w-xs leading-relaxed">Communicating with car telematics modules. Connecting to SG Highway node...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Left: Check-in Parameters */}
          <div className="space-y-6">
            {/* Fuel level selector */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Fuel size={18} className="text-brand-600" /> 1. Verify Fuel Gauge Level
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">Adjust the slider to match the fuel level currently shown on the vehicle instrument cluster.</p>
              
              <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="flex-1">
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={fuelLevel}
                    onChange={(e) => setFuelLevel(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase mt-2">
                    <span>Low (10%)</span>
                    <span>Half (50%)</span>
                    <span>Full (100%)</span>
                  </div>
                </div>
                <div className="text-center bg-white border border-slate-200 shadow-sm px-4 py-2.5 rounded-xl shrink-0 min-w-[70px]">
                  <span className="text-lg font-black text-brand-600 leading-none">{fuelLevel}%</span>
                  <p className="text-[9px] text-slate-400 font-bold uppercase">Fuel</p>
                </div>
              </div>
            </div>

            {/* List and report scratches */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-600" /> 2. Report Damage & Scratches
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Log existing scratches or dents. Click on the car blueprint on the right to mark visual zones, or add descriptions manually below.
              </p>

              <form onSubmit={handleAddScratch} className="flex gap-2">
                <input
                  type="text"
                  value={newScratch}
                  onChange={(e) => setNewScratch(e.target.value)}
                  placeholder="e.g. Scratched front right bumper guard"
                  className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:border-brand-600 focus:outline-none"
                />
                <button
                  type="submit"
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1 transition-colors"
                >
                  <Plus size={14} /> Add
                </button>
              </form>

              {scratches.length > 0 ? (
                <ul className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-100 max-h-48 overflow-y-auto">
                  {scratches.map((desc, idx) => (
                    <li key={idx} className="flex justify-between items-center text-xs text-slate-600 bg-white p-2 rounded-lg border border-slate-200/50 shadow-sm font-semibold">
                      <span>{desc}</span>
                      <button
                        onClick={() => {
                          const blueprintIdx = blueprintScratches.findIndex(s => desc.includes(`Grid: ${s.x}%, ${s.y}%`));
                          if (blueprintIdx !== -1) {
                            handleClearBlueprintScratch(blueprintIdx, desc);
                          } else {
                            handleRemoveScratch(idx);
                          }
                        }}
                        className="text-rose-500 hover:text-rose-700 p-1 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-6 text-slate-400 border border-dashed border-slate-200 rounded-2xl text-xs">
                  No scratches reported. Click car silhouette to mark, or write manual description.
                </div>
              )}
            </div>

            <button
              onClick={handleSubmitCheckin}
              disabled={submitting}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3.5 rounded-2xl text-sm transition-all shadow-lg shadow-brand-500/10 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Submitting check-in...
                </>
              ) : (
                <>
                  <Unlock size={16} /> Complete Check-in & Unlock Car
                </>
              )}
            </button>
          </div>

          {/* Right: Interactive Car Blueprint Grid */}
          <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-xl text-white space-y-4">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Compass size={16} className="text-brand-400 animate-pulse-slow" /> Interactive Damage Silhouette
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Click/Tap directly on the schematic car blueprint below to place red damage markers exactly where the vehicle has body blemishes.
            </p>

            <div 
              onClick={handleBlueprintClick}
              className="relative bg-slate-950/80 rounded-2xl border border-slate-800 flex items-center justify-center p-4 cursor-crosshair overflow-hidden h-[300px]"
            >
              {/* Grid backdrop */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:1.5rem_1.5rem] opacity-25" />
              
              {/* Simulated Car Silhouette */}
              <div className="relative w-80 h-32 border border-slate-800 rounded-full bg-slate-900/60 shadow-inner flex items-center justify-between px-6 z-10">
                <div className="w-1.5 h-6 bg-slate-800 rounded-full" />
                <span className="text-[10px] font-bold tracking-widest text-slate-600 uppercase">Ahmedabad Fleet Silhouette</span>
                <div className="w-1.5 h-6 bg-slate-800 rounded-full" />
              </div>

              {/* Render placed damage markers */}
              {blueprintScratches.map((spot, idx) => (
                <div
                  key={idx}
                  style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
                  className="absolute w-3.5 h-3.5 bg-rose-500 border border-white rounded-full flex items-center justify-center text-[8px] font-black text-white shadow-md shadow-rose-500/40 z-20 -translate-x-1/2 -translate-y-1/2"
                >
                  !
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase border-t border-slate-800 pt-3">
              <span>← FRONT</span>
              <span>Click spots to log</span>
              <span>REAR →</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
