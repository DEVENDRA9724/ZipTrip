'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useStore } from '../store/store';
import { useRouter } from 'next/navigation';
import { LogOut, User as UserIcon, Shield, CheckCircle, AlertTriangle, Menu, X, Compass } from 'lucide-react';

export default function Navbar() {
  const { user, logout, login, register, error, clearError, authModalOpen, setAuthModalOpen } = useStore();
  const router = useRouter();
  const [isLoginTab, setIsLoginTab] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const hasUser = mounted ? user : null;

  useEffect(() => {
    if (authModalOpen) {
      setAuthModalOpen(false);
      router.push('/login');
    }
  }, [authModalOpen, router, setAuthModalOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let success = false;
    if (isLoginTab) {
      success = await login(email, password);
    } else {
      success = await register(email, password, fullName, phone);
    }
    if (success) {
      setAuthModalOpen(false);
      setEmail('');
      setPassword('');
      setFullName('');
      setPhone('');
    }
  };

  const getKycBadge = () => {
    if (!hasUser) return null;
    switch (hasUser.kyc_status) {
      case 'VERIFIED':
        return (
          <span className="flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-bold border border-emerald-500/20 shadow-sm animate-pulse-glow-success shrink-0">
            <CheckCircle size={12} className="text-emerald-600" /> KYC Verified
          </span>
        );
      case 'PENDING':
        return (
          <span className="flex items-center gap-1 text-xs bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full font-bold border border-amber-500/20 shadow-sm shrink-0">
            <AlertTriangle size={12} className="text-amber-600" /> KYC Pending
          </span>
        );
      case 'REJECTED':
        return (
          <span className="flex items-center gap-1 text-xs bg-rose-50 text-rose-700 px-2.5 py-1 rounded-full font-bold border border-rose-500/20 shadow-sm shrink-0">
            <X size={12} className="text-rose-600" /> KYC Rejected
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full font-bold shrink-0">
            KYC Unknown
          </span>
        );
    }
  };

  return (
    <nav className="sticky top-0 z-50 glass border-b border-slate-200/80 shadow-sm">
      <div className="max-width-container">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex-shrink-0 flex items-center gap-2 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-sky-400 flex items-center justify-center shadow-md shadow-brand-500/10 group-hover:scale-105 group-hover:rotate-3 transition-all duration-300">
                <Compass className="w-5 h-5 text-white animate-pulse-slow" />
              </div>
              <span className="text-lg font-black tracking-wider bg-gradient-to-r from-brand-700 via-indigo-600 to-sky-500 bg-clip-text text-transparent group-hover:opacity-90 transition-opacity">
                ZIPTRIP
              </span>
            </Link>
            <div className="hidden sm:ml-8 sm:flex sm:space-x-8 h-full">
              <Link href="/" className="relative text-slate-500 hover:text-brand-600 inline-flex items-center px-1 text-sm font-semibold transition-colors duration-200 h-full border-b-2 border-transparent hover:border-brand-600">
                Find Cars
              </Link>
              {hasUser && (
                <>
                  <Link href="/bookings" className="relative text-slate-500 hover:text-brand-600 inline-flex items-center px-1 text-sm font-semibold transition-colors duration-200 h-full border-b-2 border-transparent hover:border-brand-600">
                    My Bookings
                  </Link>
                  <Link href="/host" className="relative text-slate-500 hover:text-brand-600 inline-flex items-center px-1 text-sm font-semibold transition-colors duration-200 h-full border-b-2 border-transparent hover:border-brand-600">
                    List Your Car
                  </Link>
                  <Link href="/referral" className="relative text-slate-500 hover:text-brand-600 inline-flex items-center px-1 text-sm font-semibold transition-colors duration-200 h-full border-b-2 border-transparent hover:border-brand-600">
                    Refer & Earn
                  </Link>
                </>
              )}
              <Link href="/support" className="relative text-slate-500 hover:text-brand-600 inline-flex items-center px-1 text-sm font-semibold transition-colors duration-200 h-full border-b-2 border-transparent hover:border-brand-600">
                Help Center
              </Link>
              {hasUser?.role === 'ADMIN' && (
                <Link href="/admin" className="relative text-slate-500 hover:text-brand-600 inline-flex items-center px-1 text-sm font-semibold transition-colors duration-200 h-full border-b-2 border-transparent hover:border-brand-600 gap-1">
                  <Shield className="w-4 h-4 text-brand-600 shrink-0" /> Admin Console
                </Link>
              )}
            </div>
          </div>

          <div className="hidden sm:flex sm:items-center sm:gap-4">
            {hasUser ? (
              <div className="flex items-center gap-4">
                {getKycBadge()}
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold border border-brand-200 shadow-sm animate-pulse-glow">
                    {hasUser.full_name.charAt(0)}
                  </div>
                  <div className="text-sm">
                    <p className="font-bold text-slate-800 leading-none">{hasUser.full_name}</p>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">{hasUser.role.toLowerCase()}</p>
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="flex items-center gap-1 text-sm text-slate-400 hover:text-rose-600 transition-colors font-semibold cursor-pointer"
                >
                  <LogOut size={16} /> Logout
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  clearError();
                  setAuthModalOpen(true);
                }}
                className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg shadow-brand-500/10 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                Sign In / Sign Up
              </button>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center sm:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-gray-500 hover:text-brand-600 p-2 rounded-md focus:outline-none cursor-pointer"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden bg-white border-b border-gray-200 px-4 pt-2 pb-4 space-y-2">
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-brand-600"
          >
            Find Cars
          </Link>
          {hasUser && (
            <>
              <Link
                href="/bookings"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-brand-600"
              >
                My Bookings
              </Link>
              <Link
                href="/host"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-brand-600"
              >
                List Your Car
              </Link>
              <Link
                href="/referral"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-brand-600"
              >
                Refer & Earn
              </Link>
            </>
          )}
          <Link
            href="/support"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-brand-600"
          >
            Help Center
          </Link>
          {hasUser?.role === 'ADMIN' && (
            <Link
              href="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-brand-600"
            >
              Admin Console
            </Link>
          )}
          <hr className="my-2 border-gray-100" />
          {hasUser ? (
            <div className="space-y-2 px-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-800">{hasUser.full_name}</span>
                {getKycBadge()}
              </div>
              <button
                onClick={() => {
                  logout();
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-center gap-1 text-center py-2 px-4 border border-rose-200 rounded-md text-sm font-medium text-rose-600 hover:bg-rose-50 cursor-pointer"
              >
                <LogOut size={16} /> Logout
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                clearError();
                setAuthModalOpen(true);
                setMobileMenuOpen(false);
              }}
              className="w-full text-center bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer"
            >
              Sign In / Sign Up
            </button>
          )}
        </div>
      )}

      {/* Auth Modal Removed in favor of dedicated page */}
    </nav>
  );
}
