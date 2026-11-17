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

  const checkStatus = async () => {
    try {
      const res = await getHealth();
      setIsHealthy(true);
      if (res.data.active_policy_version) {
        setPolicyVersion(res.data.active_policy_version);
      }
    } catch (err) {
      setIsHealthy(false);
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activePolicyVersion={policyVersion}
        isHealthy={isHealthy}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'chat' && (
          <ChatIntake onRequirementCreated={() => checkStatus()} />
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

      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <p>
          Corvo Engineering Autonomous Procurement System • Built for Cantill.ai Full-stack Challenge • MERN Stack (React + Express + Node + MongoDB)
        </p>
      </footer>
    </div>
  );
}

