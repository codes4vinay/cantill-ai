const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  item_code: { type: String, required: true, unique: true, index: true },
  item_name: { type: String, required: true, index: true },
  category: { type: String, required: true, index: true },
  uom: { type: String, default: 'EA' },
  catalog_price: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Item', itemSchema);
