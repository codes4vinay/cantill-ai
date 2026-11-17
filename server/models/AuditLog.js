const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now, index: true },
  action: { type: String, required: true },
  entity_type: { type: String, default: 'Requirement' },
  entity_id: { type: String, index: true },
  actor: { type: String, default: 'System' },
  details: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

module.exports = mongoose.model('AuditLog', auditLogSchema);
