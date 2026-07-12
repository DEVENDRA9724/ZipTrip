'use client';

import React from 'react';
import { Users, Fuel, Briefcase, ChevronRight, Check } from 'lucide-react';
import Link from 'next/link';

interface FleetItem {
  category: string;
  name: string;
  img: string;
  rate: string;
  transmission: string;
  seating: number;
  luggage: string;
  useCase: string;
  features: string[];
}

export default function FleetCatalog() {
  const fleet: FleetItem[] = [
    {
      category: 'Hatchback Class',
      name: 'Swift / i20 or similar',
      img: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&q=80&w=600',
      rate: '₹1,000/day',
      transmission: 'Manual Transmission',
      seating: 5,
      luggage: '2 Cabin Bags',
      useCase: 'Best optimized for tight intra-city navigation through congested lanes like the old city market.',
      features: ['Air Conditioning', 'Dual Airbags', 'Rear Parking Sensors', 'Foldable Seats']
    },
    {
      category: 'Sedan Class',
      name: 'City / Verna or similar',
      img: 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&q=80&w=600',
      rate: '₹1,600/day',
      transmission: 'Automatic Transmission',
      seating: 5,
      luggage: '3 Large Bags',
      useCase: 'Preferred for corporate client transits, airport dropoffs, or comfortable highway cruises to Surat/Vadodara.',
      features: ['Automatic Climate Control', 'Sunroof', 'Leather Upholstery', 'Cruise Control']
    },
    {
      category: 'SUV Class',
      name: 'XUV700 / Harrier or similar',
      img: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=600',
      rate: '₹2,500/day',
      transmission: 'Automatic Transmission',
      seating: 7,
      luggage: '5 Large Bags',
      useCase: 'Demanded for long weekend roadtrips out of Ahmedabad to Statue of Unity, Saputara, or Udaipur.',
      features: ['Panoramic Sunroof', 'ADAS Driver Safety', '360 Parking Cameras', 'Terrain/All-wheel drive']
    }
  ];

  return (
    <div className="max-width-container py-12">
      <div className="text-center max-w-2xl mx-auto mb-16">
        <span className="text-xs bg-brand-100 text-brand-700 px-3 py-1 rounded-full font-bold uppercase tracking-wider">
          Explore Our Fleet
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-3">
          Choose Your Drive Class
        </h2>
        <p className="text-slate-600 text-sm mt-3">
          Explore rates, transmission controls, passenger specifications, and premium features of our fleet options.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {fleet.map((f, idx) => (
          <div
            key={idx}
            className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl hover:border-brand-300 transition-all flex flex-col justify-between group"
          >
            {/* Image header */}
            <div className="relative h-56 w-full bg-slate-100 overflow-hidden">
              <img
                src={f.img}
                alt={f.name}
                className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
              />
              <div className="absolute top-4 left-4 bg-slate-900/90 text-white text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-md">
                {f.category}
              </div>
            </div>

            {/* Content body */}
            <div className="p-6 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-baseline mb-4">
                  <h3 className="text-lg font-black text-slate-900 leading-tight">{f.name}</h3>
                  <span className="text-brand-600 font-extrabold text-lg shrink-0">{f.rate}</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed mb-6">{f.useCase}</p>

                {/* Grid metrics */}
                <div className="grid grid-cols-3 gap-2 border-y border-slate-100 py-3 mb-6 text-[11px] text-slate-600 font-medium">
                  <div className="flex flex-col items-center text-center">
                    <Users size={14} className="text-brand-500 mb-1" />
                    <span>{f.seating} Seats</span>
                  </div>
                  <div className="flex flex-col items-center text-center border-x border-slate-100">
                    <Fuel size={14} className="text-brand-500 mb-1" />
                    <span>{f.transmission.split(' ')[0]}</span>
                  </div>
                  <div className="flex flex-col items-center text-center">
                    <Briefcase size={14} className="text-brand-500 mb-1" />
                    <span>{f.luggage.split(' ')[0]} Bags</span>
                  </div>
                </div>

                {/* Features Checklist */}
                <div className="space-y-2 mb-6">
                  {f.features.map((feat, fidx) => (
                    <p key={fidx} className="flex items-center gap-2 text-xs text-slate-600">
                      <Check size={12} className="text-success-500 shrink-0" />
                      <span>{feat}</span>
                    </p>
                  ))}
                </div>
              </div>

              <Link
                href="/"
                className="w-full text-center bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1 transition-all mt-4 cursor-pointer shadow-sm hover:shadow"
              >
                Check Availability <ChevronRight size={14} />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
