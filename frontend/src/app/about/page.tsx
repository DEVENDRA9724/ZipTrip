'use client';

import React from 'react';
import { Compass, Users, MapPin, Trophy, ShieldCheck } from 'lucide-react';

export default function About() {
  return (
    <div className="max-width-container py-16">
      {/* Title */}
      <div className="text-center max-w-2xl mx-auto mb-16">
        <span className="text-xs bg-brand-100 text-brand-700 px-3 py-1 rounded-full font-bold uppercase tracking-wider">
          Who We Are
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-3">
          Transforming Mobility in Gujarat
        </h2>
        <p className="text-slate-600 text-sm mt-3">
          ZipTrip is the leading local self-drive car rental platform. We offer paperless onboarding and e-stamped legal rental agreements in minutes.
        </p>
      </div>

      {/* Main Stats / Values Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center mb-20">
        <div>
          <h3 className="text-2xl font-extrabold text-slate-900 mb-4">Our Vision</h3>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed mb-6">
            Self-drive mobility represents a crucial pillar of modern urban transport networks. By separating vehicle ownership from utility, we decrease city congestion, reduce parking strain, and offer affordable weekend leisure escapes to Statue of Unity, Saputara, and beyond.
          </p>

          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Regulatory Compliance</h4>
                <p className="text-xs text-slate-500 mt-1">Contracts comply with Sections 148-181 of the Indian Contract Act and Motor Vehicles Act.</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Trophy size={20} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm"> Ahmedabad Local Specialists</h4>
                <p className="text-xs text-slate-500 mt-1">Dedicated hub networks spanning AMD Airport, SG Highway, Prahlad Nagar, and Navrangpura.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Corporate card */}
        <div className="bg-slate-900 text-white rounded-2xl p-8 shadow-xl border border-slate-800">
          <h3 className="text-lg font-bold border-b border-slate-800 pb-3 mb-5 uppercase tracking-wide text-brand-400">Corporate Directory</h3>

          <div className="space-y-6 text-sm">
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Registered Entity</p>
              <p className="font-medium text-slate-200 mt-1">ZipTrip Mobility Solutions Pvt. Ltd.</p>
            </div>

            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Corporate Identification Number (CIN)</p>
              <p className="font-mono text-slate-200 mt-1">U63030GJ2026PTC123456</p>
            </div>

            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Ahmedabad Headquarters</p>
              <p className="text-slate-300 mt-1 flex items-start gap-1">
                <MapPin size={16} className="text-brand-400 shrink-0 mt-0.5" />
                <span>502, SG Highway Corporate Towers,<br />Thaltej Crossing, Ahmedabad, Gujarat - 380054</span>
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Founding Leadership</p>
              <p className="text-slate-300 mt-1 font-medium">Amit Patel (Founder & CEO) <br /> Aarav Mehta (Co-Founder & CTO)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
