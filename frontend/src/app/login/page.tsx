'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore } from '../../store/store';
import { Compass, Lock, Mail, User, Phone, ArrowLeft, CheckCircle, Shield, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, login, register, error, clearError } = useStore();

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = searchParams.get('redirect') || '/';

  // If user is already logged in, redirect them
  useEffect(() => {
    if (user) {
      router.push(redirectTo);
    }
  }, [user, redirectTo, router]);

  // Clear errors on tab toggle
  const toggleTab = () => {
    setIsLogin(!isLogin);
    clearError();
  };

  const handleAutofill = (role: 'guest' | 'admin') => {
    clearError();
    if (role === 'guest') {
      setEmail('customer@ziptrip.com');
      setPassword('CustomerPassword123');
    } else {
      setEmail('admin@ziptrip.com');
      setPassword('AdminPassword123');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    clearError();

    let success = false;
    if (isLogin) {
      success = await login(email, password);
    } else {
      success = await register(email, password, fullName, phone);
    }

    setSubmitting(false);

    if (success) {
      router.push(redirectTo);
    }
  };

  return (
    <div className="min-h-[85vh] grid grid-cols-1 lg:grid-cols-12 max-width-container my-8 rounded-3xl overflow-hidden bg-white border border-slate-200/80 shadow-xl">
      {/* Left side: Premium Brand & Features Panel */}
      <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-8 sm:p-12 flex flex-col justify-between relative overflow-hidden">
        {/* Background decorative glows */}
        <div className="absolute top-[-10%] right-[-10%] w-72 h-72 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div>
          <Link href="/" className="inline-flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center shadow-md shadow-brand-500/20 group-hover:scale-105 transition-transform">
              <Compass className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-base font-black tracking-wider text-white">
              ZIPTRIP
            </span>
          </Link>
        </div>

        {/* Marketing message & features */}
        <div className="my-12 space-y-6">
          <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-white">
            Unlock Premium Self-Drive Freedom
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Ahmedabad's leading P2P car-sharing ecosystem. Rent vehicles, lists listings, and complete contracts paperlessly.
          </p>

          <div className="space-y-4 pt-4">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0 text-brand-400">
                <CheckCircle size={16} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Fast Biometric KYC</h4>
                <p className="text-slate-400 text-xs mt-0.5">Simulated FaceMatch verification under 2 minutes.</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0 text-brand-400">
                <CheckCircle size={16} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">e-Stamp Digital Leases</h4>
                <p className="text-slate-400 text-xs mt-0.5">Compliant bailment rental contracts generated dynamically.</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0 text-brand-400">
                <CheckCircle size={16} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Keyless IoT Unlocking</h4>
                <p className="text-slate-400 text-xs mt-0.5">Locate and unlock cars directly from your customer dashboard.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer legal mention */}
        <div className="text-[10px] text-slate-500 flex items-center gap-1.5 border-t border-white/10 pt-4">
          <Shield size={12} className="text-emerald-500" />
          <span>OTP Aadhaar E-Sign Certified. general bailment stamp duty verified.</span>
        </div>
      </div>

      {/* Right side: Auth Form Panel */}
      <div className="lg:col-span-7 p-8 sm:p-12 flex flex-col justify-center bg-white">
        <div className="max-w-md w-full mx-auto">
          {/* Back button */}
          <Link href="/" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-6 font-semibold transition-colors">
            <ArrowLeft size={12} /> Back to Discover
          </Link>

          {/* Form Tabs */}
          <div className="flex border-b border-slate-100 mb-8">
            <button
              onClick={() => { if (!isLogin) toggleTab(); }}
              className={`w-1/2 pb-3.5 font-bold text-center border-b-2 transition-all cursor-pointer text-sm ${isLogin ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => { if (isLogin) toggleTab(); }}
              className={`w-1/2 pb-3.5 font-bold text-center border-b-2 transition-all cursor-pointer text-sm ${!isLogin ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              Register
            </button>
          </div>

          <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
            {isLogin ? 'Welcome Back!' : 'Create your Account'}
          </h3>
          <p className="text-xs text-slate-500 mb-6">
            {isLogin ? 'Access your active car rentals and booking dashboard.' : 'Start renting or listing cars in Ahmedabad today.'}
          </p>

          {error && (
            <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded-xl p-3 text-xs mb-6 font-semibold animate-shake">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3 text-slate-400" size={16} />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Amit Patel"
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:border-brand-600 focus:outline-none bg-slate-50/50 focus:bg-white transition-all text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-3 text-slate-400" size={16} />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:border-brand-600 focus:outline-none bg-slate-50/50 focus:bg-white transition-all text-slate-800"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 text-slate-400" size={16} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. amit@ziptrip.com"
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:border-brand-600 focus:outline-none bg-slate-50/50 focus:bg-white transition-all text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 text-slate-400" size={16} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:border-brand-600 focus:outline-none bg-slate-50/50 focus:bg-white transition-all text-slate-800"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-xs transition-all shadow-md shadow-brand-500/10 hover:shadow-lg flex items-center justify-center gap-1.5 cursor-pointer mt-6"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                isLogin ? 'Sign In' : 'Register Account'
              )}
            </button>
          </form>

          {/* Tester Helper Fill section */}
          {isLogin && (
            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-3">Tester Quick Fill Credentials</p>
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => handleAutofill('guest')}
                  className="bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/80 rounded-lg py-1.5 px-3 text-[10px] font-bold transition-all cursor-pointer"
                >
                  Fill Guest (customer@ziptrip.com)
                </button>
                <button
                  type="button"
                  onClick={() => handleAutofill('admin')}
                  className="bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/80 rounded-lg py-1.5 px-3 text-[10px] font-bold transition-all cursor-pointer"
                >
                  Fill Admin (admin@ziptrip.com)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
