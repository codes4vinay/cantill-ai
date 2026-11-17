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

function extractQuantity(text) {
  const match = text.match(/\b([0-9]+)\s*(?:nos|pcs|units|pieces|qty|ea|items)?\b/i);
  return match ? parseInt(match[1], 10) : null;
}

function extractPlant(text) {
  const lower = text.toLowerCase();
  if (lower.includes('chk1') || lower.includes('chakan') || lower.includes('plant 1')) return 'CHK1';
  if (lower.includes('pun1') || lower.includes('pune') || lower.includes('plant 2')) return 'PUN1';
  return null;
}

function extractNeedByDate(text) {
  const lower = text.toLowerCase();
  const now = new Date();

  if (lower.includes('tomorrow')) {
    return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
  if (lower.includes('next week') || lower.includes('in a week')) {
    return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
  if (lower.includes('in 2 weeks') || lower.includes('in two weeks')) {
    return new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  }
  if (lower.includes('by next friday') || lower.includes('friday')) {
    return new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
  }
  if (lower.includes('end of month') || lower.includes('month end')) {
    return new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }

  // Explicit YYYY-MM-DD or DD/MM/YYYY
  const dateMatch = text.match(/\b([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{2,4})\b/);
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

// POST /api/chat
router.post('/', async (req, res) => {
  try {
    const { message, session_state = {} } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty.' });
    }

    let currentState = { ...session_state };

    // If previous request completed OR user clearly starts a fresh PR statement, reset session state
    const isNewStatement = /^(need|require|please|order|i want|[0-9]+\s+[a-z]+)/i.test(message.trim());
    if (currentState.is_complete || (isNewStatement && !currentState.awaiting_price && !currentState.awaiting_field)) {
      currentState = {};
    }

    // Check if user is answering a unit price question for a new item
    if (currentState.awaiting_price) {
      const priceMatch = message.match(/(?:inr|rs\.?)?\s*([0-9,]+(?:\.[0-9]+)?)/i);
      if (priceMatch) {
        currentState.estimated_unit_price = Number(priceMatch[1].replace(/,/g, ''));
        currentState.awaiting_price = false;
      }
    }

    // Extract entities from current message
    const detectedQty = extractQuantity(message);
    if (detectedQty !== null) currentState.quantity = detectedQty;

    const detectedPlant = extractPlant(message);
    if (detectedPlant) currentState.plant = detectedPlant;

    const detectedDate = extractNeedByDate(message);
    if (detectedDate) currentState.need_by_date = detectedDate.toISOString().slice(0, 10);

    if (extractUrgency(message) === 'Emergency') currentState.urgency = 'Emergency';
    if (extractCapex(message)) currentState.is_capex = true;

    // Item matching if item is not locked yet
    if (!currentState.item_code) {
      const items = store.items || [];
      const match = matchItem({ description: message }, items);

      if (match.matched) {
        currentState.item_code = match.item_code;
        currentState.item_name = match.item_name;
        currentState.category = match.category;
        currentState.confidence = match.confidence;
        currentState.is_new = false;
      } else if (match.is_new) {
        currentState.item_code = 'NEW_ITEM';
        currentState.item_name = message.replace(/(?:need|require|i want|please order)\s*/i, '').trim();
        currentState.category = 'Non-Catalog';
        currentState.is_new = true;
      }
    }

    // Conversational follow-ups for missing fields
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
        reply: `Destination plant set to ${currentState.plant}. When do you need this delivered by? (e.g. "next Friday", "in 2 weeks", or YYYY-MM-DD)`,
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

    // All fields confirmed! Process Requirement and Evaluate Policy
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

    // Clean conversational confirmation without raw markdown markup
    const cleanReply = `Purchase request confirmed for ${fullReq.total_quantity} units of ${fullReq.item_name}. The policy engine evaluated this requirement and assigned route: ${fullReq.system_route}.`;

    return res.json({
      reply: cleanReply,
      session_state: { is_complete: true }, // Mark complete so next prompt starts fresh!
      is_complete: true,
      requirement: fullReq
    });
  } catch (err) {
    console.error('Chat intake error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
