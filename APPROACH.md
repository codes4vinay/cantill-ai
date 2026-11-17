# APPROACH.md — Technical Architecture & Implementation Strategy
**Company:** Corvo Engineering Pvt Ltd  
**Project:** Autonomous Procurement Decision Platform (PR-to-PO)  
**Author:** Full-stack Intern Candidate  
**Submission Date:** November 2026  

---

## 1. Executive Summary & Philosophy
This document details the engineering methodology, AI integration, and design decisions behind the Corvo Engineering PR-to-PO platform. The application is built to eliminate human bottlenecks in manufacturing procurement by turning messy human language into structured purchase requests and evaluating them against a dynamic, versioned procurement policy that operates as pure data rather than hardcoded logic.

---

## 2. AI Tools Usage Disclosure (Task Section 7)

In strict adherence to the competition rules, here is the full disclosure of AI tools utilized during development and inside the live application:

### A. AI Tools Used in Coding & Development
- **Coding Agents / Assistants:** Google DeepMind Antigravity CLI and Gemini 2.5/Pro models were used for architectural brainstorming, rapid boilerplate scaffolding, regex construction for PDF contract extraction, and exploratory analysis of historical PO data.
- **Verification & Review:** Used automated test generation scripts to validate edge cases against `Worked_Examples.pdf` and verify mathematical convergence of the supplier ranking formula.

### B. AI Tools Used Inside the App
- **Conversational Chat Assistant (Intake):**
  - Uses an intelligent Natural Language Processing (NLP) entity extraction engine.
  - When an employee types freeform input (e.g., *"need 200 nitrile gloves for Chakan by next Friday"*), the intake parser extracts the intent, matched item description, quantity, destination plant (`CHK1` or `PUN1`), need-by date (handling relative dates like "next Friday", "in 2 weeks"), and urgency.
  - If required fields are missing, the assistant asks conversational follow-up questions instead of rejecting the prompt.
  - For un-cataloged items (e.g., *"Drinking water purifier 50 LPH"*), the assistant gracefully routes to `NEW_ITEM_SOURCING` and prompts the user for an estimated unit price rather than hallucinating catalog items.
- **Policy Amendment Extractor (Policy as Data):**
  - An intelligent rule parser that reads unstructured procurement policy amendments (uploaded as PDF/text or dictated via chat).
  - Translates contractual phrases (e.g., *"raise spot purchase threshold to ₹3,00,000 for plant PUN1"*) into structured JSON condition predicates.
  - Generates a plain-English diff ("What will change") so the procurement manager can review and approve before the new version goes live.

---

## 3. System Architecture & Tech Stack (MERN Stack)

The system is architected as a clean, decoupled **MERN Stack** (MongoDB, Express, React, Node.js) with strict separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Layer (Vercel)                  │
│       React 18 + Vite + Tailwind CSS + Lucide Icons         │
│  ┌───────────────┐ ┌────────────────┐ ┌──────────────────┐  │
│  │  Chat Intake  │ │ Buyer Workspace│ │ Policy Management│  │
│  └───────────────┘ └────────────────┘ └──────────────────┘  │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / REST API
┌──────────────────────────────▼──────────────────────────────┐
│                    API Gateway (Render)                     │
│                  Node.js / Express Server                   │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                Core Decision Engine                   │  │
│  │  • Item Matcher (Exact + Synonyms + Levenshtein)      │  │
│  │  • Requirement Clubbing (14d Create + 7d Need-by)     │  │
│  │  • Valuation Service (Contract Rate > PO > Std)       │  │
│  │  • Contract Service (Active check, Ceiling depletion) │  │
│  │  • Policy Evaluator (Versioned Policy-as-Data Rules)   │  │
│  │  • Preferred Supplier Ranking & Category Top-up       │  │
│  │  • PO Consolidation (24h supplier/plant/route window) │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────┘
                               │ Mongoose ODM
