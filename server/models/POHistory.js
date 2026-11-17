const mongoose = require('mongoose');

const poHistorySchema = new mongoose.Schema({
  po_number: { type: String, required: true, index: true },
  po_date: { type: Date, required: true, index: true },
  supplier_id: { type: String, required: true, index: true },
  item_code: { type: String, required: true, index: true },
  plant: { type: String, required: true },
  quantity: { type: Number, required: true },
  unit_price: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  on_time_delivery: { type: Boolean, default: true },
  quality_accepted: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('POHistory', poHistorySchema);

