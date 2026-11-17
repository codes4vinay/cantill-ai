import React, { useState, useEffect } from 'react';
import {
  Layers, Filter, Download, CheckCircle, Edit3, ChevronDown, ChevronUp,
  AlertTriangle, ShieldAlert, Building2, Calendar, FileText, Check, X,
  Search, CheckCircle2, TrendingUp, Sparkles, DollarSign, Clock
} from 'lucide-react';
import { getRequirements, approveRequirement, overrideRequirement, exportBatchCSV } from '../services/api';

export default function BuyerWorkspace() {
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [routeFilter, setRouteFilter] = useState('');
  const [plantFilter, setPlantFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  // Override Modal State
  const [overrideTarget, setOverrideTarget] = useState(null);
  const [newRoute, setNewRoute] = useState('');
  const [newSupplier, setNewSupplier] = useState('');
  const [overrideComment, setOverrideComment] = useState('');
  const [overrideError, setOverrideError] = useState('');
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);

  const fetchRequirements = async () => {
    setLoading(true);
    try {
      const res = await getRequirements({
        route: routeFilter,
        plant: plantFilter,
        status: statusFilter,
        search
      });
      setRequirements(res.data.requirements || []);
    } catch (err) {
      console.error('Failed to load requirements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequirements();
  }, [routeFilter, plantFilter, statusFilter, search]);

  const handleApprove = async (id) => {
    try {
      await approveRequirement(id, 'Lead Buyer');
      fetchRequirements();
    } catch (err) {
      alert('Error approving requirement: ' + err.message);
    }
  };

  const handleOpenOverride = (req) => {
    setOverrideTarget(req);
    setNewRoute(req.system_route);
    setNewSupplier(req.system_supplier_id || '');
    setOverrideComment('');
    setOverrideError('');
  };

  const handleSaveOverride = async (e) => {
    e.preventDefault();
    if (!overrideComment.trim()) {
      setOverrideError('Policy Violation: Overriding an autonomous policy decision requires a mandatory written comment.');
      return;
    }

    setOverrideSubmitting(true);
    setOverrideError('');

    try {
      await overrideRequirement(overrideTarget.req_id, {
        new_route: newRoute,
        new_supplier_id: newSupplier,
        comment: overrideComment.trim(),
        buyer_name: 'Lead Buyer'
      });
      setOverrideTarget(null);
      fetchRequirements();
    } catch (err) {
      setOverrideError(err.response?.data?.error || err.message);
    } finally {
      setOverrideSubmitting(false);
    }
  };

  // Metrics calculation
  const totalVal = requirements.reduce((sum, r) => sum + (Number(r.total_value_inr) || 0), 0);
  const directPOsCount = requirements.filter(r => ['CONTRACT_PO', 'SPOT_PO', 'EMERGENCY_PO'].includes(r.system_route)).length;
  const sourcingCount = requirements.filter(r => ['RFQ', 'RFP', 'NEW_ITEM_SOURCING'].includes(r.system_route)).length;
  const approvedCount = requirements.filter(r => r.status === 'Approved').length;

  const routeBadges = {
    CONTRACT_PO: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    SPOT_PO: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    RFQ: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    RFP: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    EMERGENCY_PO: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    NEW_ITEM_SOURCING: 'bg-slate-500/10 text-slate-300 border-slate-500/30'
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            <span>Buyer Procurement Workspace</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Review clubbed requirements, inspect algorithmic policy citations, approve PO dispatches, or log audited overrides.
          </p>
        </div>

        <a
          href={exportBatchCSV()}
          download
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 text-white hover:from-indigo-500 hover:to-indigo-400 text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all self-start sm:self-auto"
        >
          <Download className="w-4 h-4" />
          <span>Export All Requirements CSV</span>
        </a>
      </div>

      {/* KPI Stats Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 backdrop-blur-md">
          <span className="text-slate-500 block text-[10px] uppercase font-semibold">Total Requirements</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-xl font-extrabold text-white">{requirements.length}</span>
            <span className="text-[11px] text-indigo-400 font-medium">Clubbed Clusters</span>
          </div>
        </div>

        <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 backdrop-blur-md">
          <span className="text-slate-500 block text-[10px] uppercase font-semibold">Total Evaluation Value</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-xl font-extrabold text-white">₹{totalVal.toLocaleString('en-IN')}</span>
          </div>
        </div>

        <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 backdrop-blur-md">
          <span className="text-slate-500 block text-[10px] uppercase font-semibold">Direct PO Routes</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-xl font-extrabold text-emerald-400">{directPOsCount}</span>
            <span className="text-[11px] text-slate-500">Auto-Qualified</span>
          </div>
        </div>

        <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 backdrop-blur-md">
          <span className="text-slate-500 block text-[10px] uppercase font-semibold">Sourcing Requests</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-xl font-extrabold text-amber-400">{sourcingCount}</span>
            <span className="text-[11px] text-slate-500">RFQ / RFP / New</span>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-wrap gap-3 items-center backdrop-blur-md">
        <div className="flex-1 min-w-[220px] relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search Req ID, Item Code, or Description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <select
          value={routeFilter}
          onChange={(e) => setRouteFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700/80 text-xs font-medium text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Decision Routes</option>
          <option value="CONTRACT_PO">CONTRACT_PO</option>
          <option value="SPOT_PO">SPOT_PO</option>
          <option value="RFQ">RFQ</option>
          <option value="RFP">RFP</option>
          <option value="EMERGENCY_PO">EMERGENCY_PO</option>
          <option value="NEW_ITEM_SOURCING">NEW_ITEM_SOURCING</option>
        </select>

        <select
          value={plantFilter}
          onChange={(e) => setPlantFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700/80 text-xs font-medium text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Plants</option>
          <option value="CHK1">Chakan (CHK1)</option>
          <option value="PUN1">Pune (PUN1)</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700/80 text-xs font-medium text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Review Statuses</option>
          <option value="Pending Review">Pending Review</option>
          <option value="Approved">Approved</option>
          <option value="Overridden">Overridden</option>
        </select>
      </div>

      {/* Requirements Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading procurement requirements...</div>
        ) : requirements.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            No requirements match current filter. Raise PRs via Chat Intake or upload a batch CSV.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {requirements.map((req) => {
              const isExpanded = expandedId === req.req_id;
              const isOverridden = req.status === 'Overridden' || req.override?.is_overridden;

              return (
                <div key={req.req_id} className="transition-colors hover:bg-slate-800/30">
                  {/* Summary Row */}
                  <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : req.req_id)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-indigo-400 text-sm">{req.req_id}</span>
                          <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${routeBadges[req.system_route] || 'bg-slate-800 text-slate-300'}`}>
                            {req.system_route}
                          </span>
                          {isOverridden && (
                            <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/30">
                              OVERRIDDEN
                            </span>
                          )}
                          {req.is_emergency && (
                            <span className="px-1.5 py-0.5 rounded font-extrabold text-[9px] bg-rose-600 text-white uppercase tracking-wider">
                              EMERGENCY
                            </span>
                          )}
                          {req.is_capex && (
                            <span className="px-1.5 py-0.5 rounded font-extrabold text-[9px] bg-purple-600 text-white uppercase tracking-wider">
                              CAPEX
                            </span>
                          )}
                        </div>
                        <div className="font-medium text-slate-200 text-xs mt-1">
                          {req.item_name || req.item_code}
                          <span className="text-slate-500 font-mono ml-1.5 text-[11px]">({req.item_code})</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-6 text-slate-300 text-xs">
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase font-semibold">Plant</span>
                        <span className="font-semibold text-white">{req.plant}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase font-semibold">Total Qty</span>
                        <span className="font-semibold text-white">{req.total_quantity}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase font-semibold">Total Value</span>
                        <span className="font-bold text-white">₹{req.total_value_inr?.toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase font-semibold">Assigned / Lead</span>
                        <span className="font-medium text-indigo-300">
                          {req.system_supplier_name || req.system_supplier_id || 'Competitive'}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2">
                      {req.status !== 'Approved' ? (
                        <button
                          onClick={() => handleApprove(req.req_id)}
                          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-sm shadow-emerald-600/20"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                      ) : (
                        <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-semibold text-xs flex items-center space-x-1">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Approved ({req.po_number || 'Dispatched'})</span>
                        </span>
                      )}

                      <button
                        onClick={() => handleOpenOverride(req)}
                        className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 font-semibold text-xs transition-colors"
                      >
                        <Edit3 className="w-3 h-3 text-slate-400" />
                        <span>Override</span>
                      </button>
                    </div>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <div className="bg-slate-950/70 border-t border-slate-800/80 p-5 space-y-4 text-xs">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Policy Clause Citation */}
                        <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 space-y-2">
                          <span className="font-semibold text-white block flex items-center space-x-1.5">
                            <ShieldAlert className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Applicable Policy Citation</span>
                          </span>
                          <p className="text-slate-300 leading-relaxed font-mono text-[11px] bg-slate-950 p-2.5 rounded border border-slate-800">
                            {req.system_clause}
                          </p>
                          <div className="flex justify-between text-slate-400 text-[10px] pt-1 border-t border-slate-800">
                            <span>Valuation Method: <strong>{req.valuation_method}</strong></span>
                            <span>Rate: ₹{req.estimated_unit_price}/unit</span>
                          </div>
                        </div>

                        {/* Clubbed PR Lines */}
                        <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 space-y-2">
                          <span className="font-semibold text-white block">
                            Clubbed PR Lines ({req.lines?.length || 1})
                          </span>
                          <div className="space-y-1.5 max-h-36 overflow-y-auto">
                            {(req.lines || []).map((line, lIdx) => (
                              <div key={lIdx} className="p-2 bg-slate-950 rounded border border-slate-800 flex justify-between items-center text-[11px]">
                                <div>
                                  <span className="font-mono font-bold text-indigo-400">{line.pr_id}</span>
                                  <span className="text-slate-400 ml-1.5">Qty: {line.quantity}</span>
                                </div>
                                <span className="text-slate-500 text-[10px]">
                                  Need: {new Date(line.need_by_date).toISOString().slice(0, 10)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Sourcing Suggestions */}
                        <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 space-y-2">
                          <span className="font-semibold text-white block">Sourcing Vendor Recommendations</span>
                          {req.suggested_suppliers?.length > 0 ? (
                            <div className="space-y-1.5">
                              {req.suggested_suppliers.map((s, sIdx) => (
                                <div key={sIdx} className="p-2 bg-slate-950 rounded border border-slate-800 flex justify-between items-center text-[11px]">
                                  <div>
                                    <strong className="text-white">{s.name}</strong>
                                    <span className="font-mono text-slate-500 ml-1">({s.supplier_id})</span>
                                  </div>
                                  <span className="text-indigo-400 text-[10px] font-mono">
                                    {s.score ? `Score: ${s.score}` : ''}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-slate-500 italic">No historical suppliers found.</p>
                          )}
                        </div>
                      </div>

                      {/* Override History if available */}
                      {isOverridden && (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 flex items-start space-x-2 text-amber-300">
                          <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <strong className="block font-semibold">Audit Record: Buyer Override Justification</strong>
                            <p className="mt-0.5 text-xs text-amber-200">
                              "{req.override?.comment}" — <em>{req.override?.overridden_by} at {new Date(req.override?.overridden_at).toLocaleString()}</em>
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Override Modal */}
      {overrideTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-sm">Override Autonomous Policy Route</h3>
              <button onClick={() => setOverrideTarget(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
              <div>Requirement: <strong className="text-indigo-400 font-mono">{overrideTarget.req_id}</strong> ({overrideTarget.item_name})</div>
              <div>Autonomous Policy Route: <strong className="text-white">{overrideTarget.system_route}</strong></div>
            </div>

            <form onSubmit={handleSaveOverride} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Target Route</label>
                <select
                  value={newRoute}
                  onChange={(e) => setNewRoute(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="CONTRACT_PO">CONTRACT_PO</option>
                  <option value="SPOT_PO">SPOT_PO</option>
                  <option value="RFQ">RFQ</option>
                  <option value="RFP">RFP</option>
                  <option value="EMERGENCY_PO">EMERGENCY_PO</option>
                  <option value="NEW_ITEM_SOURCING">NEW_ITEM_SOURCING</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-300 block mb-1">Target Supplier ID (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. S001, S024"
                  value={newSupplier}
                  onChange={(e) => setNewSupplier(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-300 block mb-1">
                  Mandatory Written Justification <span className="text-rose-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={overrideComment}
                  onChange={(e) => setOverrideComment(e.target.value)}
                  placeholder="Explain why the automated policy route is being bypassed (required for compliance audit)..."
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {overrideError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{overrideError}</span>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setOverrideTarget(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={overrideSubmitting || !overrideComment.trim()}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold disabled:opacity-40 shadow-md shadow-indigo-600/30"
                >
                  {overrideSubmitting ? 'Logging Override...' : 'Confirm & Log Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
