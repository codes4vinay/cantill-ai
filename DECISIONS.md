# DECISIONS.md — Business Assumptions & Policy Interpretations
**Company:** Corvo Engineering Pvt Ltd  
**System:** Policy-Driven PR-to-PO Decision Engine  
**Author:** Full-stack Intern Candidate  
**Submission Date:** November 2026  

---

## 1. Overview & Purpose
The Corvo Procurement Policy (v5.0) sets clear boundaries for automated purchase decisions, but practical procurement data contains edge cases and operational ambiguities. In accordance with the task brief, this document records all assumptions, business judgments, and algorithm designs applied in the system.

Every decision below is backed by business logic, verified against the 14 worked examples in `Worked_Examples.pdf`, and implemented consistently in the engine.

---

## 2. Item Identification & Matching (Policy Section 1)

### Decision 2.1: Matching Precedence
* **Observation:** Requesters may provide an explicit item code, a short description, or a free-text phrase with factory jargon (e.g., `"brg 6308 ZZ for maintenance"`).
* **Decision:**
  1. If `item_code` is provided and exists in `item_master.csv`, accept it immediately.
  2. If `item_code` is missing, `(none)`, or blank, clean the description (strip punctuation, expand standard abbreviations: `brg` → `bearing`, `hyd` → `hydraulic`, `pneu` → `pneumatic`, `cyl` → `cylinder`, `rod` → `electrode`), and strip contextual noise phrases (`for maintenance`, `as per sample`, `urgent`, `required`).
  3. Compute token overlap and sequence similarity against normalized descriptions in the item master. If all numerical specifications in the input match the item (e.g., `6308`, `50x100`, `24`), boost the confidence score.
  4. If similarity is $\ge 0.55$, resolve to that item code.
  5. If similarity is $< 0.55$, classify as `NEW` (Route: `NEW_ITEM_SOURCING`).
* **Why:** Prevents false positives while correctly matching all shorthand descriptions from the sample batch (e.g., matching `brg 6308 ZZ for maintenance` to `ITM-1022` with 1.0 confidence, matching Worked Example 3).

### Decision 2.2: New Item Valuation & Clubbing
* **Observation:** Clause 1.2 states new items are valued at $\text{quantity} \times \text{estimated unit price}$ and are never clubbed.
* **Decision:**
  - If a requester provides an estimated unit price, use it. If not provided or 0, default estimated value to 0 and flag in Buyer Workspace for manual estimation.
  - New items are assigned a unique `group_id` per line and never merged into existing requirements.
  - Suggested suppliers for `NEW_ITEM_SOURCING` are strictly left empty (`""`), as the policy specifies that buyers must identify suppliers for novel items (Clause 6.4).

---

## 3. Requirement Clubbing & Time Windows (Policy Section 2)

### Decision 3.1: Clubbing Identity & Windows
* **Observation:** Clause 2.2 defines clubbing: same item, same plant, created within 14 calendar days of the requirement's first line, and need-by date within $\pm 7$ days of the first line's need-by date.
* **Decision:**
  - Input lines are sorted deterministically: `created_at` (ascending), then `pr_no` (ascending), then `pr_line` (ascending).
  - A line joins the *earliest* active requirement that satisfies:
    $$\Delta t_{\text{create}} = (\text{line.created\_at.date} - \text{req.first\_created\_at.date}) \in [0, 14 \text{ days}]$$
    $$|\text{line.need\_by.date} - \text{req.first\_need\_by.date}| \le 7 \text{ days}$$
  - Lines for different plants (`PUN1` vs `CHK1`) are **never** clubbed, even if item and dates match (as demonstrated in Worked Example 6: `PR-26-00106/1` at PUN1 and `PR-26-00103/1` at CHK1).

### Decision 3.2: Requirement Date Stamping & Urgency
* **Observation:** Clause 2.3 states the requirement date is the creation date of its first line.
* **Decision:**
  - All downstream temporal checks (contract validity, 365-day PO history, 548-day preferred supplier lookback) use `requirement.requirement_date` ($T_{\text{req}}$).
  - If *any* PR line in a clubbed requirement is marked `Emergency`, the entire requirement inherits `is_emergency = true`.

---

## 4. Requirement Valuation (Policy Section 3)

### Decision 4.1: Valuation Precedence Order
* **Observation:** Clause 3.1 states unit price is chosen from:
  1. Rate of the contract that will be used (Clause 4.3).
  2. If all applicable contracts are out of ceiling, the *lowest* applicable contract rate.
  3. Most recent PO price for the item in the 365 days prior to $T_{\text{req}}$ (from an `Active` supplier).
  4. Item master `standard_price`.
