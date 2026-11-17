/**
 * Pricing & Valuation Waterfall Service
 * Implements Policy Section 4: Valuation Waterfall (4 tiers)
 */

function parseDate(d) {
  if (!d) return new Date();
  if (d instanceof Date) return d;
  return new Date(d);
}

/**
 * Determine unit price and valuation method according to 4-tier waterfall
 * @param {string} itemCode - item code
 * @param {Date} evalDate - evaluation date
 * @param {Array} contracts - list of contract objects
 * @param {Array} poHistory - list of historical PO records
 * @param {Object} itemMaster - item record from item_master
 * @param {number} fallbackPrice - optional estimated price (e.g. for new items)
 */
function getValuation(itemCode, evalDate, contracts = [], poHistory = [], itemMaster = null, fallbackPrice = 0) {
  const evalTime = parseDate(evalDate).getTime();

  // Tier 1: Active Rate Contract Price on evaluation date
  const activeContractsWithItem = [];
  for (const c of contracts) {
    const effTime = parseDate(c.effective_date).getTime();
    const expTime = parseDate(c.expiry_date).getTime();
    if (effTime <= evalTime && evalTime <= expTime) {
      const line = (c.lines || []).find(l => l.item_code === itemCode);
      if (line && Number(line.contract_price) > 0) {
        activeContractsWithItem.push({
          contract_id: c.contract_id,
          supplier_id: c.supplier_id,
          price: Number(line.contract_price),
          min_order_qty: line.min_order_qty || 1,
          contract: c
        });
      }
    }
  }

  if (activeContractsWithItem.length > 0) {
    // Pick the lowest rate contract
    activeContractsWithItem.sort((a, b) => a.price - b.price);
    const best = activeContractsWithItem[0];
    return {
      unit_price: best.price,
      valuation_method: 'CONTRACT',
      contract_id: best.contract_id,
      supplier_id: best.supplier_id,
      available_contracts: activeContractsWithItem
    };
  }

  // Tier 2: Last Purchase Order price within last 12 months (365 days)
  const ms365 = 365 * 24 * 60 * 60 * 1000;
  const recentPOs365 = (poHistory || [])
    .filter(po => po.item_code === itemCode)
    .filter(po => {
      const poTime = parseDate(po.po_date).getTime();
      return poTime <= evalTime && (evalTime - poTime) <= ms365;
    })
    .sort((a, b) => parseDate(b.po_date).getTime() - parseDate(a.po_date).getTime());

  if (recentPOs365.length > 0) {
    return {
      unit_price: Number(recentPOs365[0].unit_price),
      valuation_method: 'LAST_PO',
      contract_id: null,
      supplier_id: recentPOs365[0].supplier_id
    };
  }

  // Tier 3: Volume-Weighted Average PO price within last 18 months (548 days)
  const ms548 = 548 * 24 * 60 * 60 * 1000;
  const recentPOs548 = (poHistory || [])
    .filter(po => po.item_code === itemCode)
    .filter(po => {
      const poTime = parseDate(po.po_date).getTime();
      return poTime <= evalTime && (evalTime - poTime) <= ms548;
    });

  if (recentPOs548.length > 0) {
    let totalSpend = 0;
    let totalQty = 0;
    for (const po of recentPOs548) {
      const q = Number(po.quantity) || 0;
      const p = Number(po.unit_price) || 0;
      totalSpend += q * p;
      totalQty += q;
    }
    if (totalQty > 0) {
      const vwap = Math.round((totalSpend / totalQty) * 100) / 100;
      return {
        unit_price: vwap,
        valuation_method: 'WEIGHTED_PO',
        contract_id: null,
        supplier_id: null
      };
    }
  }

  // Tier 4: Engineering Master catalog price / fallback estimated price
  if (itemMaster && Number(itemMaster.catalog_price) > 0) {
    return {
      unit_price: Number(itemMaster.catalog_price),
      valuation_method: 'CATALOG_EST',
      contract_id: null,
      supplier_id: null
    };
  }

  return {
    unit_price: Number(fallbackPrice) || 0,
    valuation_method: 'FALLBACK_EST',
    contract_id: null,
    supplier_id: null
  };
}

module.exports = {
  getValuation
};
