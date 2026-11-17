import React, { useState, useEffect } from 'react';
import {
  Layers, Filter, Download, CheckCircle, Edit3, ChevronDown, ChevronUp,
  AlertTriangle, ShieldAlert, Building2, Calendar, FileText, Check, X
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
      setOverrideError('Policy Violation: Overriding a system decision requires a mandatory written comment.');
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

  const routeBadges = {
    CONTRACT_PO: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    SPOT_PO: 'bg-blue-100 text-blue-800 border-blue-300',
    RFQ: 'bg-amber-100 text-amber-800 border-amber-300',
    RFP: 'bg-purple-100 text-purple-800 border-purple-300',
    EMERGENCY_PO: 'bg-rose-100 text-rose-800 border-rose-300',
    NEW_ITEM_SOURCING: 'bg-slate-200 text-slate-800 border-slate-300'
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Buyer Procurement Workspace</h2>
          <p className="text-xs text-slate-500">
            Review clubbed requirements, inspect algorithmic policy citations, approve POs, or log mandatory overrides.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <a
            href={exportBatchCSV()}
            download
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold shadow-sm transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Requirements CSV</span>
          </a>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search Req ID, Item Code, or Description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <select
          value={routeFilter}
          onChange={(e) => setRouteFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 bg-white"
        >
          <option value="">All Routes</option>
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
          className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 bg-white"
        >
          <option value="">All Plants</option>
          <option value="CHK1">Chakan (CHK1)</option>
          <option value="PUN1">Pune (PUN1)</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 bg-white"
        >
          <option value="">All Statuses</option>
          <option value="Pending Review">Pending Review</option>
          <option value="Approved">Approved</option>
          <option value="Overridden">Overridden</option>
        </select>

        <div className="text-xs text-slate-400 ml-auto font-medium">
          Showing {requirements.length} requirements
        </div>
      </div>

      {/* Requirements Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading requirements...</div>
        ) : requirements.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No requirements found. Raise PRs via Chat Intake or upload a batch CSV.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {requirements.map((req) => {
              const isExpanded = expandedId === req.req_id;
              const isOverridden = req.status === 'Overridden' || req.override?.is_overridden;

              return (
                <div key={req.req_id} className="transition-colors hover:bg-slate-50/50">
                  {/* Summary Row */}
                  <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : req.req_id)}
                        className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>

                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-indigo-700 text-sm">{req.req_id}</span>
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] border ${routeBadges[req.system_route] || 'bg-slate-100'}`}>
                            {req.system_route}
                          </span>
                          {isOverridden && (
                            <span className="px-2 py-0.5 rounded-md font-bold text-[11px] bg-amber-50 text-amber-700 border border-amber-300">
                              OVERRIDDEN
                            </span>
                          )}
                          {req.is_emergency && (
                            <span className="px-1.5 py-0.5 rounded font-extrabold text-[10px] bg-red-600 text-white uppercase tracking-wider">
                              EMERGENCY
                            </span>
                          )}
                          {req.is_capex && (
                            <span className="px-1.5 py-0.5 rounded font-extrabold text-[10px] bg-purple-600 text-white uppercase tracking-wider">
                              CAPEX
                            </span>
                          )}
                        </div>
                        <div className="font-medium text-slate-800 text-xs mt-0.5">
                          {req.item_name || req.item_code}
                          <span className="text-slate-400 font-mono ml-1">({req.item_code})</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-6 text-slate-600">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Plant</span>
                        <span className="font-semibold text-slate-800">{req.plant}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Total Qty</span>
                        <span className="font-semibold text-slate-800">{req.total_quantity}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Total Value</span>
                        <span className="font-bold text-slate-900">₹{req.total_value_inr?.toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Assigned / Lead</span>
                        <span className="font-medium text-slate-800">
                          {req.system_supplier_name || req.system_supplier_id || 'Competitive'}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2">
                      {req.status !== 'Approved' ? (
                        <button
                          onClick={() => handleApprove(req.req_id)}
                          className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-medium transition-all shadow-2xs"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold flex items-center space-x-1">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Approved ({req.po_number || 'Dispatched'})</span>
                        </span>
                      )}

                      <button
                        onClick={() => handleOpenOverride(req)}
                        className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium transition-colors"
                      >
                        <Edit3 className="w-3 h-3 text-slate-500" />
                        <span>Override</span>
                      </button>
                    </div>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <div className="bg-slate-50 border-t border-slate-200 p-5 space-y-4 text-xs">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Policy Clause Citation */}
                        <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1">
                          <span className="font-semibold text-slate-700 block">Applicable Policy Clause</span>
                          <p className="text-slate-600 leading-relaxed font-mono text-[11px] bg-slate-50 p-2 rounded border border-slate-100">
                            {req.system_clause}
                          </p>
                          <div className="flex justify-between text-slate-500 text-[10px] pt-1">
                            <span>Valuation: {req.valuation_method}</span>
                            <span>Est Rate: ₹{req.estimated_unit_price}/unit</span>
                          </div>
                        </div>

                        {/* Clubbed PR Lines */}
                        <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                          <span className="font-semibold text-slate-700 block">
                            Clubbed PR Lines ({req.lines?.length || 1})
                          </span>
                          <div className="space-y-1.5 max-h-36 overflow-y-auto">
                            {(req.lines || []).map((line, lIdx) => (
                              <div key={lIdx} className="p-2 bg-slate-50 rounded border border-slate-100 flex justify-between items-center text-[11px]">
                                <div>
                                  <span className="font-mono font-bold text-indigo-600">{line.pr_id}</span>
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
                        <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                          <span className="font-semibold text-slate-700 block">Suggested Sourcing Suppliers</span>
                          {req.suggested_suppliers?.length > 0 ? (
                            <div className="space-y-1.5">
                              {req.suggested_suppliers.map((s, sIdx) => (
                                <div key={sIdx} className="p-2 bg-slate-50 rounded border border-slate-100 flex justify-between items-center text-[11px]">
                                  <div>
                                    <strong className="text-slate-800">{s.name}</strong>
                                    <span className="font-mono text-slate-400 ml-1">({s.supplier_id})</span>
                                  </div>
                                  <span className="text-slate-500 text-[10px]">
                                    {s.score ? `Score: ${s.score}` : ''}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-slate-400 italic">No historical suppliers found.</p>
                          )}
                        </div>
                      </div>

                      {/* Override History if available */}
                      {isOverridden && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start space-x-2 text-amber-900">
                          <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <strong className="block font-semibold">Audit Record: Buyer Override Justification</strong>
                            <p className="mt-0.5 text-xs text-amber-800">
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
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">Override Procurement Decision</h3>
              <button onClick={() => setOverrideTarget(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
              <div>Requirement: <strong className="text-indigo-600 font-mono">{overrideTarget.req_id}</strong> ({overrideTarget.item_name})</div>
              <div>Current Decision: <strong>{overrideTarget.system_route}</strong></div>
            </div>

            <form onSubmit={handleSaveOverride} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Target Route</label>
                <select
                  value={newRoute}
                  onChange={(e) => setNewRoute(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
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
                <label className="font-semibold text-slate-700 block mb-1">Target Supplier ID (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. S001, S024"
                  value={newSupplier}
                  onChange={(e) => setNewSupplier(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Mandatory Written Justification <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={overrideComment}
                  onChange={(e) => setOverrideComment(e.target.value)}
                  placeholder="Explain why the automated policy route is being bypassed (required for audit compliance)..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {overrideError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{overrideError}</span>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOverrideTarget(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={overrideSubmitting || !overrideComment.trim()}
                  className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {overrideSubmitting ? 'Saving...' : 'Confirm & Save Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
