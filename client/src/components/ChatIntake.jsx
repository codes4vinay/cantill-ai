import React, { useState, useRef, useEffect } from 'react';
import { Send, Upload, Sparkles, AlertCircle, CheckCircle2, FileSpreadsheet, ArrowRight, RefreshCw } from 'lucide-react';
import { sendChatMessage, processBatchUpload } from '../services/api';

export default function ChatIntake({ onRequirementCreated }) {
  const [mode, setMode] = useState('chat'); // 'chat' or 'batch'
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: "👋 Welcome to Corvo Procurement Assistant. You can describe what you need (e.g., *'Need 50 pieces of bearing 6308 ZZ for Chakan plant by next Friday'*), and I will identify the catalog item, ask for missing details, and evaluate the company policy to determine the procurement route.",
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
          text: `⚠️ Error: ${err.response?.data?.error || err.message}`,
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

  const routeColors = {
    CONTRACT_PO: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    SPOT_PO: 'bg-blue-100 text-blue-800 border-blue-300',
    RFQ: 'bg-amber-100 text-amber-800 border-amber-300',
    RFP: 'bg-purple-100 text-purple-800 border-purple-300',
    EMERGENCY_PO: 'bg-rose-100 text-rose-800 border-rose-300',
    NEW_ITEM_SOURCING: 'bg-slate-100 text-slate-800 border-slate-300'
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Mode Switcher */}
      <div className="flex bg-slate-200 p-1 rounded-xl w-fit">
        <button
          onClick={() => setMode('chat')}
          className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
            mode === 'chat' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Interactive Chat Intake</span>
        </button>
        <button
          onClick={() => setMode('batch')}
          className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
            mode === 'batch' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Batch PR CSV Upload</span>
        </button>
      </div>

      {mode === 'chat' ? (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col h-[700px] overflow-hidden">
          {/* Chat Messages */}
          <div className="flex-1 p-6 overflow-y-auto space-y-4">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-2xl rounded-2xl px-5 py-3.5 text-sm leading-relaxed ${
                    m.sender === 'user'
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-100'
                      : 'bg-slate-100 text-slate-800 border border-slate-200'
                  }`}
                >
                  <div className="whitespace-pre-line">{m.text}</div>

                  {/* Embedded Decision Preview Card if Bot confirmed PR */}
                  {m.requirement && (
                    <div className="mt-3 pt-3 border-t border-slate-300/80 bg-white/70 p-3 rounded-xl space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700">Policy Decision:</span>
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold border ${
                            routeColors[m.requirement.system_route] || 'bg-slate-100'
                          }`}
                        >
                          {m.requirement.system_route}
                        </span>
                      </div>
                      <div className="text-slate-600">
                        <strong>Rule Applied:</strong> {m.requirement.system_clause}
                      </div>
                      <div className="flex justify-between text-slate-500 pt-1">
                        <span>Total: ₹{m.requirement.total_value_inr?.toLocaleString('en-IN')}</span>
                        <span>Method: {m.requirement.valuation_method}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 border border-slate-200 rounded-2xl px-4 py-2 text-xs text-slate-500 flex items-center space-x-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                  <span>Evaluating item specifications & policy clauses...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Bar */}
          <div className="px-6 py-2 bg-slate-50 border-t border-slate-100 flex items-center space-x-2 overflow-x-auto text-xs">
            <span className="text-slate-400 font-medium whitespace-nowrap">Try:</span>
            {quickPrompts.map((p, i) => (
              <button
                key={i}
                onClick={() => handleSend(p)}
                className="whitespace-nowrap px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-600 hover:border-indigo-400 hover:text-indigo-600 transition-colors shadow-2xs"
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
            className="p-4 bg-white border-t border-slate-200 flex items-center space-x-3"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. Need 200 nitrile gloves for Chakan plant by next Monday..."
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-medium text-sm flex items-center space-x-2 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
            >
              <span>Send</span>
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      ) : (
        /* Batch Upload Mode */
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 space-y-6">
          <div className="max-w-xl mx-auto text-center space-y-2">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
              <Upload className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Upload PR Batch CSV</h3>
            <p className="text-sm text-slate-500">
              Upload multiple purchase requisitions at once. The engine will parse lines, match catalog items, club
              into requirements, evaluate policy rules, and consolidate POs.
            </p>
          </div>

          <form onSubmit={handleBatchSubmit} className="max-w-xl mx-auto space-y-4">
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:border-indigo-500 transition-colors cursor-pointer bg-slate-50/50">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setBatchFile(e.target.files[0])}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
              <p className="text-xs text-slate-400 mt-2">Accepted format: CSV containing item_code, quantity, plant, need_by_date, urgency</p>
            </div>

            {batchError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{batchError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!batchFile || batchLoading}
              className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center space-x-2 shadow-md shadow-indigo-100 transition-all"
            >
              {batchLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing Batch with Decision Engine...</span>
                </>
              ) : (
                <>
                  <span>Process Batch Requisitions</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Batch Result Summary */}
          {batchResult && (
            <div className="mt-8 pt-6 border-t border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-emerald-600 font-semibold text-sm">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Batch Processed Successfully!</span>
                </div>
                <div className="text-xs text-slate-500">
                  Total PRs: <strong>{batchResult.total_prs}</strong> | Clubbed Requirements: <strong>{batchResult.total_requirements}</strong>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-semibold uppercase">
                    <tr>
                      <th className="p-3">Req ID</th>
                      <th className="p-3">Item</th>
                      <th className="p-3">Plant</th>
                      <th className="p-3">Qty</th>
                      <th className="p-3">Value (INR)</th>
                      <th className="p-3">Route</th>
                      <th className="p-3">Supplier</th>
                      <th className="p-3">PO #</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {batchResult.requirements.slice(0, 10).map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-3 font-mono font-medium text-indigo-600">{r.req_id}</td>
                        <td className="p-3 font-medium">{r.item_name || r.item_code}</td>
                        <td className="p-3">{r.plant}</td>
                        <td className="p-3 font-semibold">{r.total_quantity}</td>
                        <td className="p-3">₹{r.total_value_inr?.toLocaleString('en-IN')}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded font-bold border ${routeColors[r.system_route] || 'bg-slate-100'}`}>
                            {r.system_route}
                          </span>
                        </td>
                        <td className="p-3">{r.system_supplier_name || r.system_supplier_id || '-'}</td>
                        <td className="p-3 font-mono text-slate-500">{r.po_number || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {batchResult.requirements.length > 10 && (
                <p className="text-xs text-center text-slate-400">
                  Showing first 10 of {batchResult.requirements.length} requirements. View full list in the Buyer Workspace.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

