'use client';

import React from 'react';
import Link from 'next/link';
import { Mail, PhoneCall, ShieldCheck, MapPin, ExternalLink, Compass } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-400 border-t border-slate-900">
      <div className="max-width-container py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Logo & Corporate block */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 group mb-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-sky-400 flex items-center justify-center shadow-md shadow-brand-500/10">
                <Compass className="w-4 h-4 text-white animate-pulse-slow" />
              </div>
              <span className="text-base font-black tracking-wider bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                ZIPTRIP
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              ZipTrip Mobility Solutions Pvt. Ltd. provides frictionless, paperless self-drive car rentals with e-stamped legal agreements across Ahmedabad operational zones.
            </p>
            <div className="space-y-2 text-xs">
              <p className="flex items-center gap-2 hover:text-white transition-colors">
                <PhoneCall size={12} className="text-brand-400" /> +91 79 1234 5678
              </p>
              <p className="flex items-center gap-2 hover:text-white transition-colors">
                <Mail size={12} className="text-brand-400" /> support@ziptrip.com
              </p>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4 border-l-2 border-brand-500 pl-2">Rent & Explore</h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <Link href="/" className="hover:text-white hover:translate-x-1 inline-block transition-all duration-200">Find Cars</Link>
              </li>
              <li>
                <Link href="/fleet" className="hover:text-white hover:translate-x-1 inline-block transition-all duration-200">Fleet Explorer</Link>
              </li>
              <li>
                <Link href="/offers" className="hover:text-white hover:translate-x-1 inline-block transition-all duration-200">Offers & Coupons</Link>
              </li>
              <li>
                <Link href="/host" className="hover:text-white hover:translate-x-1 inline-block transition-all duration-200">List Your Car (Host)</Link>
              </li>
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4 border-l-2 border-brand-500 pl-2">Company</h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <Link href="/about" className="hover:text-white hover:translate-x-1 inline-block transition-all duration-200">About Us</Link>
              </li>
              <li>
                <Link href="/career" className="hover:text-white hover:translate-x-1 inline-block transition-all duration-200">Careers</Link>
              </li>
              <li>
                <Link href="/blog" className="hover:text-white hover:translate-x-1 inline-block transition-all duration-200">Travel Blog</Link>
              </li>
              <li>
                <Link href="/support" className="hover:text-white hover:translate-x-1 inline-block transition-all duration-200">Help Center & FAQ</Link>
              </li>
            </ul>
          </div>

          {/* Regional Hubs */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4 border-l-2 border-brand-500 pl-2">Ahmedabad Hubs</h4>
            <ul className="space-y-2 text-xs text-slate-500">
              <li className="flex items-center gap-1.5 hover:text-slate-300 hover:translate-x-1 transition-all duration-200 cursor-pointer">
                <MapPin size={10} className="text-brand-400 shrink-0" /> AMD Airport Arrivals Hub
              </li>
              <li className="flex items-center gap-1.5 hover:text-slate-300 hover:translate-x-1 transition-all duration-200 cursor-pointer">
                <MapPin size={10} className="text-brand-400 shrink-0" /> SG Highway Hub
              </li>
              <li className="flex items-center gap-1.5 hover:text-slate-300 hover:translate-x-1 transition-all duration-200 cursor-pointer">
                <MapPin size={10} className="text-brand-400 shrink-0" /> Prahlad Nagar Zone
              </li>
              <li className="flex items-center gap-1.5 hover:text-slate-300 hover:translate-x-1 transition-all duration-200 cursor-pointer">
                <MapPin size={10} className="text-brand-400 shrink-0" /> Navrangpura Hub
              </li>
            </ul>
          </div>
        </div>

        {/* Legal disclosures */}
        <div className="border-t border-slate-900 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span>OTP Aadhaar E-Sign Certified. general bailment stamp duty verified by Government of Gujarat.</span>
          </div>
          <div>
            <p>&copy; {new Date().getFullYear()} ZipTrip. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
