/**
 * Supplier Ranking & Sourcing Recommendations Service
 * Implements Policy Section 3 & Worked Examples Page 5
 */

function parseDate(d) {
  if (!d) return new Date();
  if (d instanceof Date) return d;
  return new Date(d);
}

/**
 * Score and rank suppliers for a specific item
 * @param {string} itemCode
 * @param {Date} evalDate
 * @param {Array} suppliers - master suppliers
 * @param {Array} poHistory - historical POs
 * @param {Array} contracts - active contracts
 */
function rankSuppliersForItem(itemCode, evalDate, suppliers = [], poHistory = [], contracts = []) {
  const evalTime = parseDate(evalDate).getTime();
  const ms180 = 180 * 24 * 60 * 60 * 1000;
  const ms365 = 365 * 24 * 60 * 60 * 1000;
  const ms548 = 548 * 24 * 60 * 60 * 1000;

  // Find all suppliers who have delivered this item historically
  const itemPOs = (poHistory || []).filter(po => {
    return po.item_code === itemCode && parseDate(po.po_date).getTime() <= evalTime;
  });

  const supplierStats = {};

  for (const po of itemPOs) {
    const sId = po.supplier_id;
    const poTime = parseDate(po.po_date).getTime();
    const ageMs = evalTime - poTime;

    if (!supplierStats[sId]) {
      supplierStats[sId] = {
        po_count_548: 0,
        most_recent_time: 0,
        prices: []
      };
    }

    if (ageMs <= ms548) {
      supplierStats[sId].po_count_548++;
    }
    if (poTime > supplierStats[sId].most_recent_time) {
      supplierStats[sId].most_recent_time = poTime;
    }
    supplierStats[sId].prices.push({
      time: poTime,
      price: Number(po.unit_price)
    });
  }

  // Also include suppliers with active contracts for this item
  for (const c of contracts) {
    const eff = parseDate(c.effective_date).getTime();
    const exp = parseDate(c.expiry_date).getTime();
    if (eff <= evalTime && evalTime <= exp) {
      const line = (c.lines || []).find(l => l.item_code === itemCode);
      if (line) {
        if (!supplierStats[c.supplier_id]) {
          supplierStats[c.supplier_id] = {
            po_count_548: 0,
            most_recent_time: 0,
            prices: []
          };
        }
      }
    }
  }

  const rankedList = [];

  for (const [sId, stats] of Object.entries(supplierStats)) {
    const master = suppliers.find(s => s.supplier_id === sId);
    if (!master) continue;

    // Recency factor
    let recency = 0;
    if (stats.most_recent_time > 0) {
      const age = evalTime - stats.most_recent_time;
      if (age <= ms180) recency = 1.0;
      else if (age <= ms365) recency = 0.5;
    }

    // Contract held factor
    let hasContract = 0;
    let contractRate = null;
    for (const c of contracts) {
      const eff = parseDate(c.effective_date).getTime();
      const exp = parseDate(c.expiry_date).getTime();
      if (c.supplier_id === sId && eff <= evalTime && evalTime <= exp) {
        const line = (c.lines || []).find(l => l.item_code === itemCode);
        if (line) {
          hasContract = 1.0;
          contractRate = Number(line.contract_price);
          break;
        }
      }
    }

    const onTime = Number(master.on_time_delivery_pct) || 0;
    const quality = Number(master.quality_rating) || 0;
    const poCount = stats.po_count_548;

    // Formula: (POs * 2) + (Recency * 30) + (Contract * 15) + (OnTime * 0.3) + (Quality * 4.0)
    const score = Number(((poCount * 2) + (recency * 30) + (hasContract * 15) + (onTime * 0.3) + (quality * 4.0)).toFixed(2));

    // Reference price (contract rate or last PO price)
    let refPrice = contractRate;
    if (refPrice === null && stats.prices.length > 0) {
      stats.prices.sort((a, b) => b.time - a.time);
      refPrice = stats.prices[0].price;
    }

    rankedList.push({
      supplier_id: sId,
      name: master.name,
      score,
      po_count: poCount,
      recency,
      has_contract: hasContract === 1.0,
      on_time_pct: onTime,
      quality_rating: quality,
      reference_price: refPrice || 0,
      categories: master.categories || []
    });
  }

  // Sort descending by score, tiebreak by supplier_id ascending
  rankedList.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.supplier_id.localeCompare(b.supplier_id);
  });

  return rankedList;
}

/**
 * Top up sourcing list with qualified suppliers from category
 * @param {string} category
 * @param {Array} currentSuppliers
 * @param {Array} allSuppliers
 * @param {number} targetCount
 */
function topUpCategorySuppliers(category, currentSuppliers = [], allSuppliers = [], targetCount = 3) {
  const currentIds = new Set(currentSuppliers.map(s => s.supplier_id));
  const categoryCandidates = [];

  for (const s of allSuppliers) {
    if (currentIds.has(s.supplier_id)) continue;
    const sCats = s.categories || [];
    if (sCats.some(c => c.toLowerCase() === (category || '').toLowerCase())) {
      const q = Number(s.quality_rating) || 0;
      const ot = Number(s.on_time_delivery_pct) || 0;
      const catScore = Number(((q * 20) + ot).toFixed(2));
      categoryCandidates.push({
        supplier_id: s.supplier_id,
        name: s.name,
        score: catScore,
        category_score: catScore,
        quality_rating: q,
        on_time_pct: ot,
        reason: `Qualified category supplier for ${category} (Rating: ${q}/5, OTD: ${ot}%)`
      });
    }
  }

  categoryCandidates.sort((a, b) => {
    if (b.category_score !== a.category_score) return b.category_score - a.category_score;
    return a.supplier_id.localeCompare(b.supplier_id);
  });

  const combined = [...currentSuppliers];
  for (const cand of categoryCandidates) {
    if (combined.length >= targetCount) break;
    combined.push({
      supplier_id: cand.supplier_id,
      name: cand.name,
      score: cand.score,
      reason: cand.reason
    });
  }

  return combined;
}

module.exports = {
  rankSuppliersForItem,
  topUpCategorySuppliers
};

