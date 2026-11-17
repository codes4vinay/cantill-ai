/**
 * PDF Contract Parser
 * Extracts structured contract metadata and line items from contract PDFs
 */

const pdfParse = require('pdf-parse');

function cleanNumber(str) {
  if (!str) return 0;
  return Number(String(str).replace(/[^0-9.]/g, '')) || 0;
}

function parseContractDate(dateStr) {
  if (!dateStr) return null;
  const cleaned = dateStr.trim();
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) return d;

  // Try formats like 15-Nov-2026 or 15/11/2026
  const parts = cleaned.split(/[-/\s]+/);
  if (parts.length === 3) {
    const monthNames = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };
    const day = parseInt(parts[0], 10);
    const mStr = parts[1].toLowerCase().slice(0, 3);
    const month = monthNames[mStr] !== undefined ? monthNames[mStr] : parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    return new Date(Date.UTC(year, month, day));
  }
  return new Date();
}

/**
 * Extract contract data from a PDF buffer or text
 * @param {Buffer|string} input - PDF buffer or raw text string
 */
async function parseContractPDF(input) {
  let text = '';
  if (Buffer.isBuffer(input)) {
    const data = await pdfParse(input);
    text = data.text;
  } else if (typeof input === 'string') {
    text = input;
  }

  // 1. Contract ID
  const contractIdMatch = text.match(/Contract\s*(?:Ref|Number|No|ID)?[:\s#]*([A-Z]{2}-[0-9]{4}-[0-9]{3})/i)
    || text.match(/\b(RC-[0-9]{4}-[0-9]{3})\b/i);
  const contractId = contractIdMatch ? contractIdMatch[1].toUpperCase() : 'RC-UNKNOWN';

  // 2. Supplier ID & Name
  const supplierIdMatch = text.match(/Supplier\s*(?:ID|Code)?[:\s#]*([S][0-9]{3})/i)
    || text.match(/\b(S[0-9]{3})\b/);
  const supplierId = supplierIdMatch ? supplierIdMatch[1].toUpperCase() : null;

  const supplierNameMatch = text.match(/Supplier\s*(?:Name)?[:\s#]*([A-Za-z0-9\s&.,'-]+?)(?=\n|Supplier ID|Date|$)/i);
  const supplierName = supplierNameMatch ? supplierNameMatch[1].trim() : '';

  // 3. Effective & Expiry Dates
  const effMatch = text.match(/Effective\s*(?:Date)?[:\s]*([0-9]{1,2}[-/][A-Za-z0-9]+[-/][0-9]{2,4})/i)
    || text.match(/Valid\s*From[:\s]*([0-9]{1,2}[-/][A-Za-z0-9]+[-/][0-9]{2,4})/i);
  const expMatch = text.match(/Expiry\s*(?:Date)?[:\s]*([0-9]{1,2}[-/][A-Za-z0-9]+[-/][0-9]{2,4})/i)
    || text.match(/Valid\s*(?:To|Through)[:\s]*([0-9]{1,2}[-/][A-Za-z0-9]+[-/][0-9]{2,4})/i);

  const effectiveDate = effMatch ? parseContractDate(effMatch[1]) : new Date();
  const expiryDate = expMatch ? parseContractDate(expMatch[1]) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  // 4. Overall Ceiling
  const ceilingMatch = text.match(/(?:Overall|Total|Contract)\s*Ceiling[:\s]*(?:INR|Rs\.?)?\s*([0-9,]+(?:\.[0-9]{2})?)/i)
    || text.match(/Ceiling\s*Value[:\s]*(?:INR|Rs\.?)?\s*([0-9,]+(?:\.[0-9]{2})?)/i);
  const overallCeiling = ceilingMatch ? cleanNumber(ceilingMatch[1]) : 0;

  // 5. Lines table extraction
  const lines = [];
  // Pattern matching: ITM-XXXX followed by rate, MOQ, ceiling
  const lineRegex = /(ITM-[0-9]{4})[^\n\r]*?(?:INR|Rs\.?)?\s*([0-9,]+(?:\.[0-9]{2})?)/gi;
  let match;
  while ((match = lineRegex.exec(text)) !== null) {
    const itmCode = match[1].toUpperCase();
    const rate = cleanNumber(match[2]);
    if (rate > 0) {
      lines.push({
        item_code: itmCode,
        contract_price: rate,
        min_order_qty: 1,
        ceiling: overallCeiling
      });
    }
  }

  return {
    contract_id: contractId,
    supplier_id: supplierId,
    supplier_name: supplierName,
    effective_date: effectiveDate,
    expiry_date: expiryDate,
    overall_ceiling: overallCeiling,
    consumed_value: 0,
    lines,
    status: 'Active',
    raw_text: text.slice(0, 500)
  };
}

module.exports = {
  parseContractPDF,
  parseContractDate
};

