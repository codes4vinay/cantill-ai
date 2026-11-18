import React, { useState, useEffect } from 'react';
import {
  Truck, FileText, Download, Upload, CheckCircle2, AlertCircle,
  Calendar, Search, ShieldCheck, RefreshCw, BarChart2, Award
} from 'lucide-react';
import { getPreferredSuppliers, getPreferredExportUrl, getContracts, uploadContractPDF } from '../services/api';

export default function SuppliersContracts() {
  const [subTab, setSubTab] = useState('preferred'); // 'preferred' or 'contracts'

  // Preferred Suppliers State
  const [asOfDate, setAsOfDate] = useState('2026-11-15');
  const [preferredItems, setPreferredItems] = useState([]);
  const [prefLoading, setPrefLoading] = useState(false);
  const [searchItem, setSearchItem] = useState('');

  // Contracts State
  const [contracts, setContracts] = useState([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [pdfFile, setPdfFile] = useState(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');

  const fetchPreferred = async () => {
    setPrefLoading(true);
    try {
      const res = await getPreferredSuppliers(asOfDate);
      setPreferredItems(res.data.items || []);
    } catch (err) {
      console.error('Failed to load preferred suppliers:', err);
    } finally {
      setPrefLoading(false);
    }
  };

  const fetchContractsList = async () => {
    setContractsLoading(true);
    try {
      const res = await getContracts();
      setContracts(res.data.contracts || []);
    } catch (err) {
      console.error('Failed to load contracts:', err);
    } finally {
      setContractsLoading(false);
    }
  };

  useEffect(() => {
    if (subTab === 'preferred') {
      fetchPreferred();
    } else {
      fetchContractsList();
    }
  }, [subTab, asOfDate]);

  const handleUploadContract = async (e) => {
    e.preventDefault();
    if (!pdfFile) return;

    setUploadingPdf(true);
    setUploadMsg('');

    try {
      const res = await uploadContractPDF(pdfFile);
      setUploadMsg(res.data.message);
      setPdfFile(null);
      fetchContractsList();
    } catch (err) {
      alert('Error parsing contract PDF: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploadingPdf(false);
    }
  };

  const filteredPreferred = preferredItems.filter(item =>
    (item.item_code || '').toLowerCase().includes(searchItem.toLowerCase()) ||
    (item.item_name || '').toLowerCase().includes(searchItem.toLowerCase()) ||
    (item.category || '').toLowerCase().includes(searchItem.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Sub-tab Navigation */}
      <div className="flex bg-slate-900/90 p-1 rounded-xl border border-slate-800 shadow-md w-fit">
        <button
          onClick={() => setSubTab('preferred')}
          className={`flex items-center space-x-2 px-5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
            subTab === 'preferred'
              ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart2 className="w-3.5 h-3.5" />
          <span>Preferred Supplier List (Rankings)</span>
        </button>
        <button
          onClick={() => setSubTab('contracts')}
          className={`flex items-center space-x-2 px-5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
            subTab === 'contracts'
              ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Contract Register & Ceiling Tracking</span>
        </button>
      </div>

      {subTab === 'preferred' ? (
        /* Preferred Supplier List View */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 p-3 sm:p-4 rounded-2xl border border-slate-800 backdrop-blur-md">
            <div className="flex items-center space-x-2.5 sm:space-x-3 flex-wrap gap-y-1">
              <Calendar className="w-4 h-4 text-slate-400" />
              <label className="text-xs font-semibold text-slate-300">As-Of Date:</label>
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:space-x-3">
              <input
                type="text"
                placeholder="Filter by item or category..."
                value={searchItem}
                onChange={(e) => setSearchItem(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 w-full sm:w-56 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <a
                href={getPreferredExportUrl(asOfDate)}
                download
                className="flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-semibold text-xs hover:from-indigo-500 hover:to-indigo-400 shadow-md shadow-indigo-600/20 transition-all text-center"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Preferred CSV</span>
              </a>
            </div>
          </div>

          {/* Preferred Suppliers Table */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl overflow-hidden text-xs backdrop-blur-md">
            {prefLoading ? (
              <div className="p-12 text-center text-slate-500">Computing preferred supplier rankings...</div>
            ) : filteredPreferred.length === 0 ? (
              <div className="p-12 text-center text-slate-500">No items match search.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="p-3.5">Item Code</th>
                      <th className="p-3.5">Item Description</th>
                      <th className="p-3.5">Category</th>
                      <th className="p-3.5">Rank 1 Supplier</th>
                      <th className="p-3.5">Rank 2 Supplier</th>
                      <th className="p-3.5">Rank 3 Supplier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-[11px]">
                    {filteredPreferred.map((item, i) => (
                      <tr key={i} className="hover:bg-slate-800/30">
                        <td className="p-3.5 font-mono font-bold text-indigo-400">{item.item_code}</td>
                        <td className="p-3.5 font-medium text-white">{item.item_name}</td>
                        <td className="p-3.5 text-slate-400">{item.category}</td>
                        {[0, 1, 2].map((idx) => {
                          const s = item.top_suppliers[idx];
                          const medalColors = [
                            'bg-amber-500/20 text-amber-300 border-amber-500/40',
                            'bg-slate-500/20 text-slate-300 border-slate-500/40',
                            'bg-orange-500/20 text-orange-300 border-orange-500/40'
                          ];

                          return (
                            <td key={idx} className="p-3.5">
                              {s ? (
                                <div className="space-y-1">
                                  <div className="flex items-center space-x-1.5">
                                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold border ${medalColors[idx]}`}>
                                      {idx + 1}
                                    </span>
                                    <strong className="text-slate-200">{s.supplier_name}</strong>
                                    <span className="text-slate-500 font-mono text-[10px]">({s.supplier_id})</span>
                                  </div>
                                  <div className="text-[10px] text-slate-400 flex items-center space-x-2">
                                    <span>Score: <strong className="text-indigo-400 font-mono">{s.score}</strong></span>
                                    <span>•</span>
                                    <span>Ref: ₹{s.reference_price}</span>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-600">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Contract Register & PDF Ingestion View */
        <div className="space-y-6">
          {/* Upload Contract PDF Box */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md">
            <h3 className="font-bold text-white text-sm mb-1.5 flex items-center space-x-2">
              <Upload className="w-4 h-4 text-indigo-400" />
              <span>Ingest Negotiated Rate Contract PDF</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Upload newly negotiated rate contracts (e.g. <code>RC-2026-031.pdf</code> or <code>RC-2026-033.pdf</code>).
              The parser automatically extracts contract ceiling, validity dates, item lines, and negotiated rates.
            </p>

            <form onSubmit={handleUploadContract} className="flex flex-col sm:flex-row gap-3 items-center">
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setPdfFile(e.target.files[0])}
                className="block w-full text-xs text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 border border-slate-700 rounded-xl p-1 bg-slate-950"
              />
              <button
                type="submit"
                disabled={!pdfFile || uploadingPdf}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-semibold text-xs hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-40 whitespace-nowrap shadow-md shadow-indigo-600/20"
              >
                {uploadingPdf ? 'Parsing Contract PDF...' : 'Upload & Ingest Contract'}
              </button>
            </form>

            {uploadMsg && (
              <div className="mt-3.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{uploadMsg}</span>
              </div>
            )}
          </div>

          {/* Live Contracts Register */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {contracts.map((c, i) => {
              const util = c.utilization_pct || 0;
              let utilColor = 'bg-emerald-400';
              if (util > 75) utilColor = 'bg-amber-400';
              if (util >= 95) utilColor = 'bg-rose-400';

              return (
                <div key={i} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3.5 backdrop-blur-md">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-white text-sm">{c.contract_id}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                          {c.supplier_id}
                        </span>
                      </div>
                      <p className="text-slate-400 text-[11px] mt-1">
                        Valid: {new Date(c.effective_date).toLocaleDateString()} to {new Date(c.expiry_date).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-[9px] uppercase font-semibold text-slate-500 block">Overall Ceiling</span>
                      <strong className="text-white text-xs">₹{c.overall_ceiling?.toLocaleString('en-IN')}</strong>
                    </div>
                  </div>

                  {/* Ceiling Utilization Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Consumed: ₹{c.consumed_value?.toLocaleString('en-IN')}</span>
                      <span className="font-semibold text-white">{util}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                      <div className={`h-full ${utilColor} transition-all duration-300`} style={{ width: `${Math.min(100, util)}%` }} />
                    </div>
                    <div className="text-[10px] text-slate-500 text-right">
                      Remaining Headroom: ₹{c.remaining_ceiling?.toLocaleString('en-IN')}
                    </div>
                  </div>

                  {/* Contract Lines Table */}
                  <div className="pt-2.5 border-t border-slate-800">
                    <span className="text-[10px] uppercase font-semibold text-slate-500 block mb-1.5">Contract Negotiated Lines</span>
                    <div className="space-y-1">
                      {(c.lines || []).map((l, lIdx) => (
                        <div key={lIdx} className="flex justify-between p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 text-[11px]">
                          <span className="font-mono font-medium text-slate-300">{l.item_code}</span>
                          <span className="font-semibold text-white">₹{l.contract_price}/unit</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
