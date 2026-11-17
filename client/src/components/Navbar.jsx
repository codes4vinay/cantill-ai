import React from 'react';
import { MessageSquare, Layers, ShieldCheck, Truck, Sparkles, Activity } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, activePolicyVersion, isHealthy }) {
  const tabs = [
    { id: 'chat', label: 'AI Intake & Batch', icon: MessageSquare },
    { id: 'buyer', label: 'Buyer Workspace', icon: Layers },
    { id: 'policy', label: 'Policy Engine (Data)', icon: ShieldCheck },
    { id: 'suppliers', label: 'Suppliers & Contracts', icon: Truck },
  ];

  return (
    <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/80 shadow-2xl shadow-black/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3.5">
            <div className="relative group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 transition-transform group-hover:scale-105 duration-200">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse"></span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-base font-extrabold tracking-tight text-white">
                  Cantill<span className="text-indigo-400">.ai</span>
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  ProcureOS
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium tracking-tight">Policy-Driven PR-to-PO Decision Platform</p>
            </div>
          </div>

          {/* Navigation Pill Bar */}
          <nav className="flex items-center bg-slate-950/70 p-1 rounded-xl border border-slate-800/90 shadow-inner">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
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

          {/* Status Indicators */}
          <div className="flex items-center space-x-2.5">
            {/* Policy Badge */}
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs font-medium text-indigo-300">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>Policy: <strong className="text-white font-mono">{activePolicyVersion || 'v5.0'}</strong></span>
            </div>

            {/* Health Pulse */}
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-300">
              <span className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              <span>{isHealthy ? 'Engine Active' : 'Connecting'}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