* **Decision:**
  - Evaluated in strict order (1) → (2) → (3) → (4).
  - When looking up recent PO history (step 3), only consider POs from suppliers whose current status is `Active` and whose `po_date` $\le T_{\text{req}}$ and $\ge (T_{\text{req}} - 365 \text{ days})$.
  - If multiple POs exist on the latest date, pick the one with the highest PO number to ensure deterministic pricing.
  - Requirement total value:
    $$\text{group\_value\_inr} = \text{round}(\text{total\_quantity} \times \text{unit\_price})$$

---

## 5. Contract Application & Ceiling Management (Policy Section 4)

### Decision 5.1: Multiple Contract Arbitration
* **Observation:** Clause 4.3 states: "If more than one contract applies, use the one with the lowest rate that still has enough ceiling."
* **Decision:**
  - Filter applicable contracts: covers the item, $T_{\text{req}} \in [\text{start\_date}, \text{end\_date}]$, and supplier status is `Active`.
  - Sort applicable contracts by `rate` ascending.
  - Select the first contract where:
    $$\text{consumed\_value} + (\text{total\_quantity} \times \text{rate}) \le \text{value\_cap}$$
  - As verified in Worked Example 4 (`Hex bolt M10x40`), `RC-2026-015` (Unbrako) had a lower rate (₹6.84) but insufficient ceiling; the system correctly selected `RC-2026-013` (Precision Fasteners) at ₹7.06.

### Decision 5.2: Chronological Ceiling Depletion
* **Observation:** Requirements consume contract ceilings sequentially.
* **Decision:**
  - Contracts maintain an in-memory/database running `consumed_value`.
  - When a requirement is awarded `CONTRACT_PO`, its value ($\text{quantity} \times \text{contract\_rate}$) is immediately added to `contract.consumed_value`.
  - Signed PDF contracts not yet in the official register (`RC-2026-031` and `RC-2026-033`) start with `consumed_value = 0` on their effective date (Worked Example 2).

---

## 6. Preferred Supplier Ranking Formula (Policy Section 6)

### Decision 6.1: Eligibility Criteria (Clause 6.1)
A supplier is eligible for the preferred supplier list of an item if:
1. Status is `Active` in `supplier_master.csv` (`Blocked` and `Inactive` suppliers are strictly disqualified per Clause 5.7).
2. Has at least one PO for the item in the 548 days before $T_{\text{req}}$, **OR** holds a contract covering the item that started on or before $T_{\text{req}}$ (even if expired).

### Decision 6.2: Weighted Scoring Formula
To balance historical volume, recent engagement, contractual commitment, delivery speed, and quality, we developed the following scoring formula:

$$\text{Score} = (\text{PO\_Count}_{548d} \times 2) + (\text{Recency} \times 30) + (\text{Contract\_Held} \times 15) + (\text{On\_Time\_Pct} \times 0.3) + (\text{Quality\_Rating} \times 4.0)$$

Where:
- $\text{PO\_Count}_{548d}$: Total number of POs placed with this supplier for the item in the 548 days prior to $T_{\text{req}}$.
- $\text{Recency}$:
  - $1.0$ if latest PO was within 90 calendar days ($T_{\text{req}} - \text{po\_date} \le 90$).
  - $0.5$ if latest PO was within 365 calendar days ($91 \le T_{\text{req}} - \text{po\_date} \le 365$).
  - $0.0$ if older than 365 days or no PO.
- $\text{Contract\_Held}$: $1$ if supplier held a contract covering this item started on/before $T_{\text{req}}$, else $0$.
- $\text{On\_Time\_Pct}$: Percentage integer from `supplier_master.csv` ($0 \text{ to } 100$).
- $\text{Quality\_Rating}$: Float rating out of 5.0 from `supplier_master.csv`.

#### Mathematical Verification Against Worked Examples
This formula was calibrated and verified to reproduce 100% of the rankings given in `Worked_Examples.pdf` (Page 5):
1. **ITM-1048 (Nitrile coated gloves):**
   - **S029**: $7 \times 2 + 1.0 \times 30 + 1 \times 15 + 81 \times 0.3 + 3.1 \times 4.0 = 14 + 30 + 15 + 24.3 + 12.4 = \mathbf{95.7}$ → **Rank 1** (Expected: Rank 1)
   - **S030**: $4 \times 2 + 1.0 \times 30 + 0 \times 15 + 72 \times 0.3 + 3.4 \times 4.0 = 8 + 30 + 0 + 21.6 + 13.6 = \mathbf{73.2}$ → **Rank 2** (Expected: Rank 2)
   - **S031**: Inactive → **Excluded**
