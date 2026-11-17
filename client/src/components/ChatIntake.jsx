import React, { useState, useRef, useEffect } from 'react';
import {
  Send, Upload, Sparkles, AlertCircle, CheckCircle2, FileSpreadsheet,
  ArrowRight, RefreshCw, Bot, User, CornerDownRight, ExternalLink, ShieldCheck
} from 'lucide-react';
import { sendChatMessage, processBatchUpload } from '../services/api';

export default function ChatIntake({ onRequirementCreated, onNavigateToBuyer }) {
  const [mode, setMode] = useState('chat'); // 'chat' or 'batch'
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: "👋 **Welcome to Cantill ProcureOS Intake.**\n\nRaise purchase requests naturally. Describe what you need (e.g. *\"Need 50 pieces of bearing 6308 ZZ for Chakan plant by next Friday\"*), and the engine will identify the catalog item, ask for missing details, and evaluate the active procurement policy to decide between a direct Purchase Order or a sourcing request.",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [sessionState, setSessionState] = useState({});
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Batch upload state
  const [batchFile, setBatchFile] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResult, setBatchResult] = useState(null);
  const [batchError, setBatchError] = useState('');

  const quickPrompts = [
    "Need 50 pieces of bearing 6308 ZZ for Chakan plant by next Friday",
    "10 pneumatic cylinders for Pune urgent breakdown",
    "1 drinking water purifier 50 LPH for Chakan",
    "50 PLC CPU modules for Pune plant capex project"
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (textToSend) => {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    const userMsg = { sender: 'user', text, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await sendChatMessage(text, sessionState);
      const data = res.data;

      const botMsg = {
        sender: 'bot',
        text: data.reply,
        timestamp: new Date(),
        requirement: data.requirement || null
      };

      setMessages((prev) => [...prev, botMsg]);
      setSessionState(data.session_state || {});

      if (data.requirement && onRequirementCreated) {
        onRequirementCreated(data.requirement);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: `⚠️ **Error:** ${err.response?.data?.error || err.message}`,
          timestamp: new Date()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchSubmit = async (e) => {
    e.preventDefault();
    if (!batchFile) return;

    setBatchLoading(true);
    setBatchError('');
    setBatchResult(null);

    try {
      const res = await processBatchUpload(batchFile);
      setBatchResult(res.data);
      if (onRequirementCreated) onRequirementCreated();
    } catch (err) {
      setBatchError(err.response?.data?.error || err.message);
    } finally {
      setBatchLoading(false);
    }
  };

  const routeBadges = {
    CONTRACT_PO: {
      bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      label: 'CONTRACT_PO',
      desc: 'Direct Contract PO'
    },
    SPOT_PO: {
      bg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
      label: 'SPOT_PO',
      desc: 'Direct Spot PO (≤ ₹2,00,000)'
    },
    RFQ: {
      bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      label: 'RFQ',
      desc: 'Request for Quotation (Min 3 quotes)'
    },
    RFP: {
      bg: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      label: 'RFP',
      desc: 'Request for Proposal (> ₹10,00,000)'
    },
    EMERGENCY_PO: {
      bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
      label: 'EMERGENCY_PO',
      desc: 'Emergency PO (≤ ₹5,00,000)'
    },
    NEW_ITEM_SOURCING: {
      bg: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
      label: 'NEW_ITEM_SOURCING',
      desc: 'Technical Qualification & Sourcing'
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Mode Switcher */}
      <div className="flex items-center justify-between">
        <div className="flex bg-slate-900/90 p-1 rounded-xl border border-slate-800 shadow-md">
          <button
            onClick={() => setMode('chat')}
            className={`flex items-center space-x-2 px-5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
              mode === 'chat'
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Conversational Intake</span>
          </button>
          <button
            onClick={() => setMode('batch')}
            className={`flex items-center space-x-2 px-5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
              mode === 'batch'
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Batch PR CSV Ingestion</span>
          </button>
        </div>

        <div className="text-xs text-slate-400 hidden sm:block">
          Powered by <strong className="text-slate-200">Policy-as-Data Engine</strong>
        </div>
      </div>

      {mode === 'chat' ? (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl shadow-xl flex flex-col h-[700px] overflow-hidden backdrop-blur-md">
          {/* Messages Stream */}
          <div className="flex-1 p-6 overflow-y-auto space-y-5">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex items-start space-x-3 ${m.sender === 'user' ? 'flex-row-reverse space-x-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md ${
                    m.sender === 'user'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-indigo-400 border border-slate-700'
                  }`}
                >
                  {m.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Message Bubble */}
                <div
                  className={`max-w-2xl rounded-2xl px-5 py-4 text-xs leading-relaxed shadow-sm ${
                    m.sender === 'user'
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white'
                      : 'bg-slate-800/90 text-slate-200 border border-slate-700/80'
                  }`}
                >
                  <div className="whitespace-pre-line prose prose-invert prose-xs">{m.text}</div>

                  {/* Embedded Decision Preview Card */}
                  {m.requirement && (
                    <div className="mt-4 pt-3.5 border-t border-slate-700/80 bg-slate-950/60 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-[11px] font-bold text-indigo-400">
                            {m.requirement.req_id}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                              routeBadges[m.requirement.system_route]?.bg || 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {m.requirement.system_route}
                          </span>
                        </div>
                        {onNavigateToBuyer && (
                          <button
                            onClick={onNavigateToBuyer}
                            className="flex items-center space-x-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                          >
                            <span>Open in Workspace</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Policy Clause Citation Box */}
                      <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] text-slate-300 flex items-start space-x-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-white block">Policy Decision Explanation:</strong>
                          <span className="text-slate-300">{m.requirement.system_clause}</span>
                        </div>
                      </div>

                      {/* Financial & Sourcing Info */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] pt-1 border-t border-slate-800/60">
                        <div>
                          <span className="text-slate-500 block uppercase text-[10px]">Total Value</span>
                          <span className="font-bold text-white">₹{m.requirement.total_value_inr?.toLocaleString('en-IN')}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block uppercase text-[10px]">Valuation Method</span>
                          <span className="font-semibold text-indigo-300">{m.requirement.valuation_method}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block uppercase text-[10px]">Assigned / Recommended</span>
                          <span className="font-semibold text-slate-200">
                            {m.requirement.system_supplier_name || m.requirement.system_supplier_id || 'Multi-Vendor Sourcing'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-slate-800 text-indigo-400 border border-slate-700 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-slate-800/80 border border-slate-700 px-4 py-2.5 rounded-2xl text-xs text-slate-400 flex items-center space-x-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                  <span>Evaluating item specifications & policy clauses...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Bar */}
          <div className="px-6 py-2.5 bg-slate-950/60 border-t border-slate-800/80 flex items-center space-x-2 overflow-x-auto text-xs">
            <span className="text-slate-500 font-semibold text-[11px] whitespace-nowrap">Try:</span>
            {quickPrompts.map((p, i) => (
              <button
                key={i}
                onClick={() => handleSend(p)}
                className="whitespace-nowrap px-3 py-1 rounded-full bg-slate-800/90 border border-slate-700/80 text-slate-300 hover:border-indigo-500 hover:text-white hover:bg-slate-800 transition-all text-[11px]"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-4 bg-slate-900 border-t border-slate-800 flex items-center space-x-3"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. Need 200 nitrile gloves for Chakan plant by next Monday..."
              className="flex-1 px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs transition-all"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-semibold text-xs flex items-center space-x-2 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-indigo-600/20 transition-all"
            >
              <span>Submit PR</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      ) : (
        /* Batch Ingestion View */
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl shadow-xl p-8 space-y-6 backdrop-blur-md">
          <div className="max-w-xl mx-auto text-center space-y-2">
            <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto shadow-md">
              <Upload className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">Batch Purchase Requisition Ingestion</h3>
            <p className="text-xs text-slate-400">
              Upload multi-line PR CSV batches. The engine automatically clubs lines within 14-day creation & 7-day need-by
              windows, computes 4-tier valuations, assigns policy routes, and consolidates POs.
            </p>
          </div>

          <form onSubmit={handleBatchSubmit} className="max-w-xl mx-auto space-y-4">
            <div className="border-2 border-dashed border-slate-700 rounded-2xl p-6 text-center hover:border-indigo-500 transition-colors bg-slate-950/50">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setBatchFile(e.target.files[0])}
                className="block w-full text-xs text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500 mt-3">
                Expected columns: <code>pr_no, created_at, plant, item_code, description, quantity, need_by_date, urgency</code>
              </p>
            </div>

            {batchError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{batchError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!batchFile || batchLoading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-semibold text-xs hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-40 flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/25 transition-all"
            >
              {batchLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Evaluating Batch Requisitions...</span>
                </>
              ) : (
                <>
                  <span>Process Batch via Policy Engine</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Results Summary */}
          {batchResult && (
            <div className="mt-8 pt-6 border-t border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-emerald-400 font-semibold text-xs">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Batch Processed Successfully!</span>
                </div>
                <div className="text-xs text-slate-400">
                  Total PRs: <strong className="text-white">{batchResult.total_prs}</strong> | Clubbed Requirements: <strong className="text-white">{batchResult.total_requirements}</strong>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/60">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/90 text-slate-400 font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Req ID</th>
                      <th className="p-3">Item</th>
                      <th className="p-3">Plant</th>
                      <th className="p-3">Total Qty</th>
                      <th className="p-3">Total Value</th>
                      <th className="p-3">Route</th>
                      <th className="p-3">Lead Supplier</th>
                      <th className="p-3">Consolidated PO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-[11px]">
                    {batchResult.requirements.slice(0, 8).map((r, i) => (
                      <tr key={i} className="hover:bg-slate-900/40">
                        <td className="p-3 font-mono font-bold text-indigo-400">{r.req_id}</td>
                        <td className="p-3 font-medium text-slate-200">{r.item_name || r.item_code}</td>
                        <td className="p-3 text-slate-400">{r.plant}</td>
                        <td className="p-3 font-semibold text-white">{r.total_quantity}</td>
                        <td className="p-3 text-slate-200">₹{r.total_value_inr?.toLocaleString('en-IN')}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${routeBadges[r.system_route]?.bg || 'bg-slate-800'}`}>
                            {r.system_route}
                          </span>
                        </td>
                        <td className="p-3 text-slate-300">{r.system_supplier_name || r.system_supplier_id || '-'}</td>
                        <td className="p-3 font-mono text-slate-500">{r.po_number || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {onNavigateToBuyer && (
                <div className="text-center pt-2">
                  <button
                    onClick={onNavigateToBuyer}
                    className="inline-flex items-center space-x-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                  >
                    <span>View all {batchResult.requirements.length} requirements in Buyer Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
