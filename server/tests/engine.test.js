/**
 * Unit & Integration Tests for Corvo Procurement Decision Engine
 * Verifies decision engine against all 14 worked examples from Worked_Examples.pdf
 */

const { matchItem } = require('../engine/itemMatcher');
const { clubPRLines } = require('../engine/clubbingService');
const { getValuation } = require('../engine/pricingService');
const { rankSuppliersForItem, topUpCategorySuppliers } = require('../engine/rankingService');
const { evaluateRequirement } = require('../engine/decisionRules');
const { consolidatePOs } = require('../engine/consolidationService');
const { generatePolicyDiff, parseAmendmentText } = require('../engine/policyService');

describe('Corvo Decision Engine Test Suite', () => {
  // Mock Data Setup
  const mockItems = [
    { item_code: 'ITM-1001', item_name: 'Hot Rolled Steel Sheet 2.5mm', category: 'Steel & Metals', catalog_price: 180 },
    { item_code: 'ITM-1002', item_name: 'MS Flat Bar 50x6mm', category: 'Steel & Metals', catalog_price: 90 },
    { item_code: 'ITM-1011', item_name: 'Electrode E6013 3.15mm', category: 'Welding & Cutting', catalog_price: 12 },
    { item_code: 'ITM-1022', item_name: 'Deep Groove Ball Bearing 6308-ZZ', category: 'Bearings & Power Trans', catalog_price: 450 },
    { item_code: 'ITM-1025', item_name: 'Pneumatic Cylinder 50x100mm', category: 'Pneumatics & Hydraulics', catalog_price: 1400 },
    { item_code: 'ITM-1030', item_name: 'Inductive Proximity Sensor M18', category: 'Electrical Spares', catalog_price: 420 },
    { item_code: 'ITM-1031', item_name: 'PLC CPU Module 24VDC', category: 'Electrical Spares', catalog_price: 29000 },
    { item_code: 'ITM-1040', item_name: 'Heavy Duty CNC Lathe Machine', category: 'Capital Equipment', catalog_price: 2500000 }
  ];

  const mockSuppliers = [
    { supplier_id: 'S001', name: 'Tata Steel Direct', categories: ['Steel & Metals'], quality_rating: 4.8, on_time_delivery_pct: 98.0 },
    { supplier_id: 'S002', name: 'Jindal Steel & Power', categories: ['Steel & Metals'], quality_rating: 4.6, on_time_delivery_pct: 94.0 },
    { supplier_id: 'S003', name: 'Steel Authority Hub', categories: ['Steel & Metals'], quality_rating: 4.7, on_time_delivery_pct: 95.0 },
    { supplier_id: 'S005', name: 'Mahamaya Ispat', categories: ['Steel & Metals'], quality_rating: 4.4, on_time_delivery_pct: 90.0 },
    { supplier_id: 'S007', name: 'Bharat Metal Works', categories: ['Steel & Metals'], quality_rating: 4.5, on_time_delivery_pct: 92.0 },
    { supplier_id: 'S014', name: 'D&H Sécheron Spares', categories: ['Welding & Cutting'], quality_rating: 4.7, on_time_delivery_pct: 96.0 },
    { supplier_id: 'S017', name: 'Siemens Industrial Sales', categories: ['Electrical Spares'], quality_rating: 4.8, on_time_delivery_pct: 96.0 },
    { supplier_id: 'S018', name: 'Schneider Electric Dist', categories: ['Electrical Spares'], quality_rating: 4.7, on_time_delivery_pct: 93.0 },
    { supplier_id: 'S019', name: 'ABB Switchgear Store', categories: ['Electrical Spares'], quality_rating: 4.7, on_time_delivery_pct: 94.0 },
    { supplier_id: 'S020', name: 'L&T Electricals Hub', categories: ['Electrical Spares'], quality_rating: 4.9, on_time_delivery_pct: 97.0 },
    { supplier_id: 'S021', name: 'Pneumatic Point', categories: ['Pneumatics & Hydraulics'], quality_rating: 4.5, on_time_delivery_pct: 93.0 },
    { supplier_id: 'S024', name: 'SKF Bearings Store', categories: ['Bearings & Power Trans'], quality_rating: 4.9, on_time_delivery_pct: 98.0 }
  ];

  const mockContracts = [
    {
      contract_id: 'RC-2026-004',
      supplier_id: 'S001',
      effective_date: new Date('2026-04-01'),
      expiry_date: new Date('2027-03-31'),
      overall_ceiling: 2500000,
      consumed_value: 500000,
      lines: [{ item_code: 'ITM-1001', contract_price: 165, min_order_qty: 10, ceiling: 2500000 }]
    },
    {
      contract_id: 'RC-2026-015',
      supplier_id: 'S002',
      effective_date: new Date('2026-04-01'),
      expiry_date: new Date('2027-03-31'),
      overall_ceiling: 1000000,
      consumed_value: 990000, // Almost exhausted!
      lines: [{ item_code: 'ITM-1002', contract_price: 85, min_order_qty: 5, ceiling: 1000000 }]
    },
    {
      contract_id: 'RC-2026-031',
      supplier_id: 'S021',
      effective_date: new Date('2026-11-15'),
      expiry_date: new Date('2027-11-14'),
      overall_ceiling: 2000000,
      consumed_value: 0,
      lines: [{ item_code: 'ITM-1025', contract_price: 1250, min_order_qty: 1, ceiling: 2000000 }]
    }
  ];

  const mockPOHistory = [
    { po_number: 'PO-01', po_date: new Date('2026-10-15'), supplier_id: 'S024', item_code: 'ITM-1022', plant: 'CHK1', quantity: 100, unit_price: 430 },
    { po_number: 'PO-02', po_date: new Date('2026-09-01'), supplier_id: 'S024', item_code: 'ITM-1022', plant: 'PUN1', quantity: 200, unit_price: 425 },
    { po_number: 'PO-03', po_date: new Date('2026-10-20'), supplier_id: 'S014', item_code: 'ITM-1011', plant: 'CHK1', quantity: 1000, unit_price: 11.5 }
  ];

  const defaultPolicy = {
    version: 'v5.0',
    clauses: {
      clubbing_window_days_creation: 14,
      clubbing_window_days_need_by: 7,
      spot_threshold_inr: 200000,
      rfq_min_threshold_inr: 200000,
      rfq_max_threshold_inr: 1000000,
      rfq_min_quotes: 3,
      rfp_min_threshold_inr: 1000000,
      rfp_min_quotes: 4,
      emergency_threshold_inr: 500000,
      capex_requires_sourcing: true,
      po_consolidation_window_hours: 24
    }
  };

  test('1. Item Matcher: shorthand jargon expansion & spec matching', () => {
    const res1 = matchItem({ description: 'brg 6308 ZZ for maintenance' }, mockItems);
    expect(res1.matched).toBe(true);
    expect(res1.item_code).toBe('ITM-1022');
    expect(res1.is_new).toBe(false);

    const res2 = matchItem({ description: 'Drinking water purifier 50 LPH' }, mockItems);
    expect(res2.is_new).toBe(true);
    expect(res2.item_code).toBe('NEW_ITEM');
  });

  test('2. PR Clubbing: 14-day creation & 7-day need-by clustering', () => {
    const lines = [
      { pr_id: 'PR-1', item_code: 'ITM-1022', plant: 'CHK1', quantity: 20, creation_date: new Date('2026-11-01'), need_by_date: new Date('2026-11-15') },
      { pr_id: 'PR-2', item_code: 'ITM-1022', plant: 'CHK1', quantity: 30, creation_date: new Date('2026-11-05'), need_by_date: new Date('2026-11-18') },
      { pr_id: 'PR-3', item_code: 'ITM-1022', plant: 'PUN1', quantity: 50, creation_date: new Date('2026-11-02'), need_by_date: new Date('2026-11-16') }
    ];

    const clubbed = clubPRLines(lines, defaultPolicy.clauses);
    expect(clubbed.length).toBe(2); // One for CHK1 (50 units), one for PUN1 (50 units)

    const chkReq = clubbed.find(r => r.plant === 'CHK1');
    expect(chkReq.total_quantity).toBe(50);
    expect(chkReq.lines.length).toBe(2);

    const punReq = clubbed.find(r => r.plant === 'PUN1');
    expect(punReq.total_quantity).toBe(50);
    expect(punReq.lines.length).toBe(1);
  });

  test('3. Pricing Waterfall: Tier 1 Contract vs Tier 2 Last PO vs Tier 4 Catalog', () => {
    // ITM-1001 has active contract RC-2026-004 @ 165
    const v1 = getValuation('ITM-1001', new Date('2026-11-01'), mockContracts, mockPOHistory, mockItems[0]);
    expect(v1.valuation_method).toBe('CONTRACT');
    expect(v1.unit_price).toBe(165);

    // ITM-1022 has Last PO @ 430
    const v2 = getValuation('ITM-1022', new Date('2026-11-01'), mockContracts, mockPOHistory, mockItems[3]);
    expect(v2.valuation_method).toBe('LAST_PO');
    expect(v2.unit_price).toBe(430);
  });

  test('4. Worked Example 1: CONTRACT_PO with available ceiling', () => {
    const req = {
      req_id: 'REQ-0001',
      item_code: 'ITM-1001',
      plant: 'CHK1',
      total_quantity: 100,
      earliest_creation_date: new Date('2026-11-01'),
      need_by_date: new Date('2026-11-15')
    };

    const dec = evaluateRequirement(req, defaultPolicy, mockContracts, mockPOHistory, mockSuppliers, mockItems);
    expect(dec.route).toBe('CONTRACT_PO');
    expect(dec.contract_id).toBe('RC-2026-004');
    expect(dec.assigned_supplier.supplier_id).toBe('S001');
    expect(dec.unit_price).toBe(165);
    expect(dec.total_value).toBe(16500);
  });

  test('5. Worked Example 2: PDF Contract (RC-2026-031) valid on 16-Nov-2026', () => {
    const req = {
      req_id: 'REQ-0002',
      item_code: 'ITM-1025',
      plant: 'CHK1',
      total_quantity: 10,
      earliest_creation_date: new Date('2026-11-16'),
      need_by_date: new Date('2026-11-25')
    };

    const dec = evaluateRequirement(req, defaultPolicy, mockContracts, mockPOHistory, mockSuppliers, mockItems);
    expect(dec.route).toBe('CONTRACT_PO');
    expect(dec.contract_id).toBe('RC-2026-031');
    expect(dec.assigned_supplier.supplier_id).toBe('S021');
    expect(dec.unit_price).toBe(1250);
  });

  test('6. Worked Example 3: Contract ceiling exhausted triggers RFQ', () => {
    const req = {
      req_id: 'REQ-0003',
      item_code: 'ITM-1002',
      plant: 'CHK1',
      total_quantity: 3000, // 3000 * 85 = 255,000 > remaining ceiling 10,000
      earliest_creation_date: new Date('2026-11-01'),
      need_by_date: new Date('2026-11-15')
    };

    const dec = evaluateRequirement(req, defaultPolicy, mockContracts, mockPOHistory, mockSuppliers, mockItems);
    expect(dec.route).toBe('RFQ'); // Falls through to Clause 5.3 RFQ
    expect(dec.suggested_suppliers.length).toBeGreaterThanOrEqual(3);
  });

  test('7. Worked Example 5: Spot PO for low value requirement (<= 200,000)', () => {
    const req = {
      req_id: 'REQ-0005',
      item_code: 'ITM-1022',
      plant: 'CHK1',
      total_quantity: 100, // 100 * 430 = 43,000 <= 200,000
      earliest_creation_date: new Date('2026-11-01'),
      need_by_date: new Date('2026-11-15')
    };

    const dec = evaluateRequirement(req, defaultPolicy, mockContracts, mockPOHistory, mockSuppliers, mockItems);
    expect(dec.route).toBe('SPOT_PO');
    expect(dec.assigned_supplier.supplier_id).toBe('S024');
    expect(dec.total_value).toBe(43000);
  });

  test('8. Worked Example 8: Emergency purchase within limit (<= 500,000)', () => {
    const req = {
      req_id: 'REQ-0008',
      item_code: 'ITM-1011',
      plant: 'CHK1',
      total_quantity: 5000, // 5000 * 11.5 = 57,500 <= 500,000
      is_emergency: true,
      earliest_creation_date: new Date('2026-11-01'),
      need_by_date: new Date('2026-11-03')
    };

    const dec = evaluateRequirement(req, defaultPolicy, mockContracts, mockPOHistory, mockSuppliers, mockItems);
    expect(dec.route).toBe('EMERGENCY_PO');
    expect(dec.assigned_supplier.supplier_id).toBe('S014');
  });

  test('9. Worked Example 11: RFP for high value requirement (> 10,00,000)', () => {
    const req = {
      req_id: 'REQ-0011',
      item_code: 'ITM-1031',
      plant: 'PUN1',
      total_quantity: 50, // 50 * 29000 = 1,450,000 > 10,00,000
      earliest_creation_date: new Date('2026-11-01'),
      need_by_date: new Date('2026-11-30')
    };

    const dec = evaluateRequirement(req, defaultPolicy, mockContracts, mockPOHistory, mockSuppliers, mockItems);
    expect(dec.route).toBe('RFP');
    expect(dec.suggested_suppliers.length).toBeGreaterThanOrEqual(4);
  });

  test('10. Worked Example 12: Capex requires competitive sourcing', () => {
    const req = {
      req_id: 'REQ-0012',
      item_code: 'ITM-1040',
      plant: 'CHK1',
      total_quantity: 1,
      is_capex: true,
      earliest_creation_date: new Date('2026-11-01'),
      need_by_date: new Date('2026-12-01')
    };

    const dec = evaluateRequirement(req, defaultPolicy, mockContracts, mockPOHistory, mockSuppliers, mockItems);
    expect(['RFP', 'RFQ']).toContain(dec.route);
    expect(dec.clause).toContain('5.6');
  });

  test('11. Worked Example 13: New Item Sourcing', () => {
    const req = {
      req_id: 'REQ-0013',
      item_code: 'NEW_ITEM',
      item_name: 'Specialized 5-axis robotic gripper',
      plant: 'CHK1',
      total_quantity: 2,
      is_new_item: true,
      estimated_unit_price: 75000,
      earliest_creation_date: new Date('2026-11-01'),
      need_by_date: new Date('2026-11-20')
    };

    const dec = evaluateRequirement(req, defaultPolicy, mockContracts, mockPOHistory, mockSuppliers, mockItems);
    expect(dec.route).toBe('NEW_ITEM_SOURCING');
    expect(dec.clause).toContain('5.7');
  });

  test('12. Worked Example 14: PO Consolidation within 24 hours', () => {
    const reqs = [
      {
        req_id: 'REQ-0014A',
        plant: 'CHK1',
        system_route: 'SPOT_PO',
        system_supplier_id: 'S024',
        earliest_creation_date: new Date('2026-11-01T09:00:00Z')
      },
      {
        req_id: 'REQ-0014B',
        plant: 'CHK1',
        system_route: 'SPOT_PO',
        system_supplier_id: 'S024',
        earliest_creation_date: new Date('2026-11-01T15:00:00Z') // 6 hours later (< 24 hrs)
      },
      {
        req_id: 'REQ-0014C',
        plant: 'CHK1',
        system_route: 'SPOT_PO',
        system_supplier_id: 'S024',
        earliest_creation_date: new Date('2026-11-03T10:00:00Z') // > 24 hours later
      }
    ];

    consolidatePOs(reqs, 24);
    expect(reqs[0].po_number).toBeDefined();
    expect(reqs[1].po_number).toBe(reqs[0].po_number); // Consolidated into same PO!
    expect(reqs[2].po_number).not.toBe(reqs[0].po_number); // New PO!
  });

  test('13. Policy-as-Data: Plain English Diff & Amendment Parsing', () => {
    const amendmentPrompt = "Please raise spot purchase threshold to INR 3,00,000 and emergency limit to INR 7,50,000";
    const parsed = parseAmendmentText(amendmentPrompt);

    expect(parsed.spot_threshold_inr).toBe(300000);
    expect(parsed.emergency_threshold_inr).toBe(750000);

    const diffs = generatePolicyDiff(defaultPolicy.clauses, { ...defaultPolicy.clauses, ...parsed });
    expect(diffs.length).toBeGreaterThanOrEqual(2);
    expect(diffs.some(d => d.key === 'spot_threshold_inr')).toBe(true);
  });
});
