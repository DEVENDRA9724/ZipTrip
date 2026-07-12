'use client';

import React from 'react';
import { Compass, Calendar, User, Clock, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface Post {
  title: string;
  excerpt: string;
  img: string;
  date: string;
  author: string;
  readTime: string;
  tag: string;
}

export default function Blog() {
  const posts: Post[] = [
    {
      title: 'Weekend Escape to Statue of Unity: The Ultimate SUV Roadtrip Guide',
      excerpt: 'Kevadia is a popular weekend drive from Ahmedabad. Find out the best route, sightseeing spots, and tips for driving a self-drive SUV.',
      img: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&q=80&w=600',
      date: 'June 18, 2026',
      author: 'Aarav Mehta',
      readTime: '5 min read',
      tag: 'Road Trips'
    },
    {
      title: 'Monsoon Escapes: A Scenic Self-Drive Drive to Saputara Hill Station',
      excerpt: 'Saputara transforms during the monsoons. Explore our guide on navigating Sahyadri mountain bends and driving safely in rainy conditions.',
      img: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?auto=format&fit=crop&q=80&w=600',
      date: 'June 22, 2026',
      author: 'Priya Shah',
      readTime: '7 min read',
      tag: 'Scenic Drives'
    },
    {
      title: 'Ahmedabad to Udaipur: Smooth Highways and Lakeside Getaways',
      excerpt: 'Driving to Udaipur is a breeze with excellent NH48 highway stretches. We lay out the perfect 3-day itinerary for a sedan rental.',
      img: 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&q=80&w=600',
      date: 'June 24, 2026',
      author: 'Amit Patel',
      readTime: '6 min read',
      tag: 'Weekend Gateways'
    }
  ];

  return (
    <div className="max-width-container py-12">
      <div className="text-center max-w-2xl mx-auto mb-16">
        <span className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full font-bold uppercase tracking-wider">
          Travel Directory & Blog
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-3">
          Roadtrip Guides & Diaries
        </h2>
        <p className="text-slate-600 text-sm mt-3">
          Get inspired for your next self-drive road trip. Routes, travel tips, and safety parameters curated by local drivers.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {posts.map((p, idx) => (
          <div
            key={idx}
            className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg transition-shadow flex flex-col justify-between group"
          >
            <div>
              {/* Cover Image */}
              <div className="relative h-48 w-full bg-slate-100 overflow-hidden">
                <img
                  src={p.img}
                  alt={p.title}
                  className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                />
                <span className="absolute top-4 left-4 bg-brand-600 text-white text-[10px] font-extrabold uppercase px-2.5 py-1 rounded">
                  {p.tag}
                </span>
              </div>

              {/* Body */}
              <div className="p-6">
                {/* Meta details */}
                <div className="flex items-center gap-4 text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-3">
                  <span className="flex items-center gap-1">
                    <Calendar size={11} /> {p.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={11} /> {p.readTime}
                  </span>
                </div>

                <h3 className="font-extrabold text-slate-950 text-base sm:text-lg leading-tight group-hover:text-brand-600 transition-colors">
                  {p.title}
                </h3>
                <p className="text-slate-500 text-xs sm:text-sm mt-3 leading-relaxed">
                  {p.excerpt}
                </p>
              </div>
            </div>

            {/* Read More button */}
            <div className="px-6 pb-6 pt-2">
              <button
                onClick={() => alert('Demo Mode: Article content will be made available shortly!')}
                className="text-brand-600 hover:text-brand-700 text-xs font-extrabold flex items-center gap-1 hover:gap-1.5 transition-all cursor-pointer"
              >
                Read Article <ArrowRight size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
