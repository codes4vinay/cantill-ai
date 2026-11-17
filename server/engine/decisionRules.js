/**
 * Policy-Driven Decision Rules Engine
 * Implements Policy Section 5 (Clauses 5.1 - 5.7) as dynamic data evaluation
 */

const { getValuation } = require('./pricingService');
const { rankSuppliersForItem, topUpCategorySuppliers } = require('./rankingService');

function parseDate(d) {
  if (!d) return new Date();
  if (d instanceof Date) return d;
  return new Date(d);
}

/**
 * Evaluate a single Requirement against the active policy
 * @param {Object} requirement - requirement record
 * @param {Object} policy - active policy record
 * @param {Array} contracts - list of contract records
 * @param {Array} poHistory - list of historical POs
 * @param {Array} suppliers - master suppliers
 * @param {Array} items - master items
 * @param {Map} consumedCeilings - in-memory tracking of consumed contract values
 */
function evaluateRequirement(requirement, policy, contracts = [], poHistory = [], suppliers = [], items = [], consumedCeilings = new Map()) {
  const clauses = policy.clauses || {};
  const evalDate = parseDate(requirement.earliest_creation_date || new Date());
  const evalTime = evalDate.getTime();
  const itemMaster = items.find(i => i.item_code === requirement.item_code);
  const category = itemMaster?.category || 'General';

  // 1. Check Clause 5.7: New / Non-Catalog Item
  if (requirement.is_new_item || requirement.item_code === 'NEW_ITEM') {
    const unitPrice = Number(requirement.estimated_unit_price) || 0;
    const totalVal = Math.round(Number(requirement.total_quantity) * unitPrice * 100) / 100;
    return {
      route: 'NEW_ITEM_SOURCING',
      clause: 'Clause 5.7: Non-catalog/new item requires technical qualification and sourcing.',
      unit_price: unitPrice,
      valuation_method: 'USER_ESTIMATE',
      total_value: totalVal,
      assigned_supplier: null,
      suggested_suppliers: [],
      contract_id: null
    };
  }

  // 2. Perform Valuation Waterfall
  const valuation = getValuation(
    requirement.item_code,
    evalDate,
    contracts,
    poHistory,
    itemMaster,
    requirement.estimated_unit_price
  );

  const unitPrice = valuation.unit_price;
  const totalVal = Math.round(Number(requirement.total_quantity) * unitPrice * 100) / 100;

  // Rank suppliers for this item
  const rankedSuppliers = rankSuppliersForItem(
    requirement.item_code,
    evalDate,
    suppliers,
    poHistory,
    contracts
  );

  // 3. Check Clause 5.6: Capex
  if (requirement.is_capex) {
    const minQuotes = totalVal > (clauses.rfp_min_threshold_inr ?? 1000000)
      ? (clauses.rfp_min_quotes ?? 4)
      : (clauses.rfq_min_quotes ?? 3);
    const route = totalVal > (clauses.rfp_min_threshold_inr ?? 1000000) ? 'RFP' : 'RFQ';
    const topSuppliers = topUpCategorySuppliers(category, rankedSuppliers, suppliers, minQuotes);

    return {
      route,
      clause: 'Clause 5.6: Capital expenditure requires formal competitive sourcing.',
      unit_price: unitPrice,
      valuation_method: valuation.valuation_method,
      total_value: totalVal,
      assigned_supplier: null,
      suggested_suppliers: topSuppliers.slice(0, minQuotes),
      contract_id: null
    };
  }

  // 4. Check Clause 5.1: Active Rate Contract with Remaining Ceiling
  const activeContracts = (contracts || []).filter(c => {
    const eff = parseDate(c.effective_date).getTime();
    const exp = parseDate(c.expiry_date).getTime();
    if (eff <= evalTime && evalTime <= exp) {
      const line = (c.lines || []).find(l => l.item_code === requirement.item_code);
      return Boolean(line);
    }
    return false;
  });

  if (activeContracts.length > 0) {
    // Sort by line rate ascending (lowest rate first)
    activeContracts.sort((a, b) => {
      const rateA = a.lines.find(l => l.item_code === requirement.item_code)?.contract_price || Infinity;
      const rateB = b.lines.find(l => l.item_code === requirement.item_code)?.contract_price || Infinity;
      return rateA - rateB;
    });

    for (const c of activeContracts) {
      const line = c.lines.find(l => l.item_code === requirement.item_code);
      const contractRate = Number(line.contract_price);
      const contractVal = Math.round(Number(requirement.total_quantity) * contractRate * 100) / 100;

      // Track consumed ceiling
      const currentConsumed = consumedCeilings.get(c.contract_id) ?? Number(c.consumed_value) ?? 0;
      const remainingCeiling = Number(c.overall_ceiling) - currentConsumed;

      if (remainingCeiling >= contractVal) {
        // Contract applies! Update in-memory consumed ceiling
        consumedCeilings.set(c.contract_id, currentConsumed + contractVal);

        const supplier = suppliers.find(s => s.supplier_id === c.supplier_id);
        return {
          route: 'CONTRACT_PO',
          clause: `Clause 5.1: Active rate contract ${c.contract_id} available at INR ${contractRate}/unit with remaining ceiling INR ${remainingCeiling.toLocaleString('en-IN')}.`,
          unit_price: contractRate,
          valuation_method: 'CONTRACT',
          total_value: contractVal,
          assigned_supplier: {
            supplier_id: c.supplier_id,
            name: supplier?.name || c.supplier_id
          },
          suggested_suppliers: [{
            supplier_id: c.supplier_id,
            name: supplier?.name || c.supplier_id,
            score: 100,
            reason: `Contract holder for ${c.contract_id}`
          }],
          contract_id: c.contract_id
        };
      }
      // If ceiling exhausted, check next contract or fall through to other clauses
    }
  }

  // 5. Check Clause 5.4: Emergency Purchase
  if (requirement.is_emergency) {
    const emergencyLimit = clauses.emergency_threshold_inr ?? 500000;
    if (totalVal <= emergencyLimit) {
      const topSupplier = rankedSuppliers[0] || (suppliers.find(s => (s.categories || []).includes(category)));
      return {
        route: 'EMERGENCY_PO',
        clause: `Clause 5.4: Emergency purchase authorized up to INR ${emergencyLimit.toLocaleString('en-IN')} to prevent plant shutdown.`,
        unit_price: unitPrice,
        valuation_method: valuation.valuation_method,
        total_value: totalVal,
        assigned_supplier: topSupplier ? {
          supplier_id: topSupplier.supplier_id,
          name: topSupplier.name
        } : null,
        suggested_suppliers: rankedSuppliers.slice(0, 3),
        contract_id: null
      };
    } else {
      // Exceeds emergency threshold -> expedited sourcing
      const topSuppliers = topUpCategorySuppliers(category, rankedSuppliers, suppliers, 3);
      return {
        route: 'RFQ',
        clause: `Clause 5.4: Emergency requirement value INR ${totalVal.toLocaleString('en-IN')} exceeds INR ${emergencyLimit.toLocaleString('en-IN')}; expedited competitive RFQ required.`,
        unit_price: unitPrice,
        valuation_method: valuation.valuation_method,
        total_value: totalVal,
        assigned_supplier: null,
        suggested_suppliers: topSuppliers.slice(0, 3),
        contract_id: null
      };
    }
  }

  // 6. Check Clause 5.2: Spot Purchase
  const spotLimit = clauses.spot_threshold_inr ?? 200000;
  if (totalVal <= spotLimit) {
    const topSupplier = rankedSuppliers[0];
    return {
      route: 'SPOT_PO',
      clause: `Clause 5.2: Value INR ${totalVal.toLocaleString('en-IN')} is within spot purchase threshold INR ${spotLimit.toLocaleString('en-IN')}. Direct PO with top-ranked preferred supplier.`,
      unit_price: unitPrice,
      valuation_method: valuation.valuation_method,
      total_value: totalVal,
      assigned_supplier: topSupplier ? {
        supplier_id: topSupplier.supplier_id,
        name: topSupplier.name
      } : null,
      suggested_suppliers: rankedSuppliers.slice(0, 3),
      contract_id: null
    };
  }

  // 7. Check Clause 5.3: RFQ (2,00,000 to 10,00,000)
  const rfqLimit = clauses.rfq_max_threshold_inr ?? 1000000;
  const minQuotesRFQ = clauses.rfq_min_quotes ?? 3;
  if (totalVal <= rfqLimit) {
    const topSuppliers = topUpCategorySuppliers(category, rankedSuppliers, suppliers, minQuotesRFQ);
    return {
      route: 'RFQ',
      clause: `Clause 5.3: Value INR ${totalVal.toLocaleString('en-IN')} requires competitive RFQ with minimum ${minQuotesRFQ} quotations.`,
      unit_price: unitPrice,
      valuation_method: valuation.valuation_method,
      total_value: totalVal,
      assigned_supplier: null,
      suggested_suppliers: topSuppliers.slice(0, minQuotesRFQ),
      contract_id: null
    };
  }

  // 8. Clause 5.5: RFP (> 10,00,000)
  const minQuotesRFP = clauses.rfp_min_quotes ?? 4;
  const topSuppliers = topUpCategorySuppliers(category, rankedSuppliers, suppliers, minQuotesRFP);
  return {
    route: 'RFP',
    clause: `Clause 5.5: Value INR ${totalVal.toLocaleString('en-IN')} exceeds INR ${rfqLimit.toLocaleString('en-IN')}; formal sealed RFP with minimum ${minQuotesRFP} quotations required.`,
    unit_price: unitPrice,
    valuation_method: valuation.valuation_method,
    total_value: totalVal,
    assigned_supplier: null,
    suggested_suppliers: topSuppliers.slice(0, minQuotesRFP),
    contract_id: null
  };
}

module.exports = {
  evaluateRequirement
};

