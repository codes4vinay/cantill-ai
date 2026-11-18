import React, { useState } from 'react';
import {
  MessageSquare, Layers, ShieldCheck, Truck, Sparkles, Activity,
  HelpCircle, X, CheckCircle2, ArrowRight, Menu
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, activePolicyVersion, isHealthy }) {
  const [showHelp, setShowHelp] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const tabs = [
    { id: 'chat', label: '1. AI Intake & Batch', icon: MessageSquare },
    { id: 'buyer', label: '2. Buyer Workspace', icon: Layers },
    { id: 'policy', label: '3. Policy Engine (Data)', icon: ShieldCheck },
    { id: 'suppliers', label: '4. Suppliers & Contracts', icon: Truck },
  ];

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-xl border-b border-slate-800/80 shadow-2xl shadow-black/40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo & Brand */}
            <div className="flex items-center space-x-2.5 sm:space-x-3.5">
              <div className="relative group">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 transition-transform group-hover:scale-105 duration-200">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse"></span>
              </div>
              <div>
                <div className="flex items-center space-x-1.5 sm:space-x-2">
                  <span className="text-sm sm:text-base font-extrabold tracking-tight text-white">
                    Cantill<span className="text-indigo-400">.ai</span>
                  </span>
                  <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider px-1.5 sm:px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                    ProcureOS
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium tracking-tight hidden sm:block">
                  Policy-Driven PR-to-PO Decision Platform
                </p>
              </div>
            </div>

            {/* Desktop Navigation Pill Bar */}
            <nav className="hidden lg:flex items-center bg-slate-950/70 p-1 rounded-xl border border-slate-800/90 shadow-inner">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabClick(tab.id)}
                    className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-600/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Desktop Status & Guide Buttons */}
            <div className="hidden sm:flex items-center space-x-2">
              <button
                onClick={() => setShowHelp(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>How It Works</span>
              </button>

              <div className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-medium text-indigo-300">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                <span>Policy: <strong className="text-white font-mono">{activePolicyVersion || 'v5.0'}</strong></span>
              </div>
            </div>

            {/* Mobile Hamburger Toggle & Compact Badge */}
            <div className="flex items-center space-x-2 lg:hidden">
              <div className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[10px] font-semibold text-indigo-300 flex items-center space-x-1">
                <ShieldCheck className="w-3 h-3 text-indigo-400" />
                <span>{activePolicyVersion || 'v5.0'}</span>
              </div>

              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors"
                aria-label="Toggle navigation"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-slate-950/95 border-b border-slate-800 px-4 pt-2 pb-5 space-y-3 backdrop-blur-2xl">
            <div className="space-y-1 pt-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabClick(tab.id)}
                    className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-600/30'
                        : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
              <button
                onClick={() => { setShowHelp(true); setMobileMenuOpen(false); }}
                className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>💡 How It Works Guide</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* "How It Works" Explainer Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-5 text-xs text-slate-300">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">?</div>
                <div>
                  <h3 className="text-sm font-bold text-white">How This App Works (The Big Picture)</h3>
                  <p className="text-[11px] text-slate-400">Everything you need to know in 60 seconds</p>
                </div>
              </div>
              <button onClick={() => setShowHelp(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 leading-relaxed">
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <strong className="text-white text-xs block">What problem does this app solve?</strong>
                <p className="text-slate-400">
                  Workers in factory plants (Chakan and Pune) need materials every day. Traditionally, buyers had to manually read a 20-page policy manual to decide whether to place a direct purchase order or get competitive vendor quotes. This app automates those decisions instantly.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
                  <span className="font-bold text-indigo-400 block">Tab 1: AI Intake & Batch</span>
                  <p className="text-slate-400">
                    Workers chat naturally (e.g. <em>"Need 50 bearings for Chakan by Friday"</em>) or upload a CSV. The computer extracts items, plant, qty, and checks the policy.
                  </p>
                </div>

                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
                  <span className="font-bold text-indigo-400 block">Tab 2: Buyer Workspace</span>
                  <p className="text-slate-400">
                    Procurement managers review the computer's decisions, view the exact policy rule citations, and click <strong>Approve</strong> or <strong>Override</strong>.
                  </p>
                </div>

                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
                  <span className="font-bold text-indigo-400 block">Tab 3: Policy Engine (Data)</span>
                  <p className="text-slate-400">
                    Where the boss changes rules (e.g. raise spot limit from ₹2L to ₹3L). The app updates its behavior <strong>instantly without code changes</strong>.
                  </p>
                </div>

                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
                  <span className="font-bold text-indigo-400 block">Tab 4: Suppliers & Contracts</span>
                  <p className="text-slate-400">
                    Tracks active vendor contracts, remaining budget ceilings, and calculated preferred supplier rankings.
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-indigo-950/30 rounded-xl border border-indigo-500/30 space-y-1.5">
                <strong className="text-indigo-300 text-xs block">The 3 Most Common Decisions:</strong>
                <ul className="space-y-1 text-slate-300 text-[11px]">
                  <li>• <strong className="text-emerald-400 font-mono">CONTRACT_PO:</strong> An active discount contract exists for this item. Buy directly.</li>
                  <li>• <strong className="text-cyan-400 font-mono">SPOT_PO:</strong> Total cost is cheap (under ₹2 Lakh). Buy directly from favorite vendor.</li>
                  <li>• <strong className="text-amber-400 font-mono">RFQ:</strong> Total cost is high (₹2L - ₹10L). Policy forces getting at least 3 quotes.</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowHelp(false)}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30"
              >
                Got It! Let's Explore
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
