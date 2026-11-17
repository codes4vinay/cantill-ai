const mongoose = require('mongoose');

const requirementSchema = new mongoose.Schema({
  req_id: { type: String, required: true, unique: true, index: true },
  batch_id: { type: String, index: true, default: 'default' },
  item_code: { type: String, required: true, index: true },
  item_name: { type: String, default: '' },
  plant: { type: String, required: true, index: true },
  total_quantity: { type: Number, required: true },
  need_by_date: { type: Date, required: true },
  earliest_creation_date: { type: Date, required: true },
  lines: [{
    pr_id: { type: String, required: true },
    line_number: { type: Number, default: 1 },
    quantity: { type: Number, required: true },
    need_by_date: { type: Date, required: true },
    creation_date: { type: Date, required: true },
    urgency: { type: String, default: 'Standard' },
    is_capex: { type: Boolean, default: false },
    raw_description: { type: String, default: '' },
    requester: { type: String, default: 'Employee' }
  }],
  estimated_unit_price: { type: Number, required: true },
  valuation_method: { type: String, default: 'CATALOG_EST' },
  total_value_inr: { type: Number, required: true },
  is_emergency: { type: Boolean, default: false },
  is_capex: { type: Boolean, default: false },
  is_new_item: { type: Boolean, default: false },
  contract_id: { type: String, default: null },
  system_route: { type: String, required: true },
  system_clause: { type: String, required: true },
  system_supplier_id: { type: String, default: null },
  system_supplier_name: { type: String, default: null },
  suggested_suppliers: [{
    supplier_id: String,
    name: String,
    score: Number,
    reason: String
  }],
  status: {
    type: String,
    enum: ['Pending Review', 'Approved', 'Overridden', 'PO Created', 'RFQ Dispatched'],
    default: 'Pending Review'
  },
  override: {
    is_overridden: { type: Boolean, default: false },
    original_route: String,
    chosen_route: String,
    chosen_supplier_id: String,
    comment: String,
    overridden_by: String,
    overridden_at: Date
  },
  po_number: { type: String, default: null },
  created_at: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Requirement', requirementSchema);
