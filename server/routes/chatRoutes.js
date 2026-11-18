/**
 * Conversational PR Intake Route
 * Interactive Chat Assistant for raising purchase requests
 */

const express = require('express');
const router = express.Router();
const { store } = require('../services/seedService');
const { matchItem } = require('../engine/itemMatcher');
const { clubPRLines } = require('../engine/clubbingService');
const { evaluateRequirement } = require('../engine/decisionRules');
const Requirement = require('../models/Requirement');

function extractQuantity(text, isQuantityContext = false) {
  if (!text) return null;
  const lower = text.toLowerCase().trim();

  // If input is purely a number or simple qty answer: e.g. "50", "20", "10 units"
  const pureNumMatch = lower.match(/^\s*([0-9]+)\s*(?:nos|pcs|units|pieces|qty|ea|items)?\s*$/i);
  if (pureNumMatch) {
    return parseInt(pureNumMatch[1], 10);
  }

  // Explicit quantity with units: "50 pieces", "10 units", "20 nos"
  const explicitQtyMatch = lower.match(/\b([0-9]+)\s*(?:nos|pcs|units|pieces|boxes|sets|pairs|pair|kg|ltr|cyl)\b/i);
  if (explicitQtyMatch) {
    return parseInt(explicitQtyMatch[1], 10);
  }

  // Need X: "need 50", "order 20"
  const needMatch = lower.match(/(?:need|order|buy|require|want)\s+([0-9]+)\b/i);
  if (needMatch) {
    return parseInt(needMatch[1], 10);
  }

  // Leading quantity at start of line: e.g. "1 drinking water purifier", "10 pneumatic cylinders", "50 PLC"
  // BUT do NOT match time expressions like "in 5 weeks" or specifications like "50 lph"
  const leadingQtyMatch = lower.match(/^([0-9]+)\s+(?!weeks|days|months|hours|cum|kg|sqmm|lph|ton|hp\b)([a-z]+)/i);
  if (leadingQtyMatch) {
    return parseInt(leadingQtyMatch[1], 10);
  }

  if (isQuantityContext) {
    const fallbackMatch = lower.match(/\b([0-9]+)\b/);
    if (fallbackMatch) return parseInt(fallbackMatch[1], 10);
  }

  return null;
}

function extractPlant(text) {
  const lower = text.toLowerCase();
  if (lower.includes('chk1') || lower.includes('chakan') || lower.includes('plant 1')) return 'CHK1';
  if (lower.includes('pun1') || lower.includes('pune') || lower.includes('plant 2')) return 'PUN1';
  return null;
}

