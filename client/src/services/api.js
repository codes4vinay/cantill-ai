import axios from 'axios';

let rawBase = import.meta.env.VITE_API_URL || '/api';
if (rawBase.endsWith('/')) rawBase = rawBase.slice(0, -1);
if (!rawBase.endsWith('/api') && rawBase.startsWith('http')) {
  rawBase = `${rawBase}/api`;
}
const API_BASE = rawBase;

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const getHealth = () => api.get('/health');

// Chat Intake
export const sendChatMessage = (message, sessionState) =>
  api.post('/chat', { message, session_state: sessionState });

// Batch Processing
export const processBatchUpload = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/process-batch', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

export const exportBatchCSV = () => `${API_BASE}/buyer/export-csv`;

// Buyer Workspace
export const getRequirements = (params) => api.get('/buyer/requirements', { params });
export const approveRequirement = (id, buyerName = 'Senior Buyer') =>
  api.post(`/buyer/approve/${id}`, { buyer_name: buyerName });
export const overrideRequirement = (id, payload) =>
  api.post(`/buyer/override/${id}`, payload);

// Policy Management
export const getPolicy = () => api.get('/policy');
export const previewPolicyDiff = (payload) => api.post('/policy/preview-diff', payload);
export const activatePolicy = (payload) => api.post('/policy/activate', payload);

// Suppliers & Preferred List
export const getPreferredSuppliers = (asOfDate) =>
  api.get('/suppliers/preferred', { params: { as_of_date: asOfDate } });
export const getPreferredExportUrl = (asOfDate) =>
  `${API_BASE}/suppliers/preferred/export-csv?as_of_date=${asOfDate || '2026-11-15'}`;

// Contracts
export const getContracts = () => api.get('/contracts');
export const uploadContractPDF = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/contracts/upload-pdf', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

export default api;