2. **ITM-1036 (Pneumatic cylinder 50x100):**
   - **S023**: $2 \times 2 + 1.0 \times 30 + 0 + 74 \times 0.3 + 3.9 \times 4.0 = 4 + 30 + 0 + 22.2 + 15.6 = \mathbf{71.8}$ → **Rank 1** (Expected: Rank 1)
   - **S022**: $2 \times 2 + 0.5 \times 30 + 0 + 77 \times 0.3 + 3.5 \times 4.0 = 4 + 15 + 0 + 23.1 + 14.0 = \mathbf{56.1}$ → **Rank 2** (Expected: Rank 2)
   - **S024**: $1 \times 2 + 0.0 \times 30 + 0 + 89 \times 0.3 + 4.1 \times 4.0 = 2 + 0 + 0 + 26.7 + 16.4 = \mathbf{45.1}$ → **Rank 3** (Expected: Rank 3)
3. **ITM-1016 (MIG wire ER70S-6 1.2mm):**
   - **S009**: $1 \times 2 + 0.5 \times 30 + 1 \times 15 + 83 \times 0.3 + 4.6 \times 4.0 = 2 + 15 + 15 + 24.9 + 18.4 = \mathbf{75.3}$ → **Rank 1** (Expected: Rank 1)
   - **S010**: $1 \times 2 + 0.5 \times 30 + 0 \times 15 + 80 \times 0.3 + 3.9 \times 4.0 = 2 + 15 + 0 + 24.0 + 15.6 = \mathbf{56.6}$ → **Rank 2** (Expected: Rank 2)
4. **ITM-1038 (Hydraulic oil HLP 68 - Worked Example 5):**
   - **S024**: $4 \times 2 + 1.0 \times 30 + 0 + 89 \times 0.3 + 4.1 \times 4.0 = 8 + 30 + 0 + 26.7 + 16.4 = \mathbf{81.1}$ → **Rank 1** (Selected for SPOT_PO at ₹166, exactly matching Worked Example 5).

### Decision 6.3: Reference Price Resolution (Clause 6.3)
1. Most recent PO unit price for the item in the 548 days before $T_{\text{req}}$.
2. If supplier has no PO in 548 days, use the rate in its most recent contract covering the item.

### Decision 6.4: Sourcing Supplier Suggestions & Category Top-up (Clause 6.4)
- When RFQ requires 3 suppliers or RFP/Capex requires 5 suppliers:
  1. Take suppliers from the preferred supplier list in rank order.
  2. If preferred count $< N$, top up from other `Active` suppliers that list the item's category in `supplier_master.csv`.
  3. Sort category top-up candidates by composite performance:
     $$\text{Category\_Score} = (\text{quality\_rating} \times 20) + \text{on\_time\_pct}$$
  4. Exclude any supplier already included, and never include Blocked/Inactive suppliers (Rule 5.7).
  - Verified: On `ITM-1006` (Worked Example 10), this produces `S003, S002, S005`. On `ITM-1034` (Worked Example 11), this produces `S020, S017, S019, S018`.

---

## 7. Purchase Order Consolidation (Policy Section 7)

### Decision 7.1: Consolidation Grouping Key
* **Observation:** Clause 7.1 combines requirements that end in a PO into one PO when they share:
  1. Same supplier ID (`supplier_id`)
  2. Same plant (`plant`)
  3. Same route (`route`, e.g., `CONTRACT_PO`, `SPOT_PO`, `EMERGENCY_PO`)
  4. Raised within 24 hours of the *first* requirement on that PO:
     $$0 \le (\text{req.first\_line\_created\_at} - \text{po.first\_req\_created\_at}) \le 24 \text{ hours}$$
* **Decision:**
  - Evaluated chronologically in order of requirement creation time.
  - Sourcing requests (`RFQ`, `RFP`, `CAPEX_SOURCING`, `NEW_ITEM_SOURCING`) are **never** consolidated into POs.
  - Formatted as sequential identifiers (`PO-0001`, `PO-0002`, etc.).

---

## 8. Policy as Data & Amendment Handling

