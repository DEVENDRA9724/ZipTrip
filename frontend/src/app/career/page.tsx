'use client';

import React, { useState } from 'react';
import { Briefcase, MapPin, Clock, Send, ChevronRight, X, Loader2 } from 'lucide-react';

interface Job {
  id: number;
  title: string;
  dept: string;
  loc: string;
  type: string;
  desc: string;
}

export default function Careers() {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const jobs: Job[] = [
    {
      id: 1,
      title: 'Full-Stack Software Engineer (Next.js / Node.js)',
      dept: 'Engineering & Technology',
      loc: 'Ahmedabad (SG Highway Office)',
      type: 'Full-Time',
      desc: 'Build our real-time availability queues, telemetry ingestion microservices, and dynamic pricing engines. Requires experience with TypeScript, Express, and Next.js.'
    },
    {
      id: 2,
      title: 'Hub Operations Manager',
      dept: 'Operations & Logistics',
      loc: 'Ahmedabad (AMD Airport & SG Highway Hubs)',
      type: 'Full-Time',
      desc: 'Lead a team of vehicle delivery agents, coordinate vehicle cleaning checklists, and oversee fleet maintenance parameters. Requires strong logistics experience.'
    },
    {
      id: 3,
      title: 'Senior Fleet Maintenance Technician',
      dept: 'Fleet Care & Safety',
      loc: 'Ahmedabad Hubs',
      type: 'Full-Time',
      desc: 'Oversee vehicle health checks, perform preventative repairs, diagnose engine issues, and manage vehicle downtime logs. Requires relevant mechanical certifications.'
    }
  ];

  const handleApplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    // Simulate server submission
    setTimeout(() => {
      setSubmitting(false);
      setSelectedJob(null);
      setName('');
      setEmail('');
      alert('Thank you for applying to ZipTrip! Our recruitment team will review your application and resume and reach out within 3 business days.');
    }, 1200);
  };

  return (
    <div className="max-width-container py-12">
      {/* Title */}
      <div className="text-center max-w-2xl mx-auto mb-16">
        <span className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full font-bold uppercase tracking-wider">
          Careers at ZipTrip
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-3">
          Build the Future of Shared Mobility
        </h2>
        <p className="text-slate-600 text-sm mt-3">
          Join our growing engineering, operations, and technician teams in Ahmedabad. Help us build Gujarat's leading self-drive platform.
        </p>
      </div>

      {/* Jobs list */}
      <div className="space-y-6 max-w-4xl mx-auto">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-1.5">
          <Briefcase className="text-brand-600" size={20} /> Open Job Positions
        </h3>

        {jobs.map((job) => (
          <div
            key={job.id}
            className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md hover:border-brand-200 transition-all flex flex-col sm:flex-row justify-between sm:items-center gap-4"
          >
            <div>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                {job.dept}
              </span>
              <h4 className="font-extrabold text-slate-900 text-base sm:text-lg mt-2 leading-tight">
                {job.title}
              </h4>

              <div className="flex gap-4 mt-3 text-xs text-slate-500 font-semibold">
                <span className="flex items-center gap-1">
                  <MapPin size={12} className="text-brand-500" /> {job.loc}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={12} className="text-brand-500" /> {job.type}
                </span>
              </div>
            </div>

            <button
              onClick={() => setSelectedJob(job)}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-1 self-start sm:self-center shrink-0 cursor-pointer shadow-sm hover:shadow transition-all"
            >
              Apply Now <ChevronRight size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Apply Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative border border-gray-100">
            <button
              onClick={() => setSelectedJob(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>

            <h3 className="text-lg font-bold text-slate-800 mb-1">Submit Application</h3>
            <p className="text-xs text-slate-500 mb-6">
              Applying for: <strong className="text-slate-800">{selectedJob.title}</strong>
            </p>

            <form onSubmit={handleApplySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Amit Patel"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. amit@ziptrip.com"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Attach Resume (PDF/Word)</label>
                <input
                  type="file"
                  required
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-2.5 rounded-lg text-sm transition-all shadow-md mt-6 flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Submitting Application...
                  </>
                ) : (
                  <>
                    Submit Resume <Send size={14} />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
