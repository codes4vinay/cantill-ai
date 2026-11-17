const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  supplier_id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  categories: [{ type: String }],
  quality_rating: { type: Number, default: 0 },
  on_time_delivery_pct: { type: Number, default: 0 },
  payment_terms: { type: String, default: 'Net 30' },
  active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Supplier', supplierSchema);