### Decision 8.1: Versioning and Effective Dates
* **Observation:** The app must be able to change how it decides without modifying code when an amendment is uploaded or typed in chat.
* **Decision:**
  - Policies are stored in the database as versioned JSON documents with:
    - `policy_id`, `version`, `name`, `effective_date`, `status` (`ACTIVE`, `DRAFT`, `SUPERSEDED`)
    - Dynamic `parameters` (thresholds, windows, days)
    - Ordered `rules` array (clause, conditions, outcomes)
  - When batch PRs are processed, the engine queries the policy whose `effective_date` $\le T_{\text{req}}$ with status `ACTIVE`.
  - When an amendment is uploaded, the parser extracts changes, creates a new `DRAFT` policy, displays a plain-English diff ("What will change"), and only upon explicit Buyer/Admin approval transitions to `ACTIVE`.

---

## 9. Summary Table of Rules Implemented

| Clause | Name | Trigger Conditions | Route | Decision | Pricing / Supplier |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1.2** | New Item | Item not in Item Master | `NEW_ITEM_SOURCING` | `SOURCING_REQUEST` | Requester estimated price, no suggestions |
| **5.1** | Capex | `item_type == "Capex"` | `CAPEX_SOURCING` | `SOURCING_REQUEST` | Needs capex approval; 5 suggested suppliers |
| **5.2** | Contract PO | Active contract covering item with remaining ceiling | `CONTRACT_PO` | `PO` | Contract supplier at contract rate; ceiling updated |
| **5.3** | Emergency PO | `is_emergency == true`, value $\le$ ₹5,00,000, bought from Active in 365d | `EMERGENCY_PO` | `PO` | 1st preferred supplier at reference price |
| **5.4** | Spot PO | Value $<$ ₹2,00,000, bought from Active in 365d | `SPOT_PO` | `PO` | 1st preferred supplier at reference price |
| **5.5** | RFQ | Value $<$ ₹10,00,000 (including small items not bought in 365d) | `RFQ` | `SOURCING_REQUEST` | 3 suggested suppliers (preferred list + category top-up) |
| **5.6** | RFP | Value $\ge$ ₹10,00,000 | `RFP` | `SOURCING_REQUEST` | 5 suggested suppliers (preferred list + category top-up) |
| **5.7** | Supplier Sanctions | Supplier status `Blocked` or `Inactive` | Hard block | — | Never issue PO or suggest for sourcing |

---

## 10. Round 1 Blind Test & Amendment No. 1 (v5.1)

### 10.1 Blind Test PR Batch Ingestion
* **Dataset:** `hidden_pr_batch.csv` (190 PR lines raised between 23 Nov 2026 and 11 Dec 2026 across plants `CHK1`, `PUN1`, and `PUN2`).
* **Un-coded Line Resolution:** 37 PR lines lacked catalog `item_code` and were resolved using normalized token overlap and technical string matching:
  - `"brg 6308-ZZ"` / `"brg 6308-zz"` → `ITM-1022` (Deep groove ball bearing 6308-ZZ)
  - `"cotton hand gloves"` → `ITM-1047` (Cotton hand gloves)
  - `"Hex nut M10 GR 8"` → `ITM-1010` (Hex nut M10 Gr 8)
  - `"Anchor fastener M12x100"` → `ITM-1013` (Anchor fastener M12x100)
  - `"hex bolt m10x40 gr 8.8"` → `ITM-1009` (Hex bolt M10x40 Gr 8.8)
  - `"Hydraulic press 100 ton"` → `ITM-1072` (Hydraulic press 100 ton - Capex)
  - `"forklift electric 2 ton as per sample"` → `ITM-1073` (Forklift electric 2 ton - Capex)
  - `"slideway oil 220"` → `ITM-1055` (Slideway oil ISO VG 220)
  - `"Copper cable 4 core 6 sqmm"` → `ITM-1031` (Copper cable 4 core 6 sqmm)
  - `"spring washer m10"` → `ITM-1012` (Spring washer M10)
  - `"Toner cartridge HP 88A"` → `ITM-1059` (Toner cartridge HP 88A)
  - `"Gearbox oil seal 45x62x8"` → `ITM-1026` (Oil seal 45x62x8)
* **Non-Catalog / New Items:** 4 items were identified as non-catalog and routed to `NEW_ITEM_SOURCING` (Clause 1.2):
  1. `PR-26-00517/1`: `"housekeeping service for month"`
  2. `PR-26-00668/1`: `"Ultrasonic thickness gauge"`
  3. `PR-26-00669/1`: `"Drinking water purifier 50 LPH"`
  4. `PR-26-00670/1`: `"Thermal imaging camera for maintenance"`

### 10.2 Policy Amendment No. 1 (v5.1) Implementation
The Procurement Committee and CFO approved Amendment No. 1 on 20 November 2026 (effective 1 December 2026), amending `CORVO-PROC-POL-04` to version 5.1:

