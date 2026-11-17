import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, FileCode, ArrowRight, CheckCircle2, History, AlertCircle,
  Sparkles, RefreshCw, Layers, Sliders
} from 'lucide-react';
import { getPolicy, previewPolicyDiff, activatePolicy } from '../services/api';

export default function PolicyManager({ onPolicyChanged }) {
  const [activePolicy, setActivePolicy] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  // Amendment Studio State
  const [amendmentPrompt, setAmendmentPrompt] = useState('');
  const [targetVersion, setTargetVersion] = useState('v5.1');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [editableClauses, setEditableClauses] = useState({});
  const [diffResults, setDiffResults] = useState(null);
  const [activating, setActivating] = useState(false);
  const [activationMsg, setActivationMsg] = useState('');

  const fetchPolicy = async () => {
    setLoading(true);
    try {
      const res = await getPolicy();
      const current = res.data.active_policy;
      setActivePolicy(current);
      setHistory(res.data.history || []);
      setEditableClauses(current?.clauses || {});
    } catch (err) {
      console.error('Failed to load policy:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicy();
  }, []);

  const handlePreviewDiff = async () => {
    try {
      const res = await previewPolicyDiff({
        amendment_text: amendmentPrompt,
        proposed_clauses: editableClauses
      });
      setDiffResults(res.data);
      if (res.data.proposed_clauses) {
        setEditableClauses(res.data.proposed_clauses);
      }
    } catch (err) {
      alert('Error calculating diff: ' + err.message);
    }
  };

  const handleActivate = async () => {
    if (!targetVersion) return;
    setActivating(true);
    setActivationMsg('');

    try {
      const res = await activatePolicy({
        version: targetVersion,
        effective_date: effectiveDate,
        clauses: editableClauses,
        amendment_text: amendmentPrompt,
        change_summary: `Amendment ${targetVersion} activated via Policy Manager.`
      });

      setActivationMsg(res.data.message);
      setDiffResults(null);
      fetchPolicy();
      if (onPolicyChanged) onPolicyChanged(targetVersion);
    } catch (err) {
      alert('Error activating policy: ' + err.message);
    } finally {
      setActivating(false);
    }
  };

  const sampleAmendments = [
    "Raise spot purchase threshold to INR 3,00,000 and emergency limit to INR 7,50,000",
    "Increase PR creation clubbing window to 21 days and need-by window to 10 days",
    "Lower RFQ minimum threshold to INR 1,50,000"
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-6 h-6 text-indigo-600" />
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Policy-as-Data Architecture</h2>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            Zero-Code Updates
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Corvo Procurement Policy is modeled purely as versioned configuration data. Amendments take effect
          immediately across the decision engine without any application restarts or code modifications.
        </p>
      </div>

      {/* Active Policy Status Cards */}
      {activePolicy && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Policy</span>
              <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                <span>{activePolicy.title || 'Corvo Procurement Policy'}</span>
                <span className="px-2.5 py-0.5 rounded-md text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {activePolicy.version} ACTIVE
                </span>
              </h3>
            </div>
            <div className="text-xs text-slate-500">
              Effective Since: <strong>{new Date(activePolicy.effective_date).toLocaleDateString()}</strong>
            </div>
          </div>

          {/* Policy Parameters Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Spot Threshold</span>
              <span className="text-base font-bold text-slate-800">
                ₹{activePolicy.clauses?.spot_threshold_inr?.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">RFQ Ceiling</span>
              <span className="text-base font-bold text-slate-800">
                ₹{activePolicy.clauses?.rfq_max_threshold_inr?.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Emergency Cap</span>
              <span className="text-base font-bold text-slate-800">
                ₹{activePolicy.clauses?.emergency_threshold_inr?.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Clubbing Windows</span>
              <span className="text-base font-bold text-slate-800">
                {activePolicy.clauses?.clubbing_window_days_creation}d / {activePolicy.clauses?.clubbing_window_days_need_by}d
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Policy Amendment Studio */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-5 h-5 text-indigo-600" />
          <h3 className="font-bold text-slate-900 text-base">Policy Amendment Studio</h3>
        </div>

        {/* Natural Language Prompt or Input */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700 block">
            Dictate Policy Amendment (Natural Language or Document Snippet)
          </label>
          <textarea
            rows={3}
            value={amendmentPrompt}
            onChange={(e) => setAmendmentPrompt(e.target.value)}
            placeholder="e.g. Please raise spot purchase threshold to INR 3,00,000 and emergency limit to INR 7,50,000..."
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
          <div className="flex flex-wrap gap-2 pt-1 text-xs">
            <span className="text-slate-400 text-[11px] self-center">Templates:</span>
            {sampleAmendments.map((s, idx) => (
              <button
                key={idx}
                onClick={() => setAmendmentPrompt(s)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors text-[11px]"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Manual Threshold Tweaks */}
        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700">
            <Sliders className="w-4 h-4 text-slate-500" />
            <span>Direct Parameter Overrides</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Spot Threshold (INR)</label>
              <input
                type="number"
                value={editableClauses.spot_threshold_inr || ''}
                onChange={(e) => setEditableClauses({ ...editableClauses, spot_threshold_inr: Number(e.target.value) })}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Emergency Limit (INR)</label>
              <input
                type="number"
                value={editableClauses.emergency_threshold_inr || ''}
                onChange={(e) => setEditableClauses({ ...editableClauses, emergency_threshold_inr: Number(e.target.value) })}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">RFQ Upper Limit (INR)</label>
              <input
                type="number"
                value={editableClauses.rfq_max_threshold_inr || ''}
                onChange={(e) => setEditableClauses({ ...editableClauses, rfq_max_threshold_inr: Number(e.target.value) })}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
              />
            </div>
          </div>
        </div>

        {/* Preview Diff Button */}
        <div className="flex justify-end">
          <button
            onClick={handlePreviewDiff}
            className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition-all shadow-sm flex items-center space-x-2"
          >
            <span>Preview Plain-English Diff</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Side-by-Side Diff Display */}
        {diffResults && (
          <div className="mt-4 p-5 rounded-2xl bg-indigo-50/50 border border-indigo-200 space-y-4 text-xs">
            <h4 className="font-bold text-indigo-950 text-sm flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              <span>Proposed Policy Changes & Impact Analysis</span>
            </h4>

            {diffResults.diffs.length === 0 ? (
              <p className="text-slate-600 italic">No parameter changes detected in the proposal.</p>
            ) : (
              <div className="space-y-2">
                {diffResults.diffs.map((d, i) => (
                  <div key={i} className="p-3 bg-white rounded-xl border border-indigo-100 flex items-center justify-between">
                    <div>
                      <strong className="text-slate-900 block">{d.label}</strong>
                      <span className="text-indigo-700 font-mono text-[11px]">{d.summary}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                      Modified
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Versioning & Activation Box */}
            <div className="pt-4 border-t border-indigo-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div>
                  <label className="text-[10px] uppercase font-semibold text-slate-500 block">Target Version</label>
                  <input
                    type="text"
                    value={targetVersion}
                    onChange={(e) => setTargetVersion(e.target.value)}
                    className="px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-mono font-bold w-24 bg-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-semibold text-slate-500 block">Effective Date</label>
                  <input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className="px-2.5 py-1 rounded-lg border border-slate-300 text-xs bg-white"
                  />
                </div>
              </div>

              <button
                onClick={handleActivate}
                disabled={activating}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-md shadow-emerald-200"
              >
                {activating ? 'Activating Policy...' : `Approve & Activate ${targetVersion}`}
              </button>
            </div>
          </div>
        )}

        {activationMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-medium flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>{activationMsg}</span>
          </div>
        )}
      </div>

      {/* Version History Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 text-xs">
        <div className="flex items-center space-x-2">
          <History className="w-4 h-4 text-slate-500" />
          <h3 className="font-bold text-slate-900 text-sm">Policy Version History & Audit Trail</h3>
        </div>

        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
          {history.map((h, i) => (
            <div key={i} className="p-3.5 flex items-center justify-between hover:bg-slate-50">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold font-mono text-slate-900">{h.version}</span>
                  {h.active ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      ACTIVE
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                      Archived
                    </span>
                  )}
                </div>
                <p className="text-slate-500 text-[11px] mt-0.5">{h.change_summary || h.title}</p>
              </div>
              <div className="text-slate-400 text-[11px]">
                Effective: {new Date(h.effective_date).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
