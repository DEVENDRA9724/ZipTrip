'use client';

import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, MessageSquare, Send, Bot, User, PhoneCall, Mail } from 'lucide-react';

interface Message {
  id: number;
  sender: 'bot' | 'user';
  text: string;
}

export default function Support() {
  // Chatbot State
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, sender: 'bot', text: 'Namaste! Welcome to ZipTrip Help Chat. How can I assist you with your self-drive rental today?' }
  ]);
  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // FAQ State
  const [openFAQIndex, setOpenFAQIndex] = useState<number | null>(null);

  const faqs = [
    {
      q: 'How long does the KYC verification process take?',
      a: 'Our digital KYC pipeline processes uploads instantly. The Aadhaar details and Selfie are checked via biometric FaceMatch APIs. Approval typically takes less than 2 minutes. If your status goes to UNKNOWN, please retry uploading under better lighting.'
    },
    {
      q: 'When is the security deposit refunded?',
      a: 'We process security deposit refunds immediately upon vehicle return and inspection at the hub. The amount will reflect in your bank account or card within 3-5 operational business days.'
    },
    {
      q: 'What is the fuel reimbursement policy?',
      a: 'ZipTrip rates exclude fuel. You receive the vehicle with a full tank and must return it with a full tank. If you pay for refuelling out-of-pocket, submit the invoice receipt on the support ticket to receive immediate drive credits.'
    },
    {
      q: 'Can I extend my booking duration mid-trip?',
      a: 'Yes, extensions are allowed subject to vehicle availability. Open your "My Bookings" page and click "Extend Booking" to calculate rates and confirm. Surcharges of 20% apply for weekend extensions.'
    },
    {
      q: 'What should I do in case of an accident or breakdown?',
      a: 'Do not panic. Ensure your safety first. Contact our 24/7 Roadside Assistance helpline at +91 79 1234 5678. Our operations center will dispatch towing and help file the insurance survey report.'
    }
  ];

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userMsg = inputText.trim();
    const nextId = messages.length + 1;

    setMessages(prev => [...prev, { id: nextId, sender: 'user', text: userMsg }]);
    setInputText('');

    // Simulate bot thinking and reply
    setTimeout(() => {
      let reply = 'I am scanning our databases for your query... For urgent matters, please contact our Ahmedabad operations help desk at +91 79 1234 5678.';

      const textLower = userMsg.toLowerCase();
      if (textLower.includes('kyc') || textLower.includes('verify') || textLower.includes('aadhaar')) {
        reply = 'KYC uploads are processed instantly. If you uploaded a selfie, our FaceMatch API compares it with your Driving License photograph. Ensure your images are clear, cropped, and under 5MB in size.';
      } else if (textLower.includes('deposit') || textLower.includes('refund') || textLower.includes('money')) {
        reply = 'Deposits are released immediately upon vehicle checkout check at the hub. It usually takes 3 to 5 business days to credit back to your credit card or bank.';
      } else if (textLower.includes('price') || textLower.includes('surge') || textLower.includes('charge')) {
        reply = 'We calculate prices dynamically. Weekend bookings (Friday evening to Sunday night) include a 20% surge, and pickup from Sardar Vallabhbhai Patel International Airport has a 15% location surge.';
      } else if (textLower.includes('accident') || textLower.includes('damage') || textLower.includes('break')) {
        reply = 'In case of collision or breakdown, call Roadside Assistance at +91 79 1234 5678. ZipTrip covers comprehensive damages, limiting customer liability to maximum ₹10,000.';
      }

      setMessages(prev => [...prev, { id: nextId + 1, sender: 'bot', text: reply }]);
    }, 1000);
  };

  const toggleFAQ = (index: number) => {
    setOpenFAQIndex(prev => prev === index ? null : index);
  };

  return (
    <div className="max-width-container py-10">
      <div className="text-center max-w-2xl mx-auto mb-16">
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Help & Support Center</h2>
        <p className="text-sm text-slate-500 mt-1">Resolve queries regarding security deposits, KYC verifications, and roadside breakdowns instantly.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 items-start">
        {/* FAQs section */}
        <div className="lg:col-span-3 space-y-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-1.5">
            <HelpCircle className="text-brand-600" size={20} /> Frequently Asked Questions
          </h3>

          <div className="space-y-4">
            {faqs.map((faq, idx) => {
              const isOpen = openFAQIndex === idx;
              return (
                <div key={idx} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm transition-all">
                  <button
                    onClick={() => toggleFAQ(idx)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left font-bold text-slate-800 hover:bg-slate-50/50 text-sm sm:text-base focus:outline-none"
                  >
                    <span>{faq.q}</span>
                    {isOpen ? <ChevronUp size={18} className="text-brand-600" /> : <ChevronDown size={18} className="text-slate-400" />}
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-slate-600 text-xs sm:text-sm leading-relaxed border-t border-slate-100">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Contact Methods */}
          <div className="mt-8 bg-slate-50 border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600 shrink-0">
                <PhoneCall size={18} />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase">24/7 Helpline</p>
                <p className="font-semibold text-slate-700 text-sm">+91 79 1234 5678</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <Mail size={18} />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase">Email Support</p>
                <p className="font-semibold text-slate-700 text-sm">support@ziptrip.com</p>
              </div>
            </div>
          </div>
        </div>

        {/* Live Chatbot section */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden flex flex-col h-[520px] justify-between">
          {/* Chat header */}
          <div className="bg-slate-900 text-white px-5 py-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-400">
              <Bot size={20} />
            </div>
            <div>
              <p className="font-bold text-sm leading-tight">Support Chatbot</p>
              <p className="text-[10px] text-emerald-400 font-semibold mt-0.5">Online | Autopilot</p>
            </div>
          </div>

          {/* Messages list */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-50/50">
            {messages.map((msg) => {
              const isBot = msg.sender === 'bot';
              return (
                <div key={msg.id} className={`flex items-start gap-2.5 ${isBot ? '' : 'flex-row-reverse'}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 ${isBot ? 'bg-slate-900 text-white' : 'bg-brand-600 text-white'}`}>
                    {isBot ? <Bot size={14} /> : <User size={14} />}
                  </div>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-sm ${isBot ? 'bg-white text-slate-700 border border-slate-200' : 'bg-brand-600 text-white'}`}>
                    {msg.text}
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          {/* Input form */}
          <form onSubmit={handleSendMessage} className="border-t border-slate-200 p-3 bg-white flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask about deposits, KYC, surges..."
              className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:border-brand-600 focus:outline-none bg-slate-50"
            />
            <button
              type="submit"
              className="bg-brand-600 hover:bg-brand-700 text-white p-2 rounded-xl transition-all shadow-md shrink-0 cursor-pointer"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
