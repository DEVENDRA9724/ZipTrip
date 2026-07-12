'use client';

import React, { useState } from 'react';
import { Tag, Copy, Check, Sparkles, Percent, Ticket } from 'lucide-react';

interface Coupon {
  code: string;
  discount: string;
  title: string;
  desc: string;
  badge: string;
  color: string;
}

export default function Offers() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const coupons: Coupon[] = [
    {
      code: 'WELCOME500',
      discount: '₹500 OFF',
      title: 'First Drive Special',
      desc: 'Valid on your first self-drive car booking. No minimum trip duration required.',
      badge: 'New Users',
      color: 'from-brand-500 to-brand-700'
    },
    {
      code: 'AIRPORT15',
      discount: '15% OFF',
      title: 'SVPI Airport Escape',
      desc: 'Valid on pickups from Sardar Vallabhbhai Patel International Airport hub.',
      badge: 'Airport Special',
      color: 'from-sky-500 to-indigo-600'
    },
    {
      code: 'UNITY300',
      discount: '₹300 OFF',
      title: 'Statue of Unity Weekend',
      desc: 'Planning a roadtrip to Kevadia? Use this coupon on SUVs for weekend trips.',
      badge: 'Weekend Deal',
      color: 'from-emerald-500 to-teal-600'
    },
    {
      code: 'MONSOON400',
      discount: '₹400 OFF',
      title: 'Saputara Hill Escape',
      desc: 'Excursion to Saputara during monsoons? Enjoy flat discounts on all Sedans and SUVs.',
      badge: 'Monsoon Special',
      color: 'from-amber-500 to-orange-600'
    }
  ];

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="max-width-container py-12">
      <div className="text-center max-w-2xl mx-auto mb-16">
        <span className="text-xs bg-brand-100 text-brand-700 px-3 py-1 rounded-full font-bold uppercase tracking-wider">
          Deals & Promotions
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-3">
          Active Drive Discounts
        </h2>
        <p className="text-slate-600 text-sm mt-3">
          Save on your self-drive trips from Ahmedabad. Copy any code below and apply it on checkout to claim your credits.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {coupons.map((c) => {
          const isCopied = copiedCode === c.code;
          return (
            <div
              key={c.code}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col sm:flex-row hover:shadow-md transition-shadow relative"
            >
              {/* Left Color Block */}
              <div className={`bg-gradient-to-br ${c.color} text-white px-6 py-8 sm:w-44 flex flex-col justify-center items-center text-center shrink-0`}>
                <Ticket size={28} className="mb-2 opacity-90" />
                <span className="text-2xl font-black">{c.discount}</span>
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold mt-2 uppercase tracking-wider">
                  {c.badge}
                </span>
              </div>

              {/* Right Details */}
              <div className="p-6 flex-grow flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-1.5 leading-tight">
                    {c.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">{c.desc}</p>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 gap-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-mono font-bold text-sm text-slate-700 select-all tracking-wider">
                    {c.code}
                  </div>

                  <button
                    onClick={() => handleCopy(c.code)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-sm shrink-0 cursor-pointer ${isCopied ? 'bg-success-600 text-white' : 'bg-slate-900 hover:bg-slate-800 text-white'}`}
                  >
                    {isCopied ? (
                      <>
                        <Check size={12} /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy size={12} /> Copy Code
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
