import React, { useState, useEffect } from 'react';
import {
  Truck, FileText, Download, Upload, CheckCircle2, AlertCircle,
  Calendar, Search, ShieldCheck, RefreshCw, BarChart2
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
      <div className="flex bg-slate-200 p-1 rounded-xl w-fit">
        <button
          onClick={() => setSubTab('preferred')}
          className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
            subTab === 'preferred' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          <span>Preferred Supplier List (Rankings)</span>
        </button>
        <button
          onClick={() => setSubTab('contracts')}
          className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
            subTab === 'contracts' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Contract Register & Ceiling Tracking</span>
        </button>
      </div>

      {subTab === 'preferred' ? (
        /* Preferred Supplier List View */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200">
            <div className="flex items-center space-x-3">
              <Calendar className="w-4 h-4 text-slate-500" />
              <label className="text-xs font-semibold text-slate-700">Evaluation As-Of Date:</label>
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-slate-50 font-medium"
              />
            </div>

            <div className="flex items-center space-x-3">
              <input
                type="text"
                placeholder="Filter by item or category..."
                value={searchItem}
                onChange={(e) => setSearchItem(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs w-56"
              />
              <a
                href={getPreferredExportUrl(asOfDate)}
                download
                className="flex items-center space-x-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Preferred CSV</span>
              </a>
            </div>
          </div>

          {/* Preferred Suppliers Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden text-xs">
            {prefLoading ? (
              <div className="p-12 text-center text-slate-400">Computing preferred rankings...</div>
            ) : filteredPreferred.length === 0 ? (
              <div className="p-12 text-center text-slate-400">No items match search.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-700 font-semibold uppercase text-[11px]">
                    <tr>
                      <th className="p-3.5">Item Code</th>
                      <th className="p-3.5">Item Description</th>
                      <th className="p-3.5">Category</th>
                      <th className="p-3.5">Rank 1 Supplier</th>
                      <th className="p-3.5">Rank 2 Supplier</th>
                      <th className="p-3.5">Rank 3 Supplier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPreferred.map((item, i) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="p-3.5 font-mono font-bold text-indigo-700">{item.item_code}</td>
                        <td className="p-3.5 font-medium text-slate-900">{item.item_name}</td>
                        <td className="p-3.5 text-slate-500">{item.category}</td>
                        {[0, 1, 2].map((idx) => {
                          const s = item.top_suppliers[idx];
                          return (
                            <td key={idx} className="p-3.5">
                              {s ? (
                                <div className="space-y-0.5">
                                  <div className="flex items-center space-x-1">
                                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                      idx === 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                                    }`}>
                                      {idx + 1}
                                    </span>
                                    <strong className="text-slate-800">{s.supplier_name}</strong>
                                    <span className="text-slate-400 font-mono text-[10px]">({s.supplier_id})</span>
                                  </div>
                                  <div className="text-[10px] text-slate-500">
                                    Score: <strong>{s.score}</strong> | Ref: ₹{s.reference_price}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-300">-</span>
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
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-slate-900 text-sm mb-2 flex items-center space-x-2">
              <Upload className="w-4 h-4 text-indigo-600" />
              <span>Ingest Rate Contract PDF</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Upload newly negotiated rate contracts (e.g. <code>RC-2026-031.pdf</code> or <code>RC-2026-033.pdf</code>).
              The parser automatically extracts contract ceiling, validity dates, item lines, and negotiated rates.
            </p>

            <form onSubmit={handleUploadContract} className="flex flex-col sm:flex-row gap-3 items-center">
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setPdfFile(e.target.files[0])}
                className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 border border-slate-200 rounded-xl p-1"
              />
              <button
                type="submit"
                disabled={!pdfFile || uploadingPdf}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap shadow-sm"
              >
                {uploadingPdf ? 'Parsing Contract PDF...' : 'Upload & Ingest Contract'}
              </button>
            </form>

            {uploadMsg && (
              <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{uploadMsg}</span>
              </div>
            )}
          </div>

          {/* Live Contracts Register */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {contracts.map((c, i) => {
              const util = c.utilization_pct || 0;
              let utilColor = 'bg-emerald-500';
              if (util > 75) utilColor = 'bg-amber-500';
              if (util >= 95) utilColor = 'bg-rose-500';

              return (
                <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-slate-900 text-sm">{c.contract_id}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {c.supplier_id}
                        </span>
                      </div>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        Valid: {new Date(c.effective_date).toLocaleDateString()} to {new Date(c.expiry_date).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase font-semibold text-slate-400 block">Overall Ceiling</span>
                      <strong className="text-slate-900">₹{c.overall_ceiling?.toLocaleString('en-IN')}</strong>
                    </div>
                  </div>

                  {/* Ceiling Utilization Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Consumed: ₹{c.consumed_value?.toLocaleString('en-IN')}</span>
                      <span className="font-semibold text-slate-700">{util}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full ${utilColor} transition-all`} style={{ width: `${Math.min(100, util)}%` }} />
                    </div>
                    <div className="text-[10px] text-slate-400 text-right">
                      Remaining: ₹{c.remaining_ceiling?.toLocaleString('en-IN')}
                    </div>
                  </div>

                  {/* Contract Lines Table */}
                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Contract Lines</span>
                    <div className="space-y-1">
                      {(c.lines || []).map((l, lIdx) => (
                        <div key={lIdx} className="flex justify-between p-1.5 rounded bg-slate-50 text-[11px]">
                          <span className="font-mono font-medium text-slate-700">{l.item_code}</span>
                          <span className="font-semibold text-slate-900">₹{l.contract_price}/unit</span>
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
