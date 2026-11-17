/**
 * Item Identification & NLP Normalization Service
 * Implements Policy Clause 1.1 - 1.3
 */

const SYNONYMS = {
  'brg': 'bearing',
  'hyd': 'hydraulic',
  'pneu': 'pneumatic',
  'cyl': 'cylinder',
  'rod': 'electrode',
  'v-belt': 'belt',
  'vbelt': 'belt',
  'fltr': 'filter',
  'vlv': 'valve'
};

const STOPWORDS = new Set([
  'for', 'maintenance', 'plant', 'urgent', 'as', 'per', 'sample',
  'required', 'need', 'plz', 'please', 'nos', 'qty', 'standard', 'make'
]);

function normalizeText(text) {
  if (!text) return '';
  let str = String(text).toLowerCase().replace(/[^a-z0-9\s/x-]/g, ' ');
  const words = str.split(/\s+/).filter(Boolean);
  const mapped = words.map(w => SYNONYMS[w] || w).filter(w => !STOPWORDS.has(w));
  return mapped.join(' ');
}

function extractNumbersAndCodes(text) {
  if (!text) return [];
  const matches = String(text).match(/\b([0-9]+[a-z0-9/x-]*|[a-z]+[0-9]+)\b/gi) || [];
  return matches.map(m => m.toLowerCase().trim()).filter(m => m.length >= 2);
}

function tokenSimilarity(str1, str2) {
  const tokens1 = new Set(str1.split(/\s+/).filter(Boolean));
  const tokens2 = new Set(str2.split(/\s+/).filter(Boolean));
  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  let intersection = 0;
  for (const t of tokens1) {
    if (tokens2.has(t)) intersection++;
  }
  const union = new Set([...tokens1, ...tokens2]).size;
  return intersection / union;
}

/**
 * Match a raw requisition input to item master
 * @param {Object} input - { item_code, description }
 * @param {Array} catalogItems - list of items from DB
 */
function matchItem(input, catalogItems) {
  const rawCode = (input.item_code || '').trim();
  const rawDesc = (input.description || input.raw_description || '').trim();

  // 1. Direct code lookup if provided and valid
  if (rawCode && rawCode !== '(none)' && rawCode.toUpperCase() !== 'NONE' && rawCode !== '-') {
    const directMatch = catalogItems.find(it => it.item_code.toUpperCase() === rawCode.toUpperCase());
    if (directMatch) {
      return {
        matched: true,
        item_code: directMatch.item_code,
        item_name: directMatch.item_name,
        category: directMatch.category,
        uom: directMatch.uom || 'EA',
        confidence: 1.0,
        match_type: 'EXACT_CODE',
        is_new: false
      };
    }
  }

  // 2. Fuzzy / Spec Matching on Description
  if (!rawDesc) {
    return {
      matched: false,
      item_code: 'NEW_ITEM',
      item_name: 'Unknown Item',
      category: 'General',
      confidence: 0,
      match_type: 'UNRESOLVED',
      is_new: true
    };
  }

  const normInput = normalizeText(rawDesc);
  const inputCodes = extractNumbersAndCodes(rawDesc);

  let bestMatch = null;
  let bestScore = -1;

  for (const it of catalogItems) {
    const normMaster = normalizeText(it.item_name);
    const masterCodes = extractNumbersAndCodes(it.item_name);

    let sim = tokenSimilarity(normInput, normMaster);

    // Number/spec boost
    let matchedSpecs = 0;
    for (const c of inputCodes) {
      if (masterCodes.includes(c) || normMaster.includes(c)) {
        matchedSpecs++;
      }
    }

    if (inputCodes.length > 0 && matchedSpecs === inputCodes.length) {
      sim += 0.45;
    } else if (matchedSpecs > 0) {
      sim += 0.25 * (matchedSpecs / inputCodes.length);
    }

    if (sim > bestScore) {
      bestScore = sim;
      bestMatch = it;
    }
  }

  if (bestMatch && bestScore >= 0.55) {
    return {
      matched: true,
      item_code: bestMatch.item_code,
      item_name: bestMatch.item_name,
      category: bestMatch.category,
      uom: bestMatch.uom || 'EA',
      confidence: Math.min(1.0, Number(bestScore.toFixed(2))),
      match_type: 'DESCRIPTION_SPEC_MATCH',
      is_new: false
    };
  }

  // If score < 0.55, classify as NEW item
  return {
    matched: false,
    item_code: 'NEW_ITEM',
    item_name: rawDesc,
    category: 'Non-Catalog',
    confidence: Number(Math.max(0, bestScore).toFixed(2)),
    match_type: 'NEW_ITEM',
    is_new: true
  };
}

module.exports = {
  normalizeText,
  extractNumbersAndCodes,
  tokenSimilarity,
  matchItem
};
