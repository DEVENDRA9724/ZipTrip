'use client';

import React, { useEffect, useState } from 'react';
import { useStore } from '../../../store/store';
import {
  ShieldAlert,
  Loader2,
  Lock,
  ArrowLeft,
  RefreshCw,
  UserCheck,
  CheckCircle,
  XCircle,
  FileText,
  User
} from 'lucide-react';
import Link from 'next/link';

const API_BASE_URL = 'http://localhost:5000/api';

export default function DocumentManager() {
  const { user, token, logout, uploadAdminUserDocument } = useStore();
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [docNameInput, setDocNameInput] = useState('');
  const [fileSelected, setFileSelected] = useState<File | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !fileSelected || !docNameInput) return;

    setUploadingDoc(true);
    try {
      const success = await uploadAdminUserDocument(selectedUser.id, docNameInput, fileSelected);
      if (success) {
        alert('Document uploaded successfully!');
        setDocNameInput('');
        setFileSelected(null);
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        await fetchUsers(false);
      } else {
        alert('Failed to upload document.');
      }
    } catch (err: any) {
      alert('Error uploading document: ' + err.message);
    } finally {
      setUploadingDoc(false);
    }
  };

  const parsedDocs = React.useMemo(() => {
    if (!selectedUser || !selectedUser.admin_documents) return [];
    try {
      return typeof selectedUser.admin_documents === 'string'
        ? JSON.parse(selectedUser.admin_documents)
        : selectedUser.admin_documents;
    } catch (e) {
      return [];
    }
  }, [selectedUser]);

  const fetchUsers = async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/kyc`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.status === 401) {
        logout();
        throw new Error('Your session has expired. Please log in again.');
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to sync customer KYC profiles');
      setUsersList(data);

      if (data.length > 0 && !selectedUser) {
        setSelectedUser(data[0]);
      } else if (selectedUser) {
        const updated = data.find((u: any) => u.id === selectedUser.id);
        if (updated) setSelectedUser(updated);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    if (token && user?.role === 'ADMIN') {
      fetchUsers(true);
    }
  }, [token, user]);

  const handleUpdateStatus = async (userId: string, nextStatus: 'VERIFIED' | 'REJECTED') => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/kyc/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId, status: nextStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update status');

      alert(`KYC status successfully updated to ${nextStatus}!`);
      fetchUsers(false);
    } catch (err: any) {
      alert('Error updating KYC: ' + err.message);
    }
  };

  if (!token || user?.role !== 'ADMIN') {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 bg-white border border-slate-200 rounded-2xl text-center shadow-lg">
        <ShieldAlert className="w-12 h-12 text-rose-600 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-800">Access Denied</h3>
        <p className="text-slate-500 text-sm mt-2 leading-relaxed">
          Admin privileges are required to view customer documents. Please sign in as an administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="max-width-container py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link href="/admin" className="flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700 mb-2 transition-colors">
            <ArrowLeft size={16} /> Operations Console
          </Link>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <UserCheck className="text-slate-900" size={28} /> KYC Document Manager
          </h2>
          <p className="text-sm text-slate-500 mt-1">Review official identity certificates, Aadhaar / DL numbers, and approve customer registration profiles.</p>
        </div>
        <button
          onClick={() => fetchUsers(true)}
          className="bg-white hover:bg-slate-50 text-slate-700 font-bold px-4 py-2 border border-slate-200 rounded-lg text-sm flex items-center gap-1.5 transition-all shadow-sm"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh List
        </button>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
          <Loader2 className="w-10 h-10 text-brand-600 animate-spin" />
          <p className="text-slate-600 font-medium">Loading uploaded customer files...</p>
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Customers List Ledger */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[520px]">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm">Uploaded KYC Files</h3>
              <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-bold">
                {usersList.length} Customer(s)
              </span>
            </div>

            {usersList.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs flex-1 flex flex-col items-center justify-center">
                <FileText size={28} className="text-slate-300 mb-2" />
                <p>No customer document submissions found in database.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
                {usersList.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => setSelectedUser(c)}
                    className={`p-4 flex items-center justify-between text-xs cursor-pointer hover:bg-slate-50 transition-colors ${selectedUser?.id === c.id ? 'bg-slate-50 font-semibold border-l-4 border-brand-600' : ''}`}
                  >
                    <div>
                      <p className="font-bold text-slate-800">{c.full_name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{c.email}</p>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${c.kyc_status === 'VERIFIED' ? 'bg-success-50 text-success-700' : c.kyc_status === 'PENDING' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>
                      {c.kyc_status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Details Viewer Panel */}
          <div className="lg:col-span-2">
            {selectedUser ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row h-[520px]">
                {/* Physical Documents review column */}
                <div className="w-full md:w-60 bg-slate-50 border-r border-slate-200 p-6 flex flex-col items-center text-center justify-between h-1/2 md:h-full">
                  <div className="space-y-4">
                    <div className="w-24 h-24 rounded-full overflow-hidden border border-slate-200 bg-slate-200 relative shrink-0 mx-auto">
                      {selectedUser.selfie_url ? (
                        <img
                          src={`http://localhost:5000${selectedUser.selfie_url}`}
                          alt="Customer Selfie"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          <User size={36} />
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm leading-tight">{selectedUser.full_name}</h4>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wide">ID: {selectedUser.id.substring(0, 8)}</p>
                    </div>
                  </div>

                  <div className="space-y-2.5 w-full mt-6">
                    <button
                      onClick={() => handleUpdateStatus(selectedUser.id, 'VERIFIED')}
                      disabled={selectedUser.kyc_status === 'VERIFIED'}
                      className="w-full bg-success-600 hover:bg-success-700 disabled:opacity-50 text-white font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1 shadow-sm transition-all cursor-pointer"
                    >
                      <CheckCircle size={14} /> Approve Document
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedUser.id, 'REJECTED')}
                      disabled={selectedUser.kyc_status === 'REJECTED'}
                      className="w-full bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1 shadow-sm transition-all cursor-pointer"
                    >
                      <XCircle size={14} /> Reject Document
                    </button>
                  </div>
                </div>

                {/* Document parameters details column */}
                <div className="flex-1 p-6 flex flex-col justify-between overflow-y-auto">
                  <div className="space-y-6">
                    <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2">Customer Credentials</h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Email Address</p>
                        <p className="font-semibold text-slate-800 mt-0.5">{selectedUser.email}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Phone Number</p>
                        <p className="font-semibold text-slate-800 mt-0.5">{selectedUser.phone}</p>
                      </div>
                    </div>

                    <div className="space-y-4 border-t border-slate-100 pt-4 text-xs text-slate-600">
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                        <div className="flex justify-between border-b border-slate-200/60 pb-2">
                          <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Aadhaar Identification</span>
                          <span className="font-mono font-bold text-slate-900">{selectedUser.aadhaar_number || 'Not uploaded'}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-200/60 pb-2">
                          <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">PAN Identification</span>
                          <span className="font-mono font-bold text-slate-900">{selectedUser.pan_number || 'Not uploaded'}</span>
                        </div>
                        <div className="flex justify-between pb-1">
                          <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Driving License ID</span>
                          <span className="font-mono font-bold text-slate-900">{selectedUser.dl_number || 'Not uploaded'}</span>
                        </div>
                      </div>

                      <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-800 text-[10px] leading-relaxed">
                        Verify that document numbers match the physical text in photo uploads. Biometric match similarity score was verified by the Digio API during submission.
                      </div>

                      {/* Admin Document Vault */}
                      <div className="border-t border-slate-100 pt-4">
                        <h4 className="font-bold text-slate-800 text-xs mb-3 flex items-center gap-1.5">
                          <FileText size={14} className="text-slate-500" /> Admin Document Vault
                        </h4>
                        
                        {/* Upload Form */}
                        <form onSubmit={handleUploadDocument} className="space-y-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5 mb-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Document Name</label>
                              <input
                                type="text"
                                value={docNameInput}
                                onChange={(e) => setDocNameInput(e.target.value)}
                                placeholder="e.g. KYC Approval Certificate"
                                className="w-full text-[11px] px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 text-slate-800"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">File Selection</label>
                              <input
                                type="file"
                                onChange={(e) => setFileSelected(e.target.files?.[0] || null)}
                                className="w-full text-[11px] text-slate-600 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 cursor-pointer"
                                required
                              />
                            </div>
                          </div>
                          <button
                            type="submit"
                            disabled={uploadingDoc}
                            className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold py-1.5 rounded-lg text-[10px] flex items-center justify-center gap-1 shadow-sm transition-all cursor-pointer"
                          >
                            {uploadingDoc ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...
                              </>
                            ) : (
                              'Upload Document'
                            )}
                          </button>
                        </form>

                        {/* Documents List */}
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Attached Documents</p>
                          {parsedDocs.length === 0 ? (
                            <p className="text-[10px] text-slate-400 italic">No files uploaded yet by admin.</p>
                          ) : (
                            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 text-slate-700">
                              {parsedDocs.map((doc: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between p-2 bg-white border border-slate-100 rounded-lg text-[11px] hover:border-slate-200 transition-all">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <FileText className="text-slate-400 shrink-0" size={13} />
                                    <div className="truncate">
                                      <span className="font-semibold text-slate-700 block truncate">{doc.name}</span>
                                      <span className="text-[9px] text-slate-400">{new Date(doc.uploadedAt).toLocaleString('en-IN')}</span>
                                    </div>
                                  </div>
                                  <a
                                    href={`http://localhost:5000${doc.url}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-brand-600 hover:text-brand-700 font-bold hover:underline shrink-0 text-[10px] flex items-center gap-0.5 ml-2"
                                  >
                                    Download
                                  </a>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-400 border-t border-slate-100 pt-4 leading-normal">
                    Compliance actions are logged under audit compliance registries in accordance with the Prevention of Money Laundering Act (PMLA).
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-12 text-center text-slate-500 text-sm h-[520px] flex flex-col items-center justify-center">
                <FileText className="w-12 h-12 text-slate-300 mb-3" />
                <p className="font-semibold text-slate-700">No Customer Profile Selected</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">Select a user profile from the files list to view selfie credentials, Aadhaar / PAN numbers, and invoke regulatory approvals.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
