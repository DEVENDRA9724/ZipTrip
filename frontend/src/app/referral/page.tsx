'use client';

import React, { useState } from 'react';
import { useStore } from '../../store/store';
import {
  Gift,
  Copy,
  Check,
  Share2,
  Users,
  CircleDollarSign,
  ArrowRight,
  Send,
  Lock
} from 'lucide-react';

export default function ReferralPortal() {
  const { user, token, setAuthModalOpen } = useStore();
  const [copied, setCopied] = useState(false);

  // Mock referral code based on user's name
  const referralCode = user
    ? `DRIVE-${user.full_name.split(' ')[0].toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`
    : 'DRIVE-GUEST-1234';

  const mockReferrals = [
    { id: 1, friend: 'Rahul Sharma', date: '2026-06-15', status: 'Completed', reward: '₹500 Credits' },
    { id: 2, friend: 'Neha Gupta', date: '2026-06-20', status: 'Completed', reward: '₹500 Credits' },
    { id: 3, friend: 'Sanjay Patel', date: '2026-06-22', status: 'Signed Up', reward: 'Pending booking' }
  ];

  const handleCopy = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const text = `Hey! Rent self-drive cars in Ahmedabad starting at just ₹1000/day. Use my invite code ${referralCode} to get ₹500 discount on your first ride! Join now: http://localhost:3000`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (!token) {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 bg-white border border-slate-200 rounded-2xl text-center shadow-lg animate-fade-in-up">
        <Lock className="w-12 h-12 text-brand-600 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-800">Sign In Required</h3>
        <p className="text-slate-500 text-sm mt-2 leading-relaxed">
          You must be logged in to view your referral code and credit balance.
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

  return (
    <div className="max-width-container py-10">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <span className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full font-bold uppercase tracking-wider">
          Refer & Earn Platform
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-3">
          Invite Friends. Earn Free Trips.
        </h2>
        <p className="text-slate-600 text-sm mt-3">
          Share your referral link. When your friend rents their first car, you both get ₹500 in drive credits instantly!
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
        {/* Code sharing block */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-center gap-6 justify-between">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-800">Your Unique Referral Code</h3>
              <p className="text-xs text-slate-500">Share this code with friends to give them ₹500 off on their first booking.</p>

              <div className="flex items-center gap-2 mt-4">
                <span className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 font-mono font-bold text-lg text-slate-800 select-all tracking-wider">
                  {referralCode}
                </span>
                <button
                  onClick={handleCopy}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2.5 rounded-lg border border-slate-200 transition-colors"
                  title="Copy Code"
                >
                  {copied ? <Check className="text-success-600" size={18} /> : <Copy size={18} />}
                </button>
              </div>
            </div>

            <div className="w-full md:w-auto flex flex-col gap-3 shrink-0">
              <button
                onClick={handleShareWhatsApp}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-lg text-sm flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                <Send size={15} /> Share on WhatsApp
              </button>
              <button
                onClick={() => alert('Referral link copied to clipboard: http://localhost:3000?ref=' + referralCode)}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-2.5 rounded-lg text-sm flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                <Share2 size={15} /> Copy Invite Link
              </button>
            </div>
          </div>

          {/* Referral Logs */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-base font-bold">Invite Activity</h3>
              <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-bold border border-slate-200">
                3 Referrals
              </span>
            </div>

            <div className="divide-y divide-slate-100 text-sm text-slate-700">
              {mockReferrals.map((ref) => (
                <div key={ref.id} className="p-4 sm:px-6 flex items-center justify-between hover:bg-slate-50/50">
                  <div>
                    <p className="font-semibold text-slate-900">{ref.friend}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Joined on {ref.date}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${ref.status === 'Completed' ? 'bg-success-50 text-success-800 border border-success-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                      {ref.reward}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wider">{ref.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Balance cards */}
        <div className="space-y-6">
          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-lg border border-slate-800 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-brand-500/20 rounded-full blur-xl" />
            <div className="w-10 h-10 bg-brand-500/20 rounded-lg flex items-center justify-center text-brand-400 mb-4">
              <CircleDollarSign size={20} />
            </div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Drive Credit Balance</p>
            <p className="text-3xl font-black text-white mt-1">₹1,000</p>
            <p className="text-xs text-slate-500 mt-1.5 border-t border-slate-800 pt-2">Auto-applied on checkout</p>
          </div>

          <div className="bg-indigo-950 text-white rounded-2xl p-6 shadow-lg border border-indigo-900 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-indigo-500/20 rounded-full blur-xl" />
            <div className="w-10 h-10 bg-indigo-500/20 rounded-lg flex items-center justify-center text-indigo-400 mb-4">
              <Gift size={20} />
            </div>
            <p className="text-xs text-indigo-300 font-bold uppercase tracking-wider">Free Rides Earned</p>
            <p className="text-3xl font-black text-white mt-1">2 Rides</p>
            <p className="text-xs text-indigo-500 mt-1.5 border-t border-indigo-900 pt-2">Credits cover 100% of base fare</p>
          </div>
        </div>
      </div>
    </div>
  );
}