1. **A1 Packaging Spot Limit (Rule 5.4 Amendment):**
   - For items in the `Packaging` category, the spot purchase threshold is reduced from ₹2,00,000 to ₹1,00,000.
   - Any Packaging requirement $\ge$ ₹1,00,000 cannot be awarded via Spot PO and must be competitively sourced.
   - *Impact:* Requirements for wooden pallets (`ITM-1042`), corrugated boxes (`ITM-1043`), stretch film (`ITM-1044`), and PP strapping (`ITM-1045`) valued between ₹1,20,000 and ₹1,95,000 moved from `SPOT_PO` to `RFQ`.

2. **A2 RFP Threshold Reduction (Rules 5.5 and 5.6 Amendment):**
   - The threshold requiring a formal sealed RFP is lowered from ₹10,00,000 to ₹8,00,000.
   - Sourcing requirements $\ge$ ₹8,00,000 now route to `RFP` requiring 5 quotations; requirements $<$ ₹8,00,000 route to `RFQ` with 3 quotations.
   - *Impact:* Requirements valued between ₹8,00,000 and ₹10,00,000 (e.g., `ITM-1008` MS plate 12mm, `ITM-1018` SS pipe 2 inch, `ITM-1051` Nitrile safety shoes, `ITM-1066` CNC turning center) shifted from `RFQ` to `RFP`.

3. **A3 New Rule 5.2A: Chakan Electrical Safety:**
   - At the Chakan plant (`CHK1`), any requirement in the `Electrical Spares` category valued at ₹50,000 or more must be sourced (`RFQ`, or `RFP` if $\ge$ ₹8,00,000), even if it would otherwise qualify for an emergency or spot PO.
   - **Precedence:** Evaluated *immediately after* Rule 5.2. As explicitly stipulated in the amendment ("A contract PO (rule 5.2) is still allowed"), if an active rate contract exists with remaining ceiling, `CONTRACT_PO` is awarded. If no usable contract exists, the requirement bypasses Rules 5.3 (Emergency) and 5.4 (Spot) and routes directly to competitive sourcing.
   - *Impact:* Multiple electrical items at `CHK1` (MCB 3-pole 32A `ITM-1028`, Contactor 32A `ITM-1029`, Proximity sensor `ITM-1030`, Copper cable `ITM-1031`, Relay 24V DC `ITM-1033`, LED floodlight `ITM-1034`) valued between ₹75,000 and ₹1,65,000 moved from `SPOT_PO`/`EMERGENCY_PO` to `RFQ`.

### 10.3 Temporal Boundaries & Reprocessing
* **Effective Date Application:** Amendment No. 1 has a stated effective date of 1 December 2026.
* **Reprocessing Behavior (Run 2):** When the amendment is uploaded and activated via the app's Policy Manager, the active policy version is updated to v5.1. Reprocessing the batch evaluates requirements under the amended policy parameters (producing `vinaykumar__run2.csv` with `policy_version = 5.1`).
* **Line-Level Sensitivity Analysis:**
  - 18 lines created on or after 1 Dec 2026 directly change routes under the amendment.
  - 6 lines created between 23 Nov and 30 Nov 2026 were also evaluated under v5.1 parameters during the post-amendment batch run. Notably, requirements `PR-26-00671`, `PR-26-00672`, and `PR-26-00673` for `ITM-1042` at `PUN1` form a clubbed cluster spanning 29 Nov to 2 Dec 2026. Under the amended policy, this requirement exceeds the ₹1,00,000 packaging threshold (total value ₹1,43,962) and is routed to `RFQ`.

### 10.4 Preferred Supplier Ranking as of 2026-12-01
* **As-of Date:** Evaluated strictly as of `2026-12-01`.
* **Lookback Windows:**
  - PO History: 548 calendar days prior to 2026-12-01 (1 June 2025 to 1 December 2026).
  - Recency: 90 days (1 September 2026) for 1.0 weight; 365 days (1 December 2025) for 0.5 weight.
* **Contract Integration:** The newly signed PDF contracts `RC-2026-031` (effective 15 Nov 2026) and `RC-2026-033` (effective 20 Nov 2026) are fully active and contribute to contract qualification (+15 points).
  - *Key Shift:* On `ITM-1056` (Laptop i5 16GB 512GB), supplier `S035` (Infoline Systems) was awarded `RC-2026-033` on 20 Nov 2026, boosting its score from Rank 2 (Nov 15) to **Rank 1** as of 2026-12-01, with reference price ₹70,504.11.


