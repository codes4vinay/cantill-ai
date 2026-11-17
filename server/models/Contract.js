const mongoose = require('mongoose');

const contractLineSchema = new mongoose.Schema({
  item_code: { type: String, required: true },
  contract_price: { type: Number, required: true },
  min_order_qty: { type: Number, default: 1 },
  ceiling: { type: Number, default: 0 }
}, { _id: false });

const contractSchema = new mongoose.Schema({
  contract_id: { type: String, required: true, unique: true, index: true },
  supplier_id: { type: String, required: true, index: true },
  effective_date: { type: Date, required: true },
  expiry_date: { type: Date, required: true },
  overall_ceiling: { type: Number, required: true },
  consumed_value: { type: Number, default: 0 },
  lines: [contractLineSchema],
  status: { type: String, enum: ['Active', 'Expired', 'Draft'], default: 'Active' },
  source_file: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Contract', contractSchema);

