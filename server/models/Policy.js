const mongoose = require('mongoose');

const policySchema = new mongoose.Schema({
  version: { type: String, required: true, unique: true, index: true },
  title: { type: String, default: 'Corvo Engineering Procurement Policy' },
  effective_date: { type: Date, required: true },
  active: { type: Boolean, default: false, index: true },
  clauses: {
    clubbing_window_days_creation: { type: Number, default: 14 },
    clubbing_window_days_need_by: { type: Number, default: 7 },
    spot_threshold_inr: { type: Number, default: 200000 },
    rfq_min_threshold_inr: { type: Number, default: 200000 },
    rfq_max_threshold_inr: { type: Number, default: 1000000 },
    rfq_min_quotes: { type: Number, default: 3 },
    rfp_min_threshold_inr: { type: Number, default: 1000000 },
    rfp_min_quotes: { type: Number, default: 4 },
    emergency_threshold_inr: { type: Number, default: 500000 },
    capex_requires_sourcing: { type: Boolean, default: true },
    po_consolidation_window_hours: { type: Number, default: 24 }
  },
  amendment_text: { type: String, default: '' },
  change_summary: { type: String, default: 'Initial policy version' }
}, { timestamps: true });

module.exports = mongoose.model('Policy', policySchema);
