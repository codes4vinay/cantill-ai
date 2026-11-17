import React from 'react';
import { Bot, Layers, ShieldCheck, Truck, FileText, CheckCircle2 } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, activePolicyVersion, isHealthy }) {
  const tabs = [
    { id: 'chat', label: 'Chat Intake (Employee)', icon: Bot },
    { id: 'buyer', label: 'Buyer Workspace', icon: Layers },
    { id: 'policy', label: 'Policy Manager (Data)', icon: ShieldCheck },
    { id: 'suppliers', label: 'Suppliers & Contracts', icon: Truck },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo & Company Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-200">
              <span className="font-extrabold text-lg tracking-wider">C</span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">Corvo Engineering</h1>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Cantill.ai
                </span>
              </div>
              <p className="text-xs text-slate-500">Autonomous Procurement Decision Engine</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex space-x-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* System Status Indicators */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Policy: <strong className="text-indigo-600">{activePolicyVersion || 'v5.0'}</strong></span>
            </div>
            <div className="flex items-center space-x-1 text-xs text-slate-500">
              <CheckCircle2 className={`w-3.5 h-3.5 ${isHealthy ? 'text-emerald-500' : 'text-amber-500'}`} />
              <span>{isHealthy ? 'Engine Online' : 'Connecting'}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
