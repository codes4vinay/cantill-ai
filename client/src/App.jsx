import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import ChatIntake from './components/ChatIntake';
import BuyerWorkspace from './components/BuyerWorkspace';
import PolicyManager from './components/PolicyManager';
import SuppliersContracts from './components/SuppliersContracts';
import { getHealth } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('chat');
  const [policyVersion, setPolicyVersion] = useState('v5.0');
  const [isHealthy, setIsHealthy] = useState(false);
  const [stats, setStats] = useState(null);

  const checkStatus = async () => {
    try {
      const res = await getHealth();
      setIsHealthy(true);
      if (res.data.active_policy_version) {
        setPolicyVersion(res.data.active_policy_version);
      }
      if (res.data.stats) {
        setStats(res.data.stats);
      }
    } catch (err) {
      setIsHealthy(false);
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 20000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Background ambient subtle gradients */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl"></div>
      </div>

      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activePolicyVersion={policyVersion}
        isHealthy={isHealthy}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'chat' && (
          <ChatIntake
            onRequirementCreated={() => checkStatus()}
            onNavigateToBuyer={() => setActiveTab('buyer')}
          />
        )}
        {activeTab === 'buyer' && (
          <BuyerWorkspace />
        )}
        {activeTab === 'policy' && (
          <PolicyManager onPolicyChanged={(v) => { setPolicyVersion(v); checkStatus(); }} />
        )}
        {activeTab === 'suppliers' && (
          <SuppliersContracts />
        )}
      </main>
    </div>
  );
}