function extractNeedByDate(text, isEmergency = false) {
  if (!text) return null;
  const lower = text.toLowerCase().trim();
  const now = new Date();

  // If urgent breakdown / emergency, automatic default is tomorrow (+1 day)
  if (isEmergency || lower.includes('urgent') || lower.includes('breakdown') || lower.includes('emergency') || lower.includes('asap') || lower.includes('immediately')) {
    return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }

  // in X weeks / X weeks (e.g. "in 5 weeks", "5 weeks")
  const weeksMatch = lower.match(/(?:in\s+)?([0-9]+)\s+weeks?/i);
  if (weeksMatch) {
    const numWeeks = parseInt(weeksMatch[1], 10);
    return new Date(now.getTime() + numWeeks * 7 * 24 * 60 * 60 * 1000);
  }

  // in X days / X days (e.g. "in 10 days", "10 days")
  const daysMatch = lower.match(/(?:in\s+)?([0-9]+)\s+days?/i);
  if (daysMatch) {
    const numDays = parseInt(daysMatch[1], 10);
    return new Date(now.getTime() + numDays * 24 * 60 * 60 * 1000);
  }

  // in X months / X months
  const monthsMatch = lower.match(/(?:in\s+)?([0-9]+)\s+months?/i);
  if (monthsMatch) {
    const numMonths = parseInt(monthsMatch[1], 10);
    return new Date(now.getFullYear(), now.getMonth() + numMonths, now.getDate());
  }

  if (lower.includes('tomorrow')) {
    return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
  if (lower.includes('next week') || lower.includes('in a week')) {
    return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
  if (lower.includes('end of month') || lower.includes('month end')) {
    return new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }
  if (lower.includes('friday') || lower.includes('next friday')) {
    const day = now.getDay();
    const diff = (5 + 7 - day) % 7 || 7;
    return new Date(now.getTime() + diff * 24 * 60 * 60 * 1000);
  }

  // Explicit YYYY-MM-DD or DD/MM/YYYY or DD-MM-YYYY
  const dateMatch = lower.match(/\b([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{2,4})\b/);
  if (dateMatch) {
    const parsed = new Date(dateMatch[1]);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

function extractUrgency(text) {
  const lower = text.toLowerCase();
  if (lower.includes('urgent') || lower.includes('emergency') || lower.includes('breakdown') || lower.includes('critical')) {
    return 'Emergency';
  }
  return 'Standard';
}

function extractCapex(text) {
  const lower = text.toLowerCase();
  return lower.includes('capex') || lower.includes('capital') || lower.includes('asset') || lower.includes('machinery');
}

function isNewProductRequest(text) {
  const lower = text.toLowerCase().trim();
  // Check if text looks like a full requisition statement
  return /^(need|require|please order|order|buy|i want|[0-9]+\s+[a-z]+)/i.test(lower) ||
    lower.includes('for chakan') || lower.includes('for pune') ||
    lower.includes('breakdown') || lower.includes('capex');
}

// POST /api/chat
router.post('/', async (req, res) => {
  try {
    const { message, session_state = {} } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty.' });
    }

    let currentState = { ...session_state };
    const isNewReq = isNewProductRequest(message);

    // If previous request was finished OR user sends a clear new product request, start fresh!
    if (currentState.is_complete || (isNewReq && !currentState.awaiting_price && currentState.awaiting_field !== 'quantity')) {
      currentState = {};
    }

    // 1. Check if user is answering estimated price for a non-catalog item
    if (currentState.awaiting_price) {
      const priceVal = Number(message.replace(/[^0-9.]/g, ''));
      if (priceVal > 0) {
        currentState.estimated_unit_price = priceVal;
        currentState.awaiting_price = false;
      }
    }

    // 2. Extract urgency & capex
    if (extractUrgency(message) === 'Emergency') currentState.urgency = 'Emergency';
    if (extractCapex(message)) currentState.is_capex = true;

    // 3. Extract quantity only if not already set or actively awaiting quantity
    if (!currentState.quantity || currentState.awaiting_field === 'quantity') {
      const isQtyAnswer = currentState.awaiting_field === 'quantity';
      const detectedQty = extractQuantity(message, isQtyAnswer);
      if (detectedQty !== null) {
        currentState.quantity = detectedQty;
        if (isQtyAnswer) currentState.awaiting_field = null;
      }
    }

    // 4. Extract plant
    const detectedPlant = extractPlant(message);
    if (detectedPlant) {
      currentState.plant = detectedPlant;
      if (currentState.awaiting_field === 'plant') currentState.awaiting_field = null;
    }

    // 5. Extract need-by date
    const isEmergency = currentState.urgency === 'Emergency';
    const detectedDate = extractNeedByDate(message, isEmergency);
    if (detectedDate) {
      currentState.need_by_date = detectedDate.toISOString().slice(0, 10);
      if (currentState.awaiting_field === 'need_by_date') currentState.awaiting_field = null;
    } else if (isEmergency && !currentState.need_by_date) {
      // Auto-set tomorrow for emergencies
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      currentState.need_by_date = tomorrow.toISOString().slice(0, 10);
    }

    // 6. Item matching
    if (!currentState.item_code) {
      const items = store.items || [];
      const match = matchItem({ description: message }, items);

      if (match.matched) {
        currentState.item_code = match.item_code;
        currentState.item_name = match.item_name;
        currentState.category = match.category;
        currentState.confidence = match.confidence;
        currentState.is_new = false;
      } else {
        currentState.item_code = 'NEW_ITEM';
        currentState.item_name = message
          .replace(/^(need|order|buy|require|please order|i want)\s+/i, '')
          .replace(/\b(for chakan|for pune|chk1|pun1|by next friday|urgent breakdown|urgent|capex project|capex|in [0-9]+ weeks?|in [0-9]+ days?)\b/gi, '')
          .replace(/^[0-9]+\s*(?:pieces|nos|units|pcs)?\s*(?:of)?\s*/i, '')
          .replace(/\s+/g, ' ')
          .trim();
        currentState.category = 'Non-Catalog';
        currentState.is_new = true;
      }
    }

    // Check missing fields and build conversational response
    if (!currentState.item_code) {
      return res.json({
        reply: "Hello! What item or spare part would you like to request today?",
        session_state: currentState,
        is_complete: false
      });
    }

    if (!currentState.quantity) {
      currentState.awaiting_field = 'quantity';
      return res.json({
        reply: `Identified: ${currentState.item_name} (${currentState.item_code}). How many units do you need?`,
        session_state: currentState,
        is_complete: false
      });
    }

    if (!currentState.plant) {
      currentState.awaiting_field = 'plant';
      return res.json({
        reply: `Noted: ${currentState.quantity} units of ${currentState.item_name}. Which destination plant is this for? (Chakan [CHK1] or Pune [PUN1])`,
        session_state: currentState,
        is_complete: false
      });
    }

    if (!currentState.need_by_date) {
      currentState.awaiting_field = 'need_by_date';
      return res.json({
        reply: `Destination plant set to ${currentState.plant}. When do you need this delivered by? (e.g. "in 5 weeks", "next Friday", or YYYY-MM-DD)`,
        session_state: currentState,
        is_complete: false
      });
    }

    if (currentState.is_new && !currentState.estimated_unit_price) {
      currentState.awaiting_price = true;
      return res.json({
        reply: `Item "${currentState.item_name}" is a new non-catalog item. What is your estimated unit price in INR for sourcing?`,
        session_state: currentState,
        is_complete: false
      });
    }

    // All fields present! Process Requirement through Policy Engine
    currentState.awaiting_field = null;
    currentState.awaiting_price = false;

    const creationDate = new Date();
    const needByDate = new Date(currentState.need_by_date);
    const prLine = {
      pr_id: `PR-${Date.now().toString().slice(-5)}`,
      line_number: 1,
      item_code: currentState.item_code,
      item_name: currentState.item_name,
      plant: currentState.plant,
      quantity: currentState.quantity,
      need_by_date: needByDate,
      creation_date: creationDate,
      urgency: currentState.urgency || 'Standard',
      is_capex: Boolean(currentState.is_capex),
      is_new: Boolean(currentState.is_new),
      estimated_unit_price: currentState.estimated_unit_price || 0,
      requester: 'Employee'
    };

    const clubbed = clubPRLines([prLine], store.activePolicy?.clauses);
    const requirement = clubbed[0];
    const decision = evaluateRequirement(
      requirement,
      store.activePolicy,
      store.contracts,
      store.poHistory,
      store.suppliers,
      store.items,
      new Map()
    );

    const fullReq = {
      ...requirement,
      batch_id: 'chat_session',
      estimated_unit_price: decision.unit_price,
      valuation_method: decision.valuation_method,
      total_value_inr: decision.total_value,
      system_route: decision.route,
      system_clause: decision.clause,
      system_supplier_id: decision.assigned_supplier?.supplier_id || null,
      system_supplier_name: decision.assigned_supplier?.name || null,
      suggested_suppliers: decision.suggested_suppliers || [],
      contract_id: decision.contract_id || null,
      status: 'Pending Review'
    };

    store.requirements.unshift(fullReq);
    try {
      await Requirement.create(fullReq);
    } catch (e) {}

    const cleanReply = `Purchase request confirmed for ${fullReq.total_quantity} units of ${fullReq.item_name}. Policy decision: ${fullReq.system_route}.`;

    return res.json({
      reply: cleanReply,
      session_state: { is_complete: true },
      is_complete: true,
      requirement: fullReq
    });
  } catch (err) {
    console.error('Chat intake error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