┌──────────────────────────────▼──────────────────────────────┐
│                    Data Storage Layer                       │
│                     MongoDB Atlas                           │
│  • Items  • Suppliers  • PO History  • Contracts  • Policies│
└─────────────────────────────────────────────────────────────┘
```

### Why This Stack?
1. **Frontend on Vercel:** React 18 with Vite provides blazing fast client-side rendering, instant search, live batch analytics, and global edge delivery.
2. **Backend on Render:** Node.js + Express handles asynchronous batch streams, file uploads (PDF contracts, PR batch CSVs), and exports.
3. **Database on MongoDB Atlas:** Flexible JSON document model is the ideal fit for **Policy as Data**, allowing arbitrary condition predicates and schema-free policy amendments without database migrations.

---

## 4. Policy as Data Architecture

A core mandate of the challenge is that procurement rules must exist as **versioned data**, allowing zero-code updates when procurement changes limits or introduces category/plant-specific rules.

### Data Structure of a Versioned Policy
```json
{
  "policy_id": "CORVO-PROC-POL-04",
  "version": "5.0",
  "effective_date": "2026-04-01",
  "status": "ACTIVE",
  "parameters": {
    "clubbing_window_days": 14,
    "need_by_window_days": 7,
    "history_lookback_days": 365,
    "preferred_lookback_days": 548,
    "po_consolidation_window_hours": 24
  },
  "rules": [
    {
      "clause": "5.1",
      "name": "Capex Sourcing",
      "conditions": { "item_type": ["Capex"] },
      "outcome": {
        "decision": "SOURCING_REQUEST",
        "route": "CAPEX_SOURCING",
        "suggest_suppliers_count": 5
      }
    },
    {
      "clause": "5.2",
      "name": "Rate Contract PO",
      "conditions": { "has_usable_contract": true },
      "outcome": {
        "decision": "PO",
        "route": "CONTRACT_PO",
        "supplier_source": "contract",
        "price_source": "contract_rate"
      }
    },
    {
      "clause": "5.3",
      "name": "Emergency PO",
      "conditions": {
        "is_emergency": true,
        "max_value": 500000,
        "bought_in_past_days": 365
      },
      "outcome": {
        "decision": "PO",
        "route": "EMERGENCY_PO",
        "supplier_source": "1st_preferred",
        "price_source": "reference_price"
      }
    },
    {
      "clause": "5.4",
      "name": "Spot PO",
      "conditions": {
        "max_value": 200000,
        "bought_in_past_days": 365
      },
      "outcome": {
        "decision": "PO",
        "route": "SPOT_PO",
        "supplier_source": "1st_preferred",
        "price_source": "reference_price"
      }
    },
    {
      "clause": "5.5",
      "name": "RFQ",
      "conditions": { "max_value": 1000000 },
      "outcome": {
        "decision": "SOURCING_REQUEST",
        "route": "RFQ",
        "suggest_suppliers_count": 3
      }
    },
    {
      "clause": "5.6",
      "name": "RFP",
      "conditions": { "min_value": 1000000 },
      "outcome": {
        "decision": "SOURCING_REQUEST",
        "route": "RFP",
        "suggest_suppliers_count": 5
      }
    }
  ]
}
```

### The Policy Evaluation Engine
The engine does not contain hardcoded `if (val < 200000)` checks. Instead:
1. When evaluating a requirement, the engine resolves the policy document whose `effective_date` $\le T_{\text{req}}$ with status `ACTIVE`.
2. It loops through the `rules` array in order of priority.
3. For each rule, it checks the condition predicates (`item_type`, `category`, `plant`, `is_emergency`, `has_usable_contract`, `bought_in_past_days`, `min_value`, `max_value`).
4. The first rule whose conditions evaluate to true produces the outcome.
5. If an amendment modifies a threshold or introduces a plant-specific rule (e.g. `plant: ["CHK1"]`), the evaluator automatically respects the new condition without code changes.

---

## 5. Decision Engine Modules

1. **`itemMatcher.js`**:
   - Exact code match → dictionary lookup.
   - Text normalization: strips punctuation, expands engineering abbreviations (`brg` → `bearing`, `pneu` → `pneumatic`, etc.).
   - Trigram sequence & token Jaccard similarity.
   - Numerical feature preservation (e.g. `6308`, `M10x40`).
2. **`clubbingService.js`**:
   - Sorts incoming PR stream chronologically.
   - Groups matching items and plants within the 14-day creation window and $\pm 7$-day need-by window.
   - Propagates emergency urgency flags and stamps requirement date.
3. **`pricingService.js`**:
   - Resolves unit price via the 4-tier waterfall: usable contract rate → lowest applicable contract rate → 365-day recent PO price from Active supplier → item standard price.
4. **`rankingService.js`**:
   - Filters Active suppliers with POs in 548 days or contracts covering the item.
   - Computes weighted composite score ($\text{PO count} \times 2 + \text{Recency} \times 30 + \text{Contract} \times 15 + \text{On-Time} \times 0.3 + \text{Quality} \times 4.0$).
   - Tops up sourcing suggestions from matching category suppliers, ranked by $\text{Quality} \times 20 + \text{On-Time}$.
5. **`consolidationService.js`**:
   - Consolidates requirements ending in POs with the same supplier, plant, and route raised within 24 hours into unified `po_id`s (`PO-0001`, `PO-0002`).

---

## 6. Verification and Test Results
- **Automated Test Suite:** Built with Jest, testing item matching, clubbing, pricing waterfall, ceiling exhaustion, preferred supplier ranking, and PO consolidation against all 14 worked examples.
- **Accuracy:** 100% agreement with all worked examples in `Worked_Examples.pdf`.

