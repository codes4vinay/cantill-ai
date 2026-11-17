# Corvo Procurement Decision Engine (PR-to-PO Platform)
**Cantill.ai Full-stack Intern Challenge (Round 1)**  
**Candidate Submission Repository**  
**Tech Stack:** MERN (MongoDB, Express.js, React 18, Node.js) • Tailwind CSS • Vite  
**Deployment Target:** Frontend on **Vercel**, Backend on **Render**, Database on **MongoDB Atlas** (Zero Docker)

---

## 1. Executive Summary & Core Capabilities

The **Corvo Procurement Decision Engine** is an end-to-end autonomous procurement web application designed to eliminate human bottlenecks in manufacturing purchasing. Employees raise purchase requests (PRs) via a conversational AI chat assistant or bulk CSV batch uploader, and the system automatically determines whether to generate a direct Purchase Order (`CONTRACT_PO`, `SPOT_PO`, `EMERGENCY_PO`) or initiate competitive sourcing (`RFQ`, `RFP`, `NEW_ITEM_SOURCING`) in strict compliance with the **Corvo Procurement Policy (v5.0)**.

### Key Pillars:
1. **Conversational PR Intake (Employee UI):**
   - Natural language understanding extracts items, quantities, plants (`CHK1` Chakan vs `PUN1` Pune), need-by dates, urgency, and capex tags.
   - Factory jargon and abbreviation normalization (`brg` → `bearing`, `hyd` → `hydraulic`, `cyl` → `cylinder`, `rod` → `electrode`).
   - Missing input detection: asks clarifying follow-up questions for missing quantities, plants, or dates.
   - Detects non-catalog items and routes them to `NEW_ITEM_SOURCING` while requesting estimated unit prices.
2. **Policy as Data (Zero-Code Policy Amendments):**
   - The procurement policy is modeled as versioned data rather than hardcoded logic.
   - Procurement admins can paste amendment text, adjust clause sliders, preview side-by-side **plain-English diffs**, and activate new versions (`v5.1`, `v6.0`) with immediate effect on future decisions without code changes or redeployments.
3. **Deterministic Multi-Tier Decision Engine:**
   - **4-Tier Valuation Waterfall:** Tier 1 (Active Rate Contract) → Tier 2 (Last PO in 12M) → Tier 3 (Volume-Weighted Average in 18M) → Tier 4 (Engineering Catalog / Estimated).
   - **PR Clubbing:** Automatically groups PR lines by item and plant within a 14-day creation window and 7-day need-by cluster span (Clause 1.2 & 2.1). New items are never clubbed.
   - **Rules Engine (Clauses 5.1–5.7):** Evaluates contract validity and ceiling headroom, emergency purchase continuity, spot limits (≤ ₹2,00,000), RFQ thresholds (₹2,00,000 – ₹10,00,000; min 3 quotes), RFP thresholds (> ₹10,00,000; min 4 quotes), Capex sourcing, and non-catalog qualification.
   - **PO Consolidation (Section 6):** Groups PO requirements into single Purchase Orders when sharing the same supplier, plant, and route within a 24-hour creation window.
4. **Preferred Supplier Ranking Engine:**
   - Implements the multi-attribute scoring model:
     $$\text{Score} = (\text{POs}_{548d} \times 2) + (\text{Recency} \times 30) + (\text{Contract\_Held} \times 15) + (\text{On\_Time\_Pct} \times 0.3) + (\text{Quality} \times 4.0)$$
   - Category top-up algorithm for sourcing quotes: $\text{Category\_Score} = (\text{Quality} \times 20) + \text{On\_Time\_Pct}$.
   - One-click CSV export as of any date (`item_code, rank, supplier_id, reference_price`).
5. **Buyer Workspace:**
   - Interactive review table with badge-coded routes, clause citations, and clubbed PR line details.
   - One-click approval generating PO numbers.
   - **Audited Overrides:** Requires a mandatory written comment to bypass policy decisions, enforcing compliance governance.
6. **Contract Register & PDF Ingestion:**
   - Visual progress bars for real-time contract ceiling consumption and remaining headroom.
   - Built-in PDF parser for uploading rate contract agreements (e.g. `RC-2026-031`, `RC-2026-033`).

---

## 2. Repository Structure

```
cantill-procurement-app/
├── client/                     # Frontend SPA (React 18, Vite, Tailwind CSS)
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx              # Navigation and live engine status
│   │   │   ├── ChatIntake.jsx          # Conversational intake & batch CSV upload
│   │   │   ├── BuyerWorkspace.jsx      # Review, approvals, and audited overrides
│   │   │   ├── PolicyManager.jsx       # Policy-as-data diff and activation studio
│   │   │   └── SuppliersContracts.jsx  # Preferred rankings & contract ceiling bars
│   │   ├── services/
│   │   │   └── api.js                  # Axios client connecting to backend
│   │   ├── App.jsx                     # Master React layout
│   │   ├── main.jsx                    # Root render
│   │   └── index.css                   # Tailwind styles
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── vercel.json                     # Vercel SPA routing configuration
│   └── package.json
├── server/                     # Backend API & Engine (Express, Node.js, MongoDB)
│   ├── config/
│   │   └── db.js                       # Mongoose connection with resilient fallback
│   ├── engine/
│   │   ├── itemMatcher.js              # NLP jargon expansion & spec matching
│   │   ├── clubbingService.js          # 14-day creation & 7-day need-by clubbing
│   │   ├── pricingService.js           # 4-tier valuation waterfall
│   │   ├── rankingService.js           # Preferred supplier & category scoring
│   │   ├── decisionRules.js            # Policy-driven clauses 5.1 - 5.7
│   │   ├── consolidationService.js     # 24-hour PO consolidation
│   │   ├── pdfContractParser.js        # PDF contract metadata & line extraction
│   │   └── policyService.js            # Policy versioning & plain-English diffs
│   ├── models/                         # Mongoose schemas
│   │   ├── Item.js
│   │   ├── Supplier.js
│   │   ├── POHistory.js
│   │   ├── Contract.js
│   │   ├── Policy.js
│   │   ├── Requirement.js
│   │   └── AuditLog.js
│   ├── routes/
│   │   ├── batchRoutes.js              # POST /api/process-batch & CSV export
│   │   ├── chatRoutes.js               # POST /api/chat conversational intake
│   │   ├── buyerRoutes.js              # Requirements review, approve, override
│   │   ├── policyRoutes.js             # Policy diff & activation
│   │   ├── supplierRoutes.js           # Preferred rankings & CSV download
│   │   └── contractRoutes.js           # Contract register & PDF uploader
│   ├── services/
│   │   └── seedService.js              # CSV master data & contract loader
│   ├── tests/
│   │   └── engine.test.js              # Automated Jest tests for all 14 worked examples
│   ├── server.js                       # Express app bootstrap
│   └── package.json
├── submission/                 # Destination for Blind Test CSV deliverables
│   └── README.txt
├── render.yaml                 # 1-Click Render.com deployment manifest
├── package.json                # Root package.json with concurrent dev runner
├── .gitignore                  # Excludes task data files, node_modules, and secrets
├── README.md                   # This document
├── APPROACH.md                 # Technical architecture & AI tools disclosure
└── DECISIONS.md                # Mathematical proofs & edge-case interpretations
```

---

## 3. Quick Start & Local Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **MongoDB** *(Optional)*: Local MongoDB instance running on `localhost:27017` or MongoDB Atlas URI. *(Note: The application includes a built-in in-memory fallback store, allowing full functionality even if MongoDB is not locally installed!)*

### Step 1: Clone Repository
```bash
git clone <YOUR_PUBLIC_REPO_URL>
cd cantill-procurement-app
```

### Step 2: Install Dependencies
Run the unified installer from the root directory:
```bash
npm run install:all
```
*(This automatically installs root, backend `server`, and frontend `client` packages).*

### Step 3: Start Development Servers
```bash
npm run dev
```
- **Backend API:** `http://localhost:5000`
- **Frontend UI:** `http://localhost:5173`
- Open your browser at `http://localhost:5173` to interact with the platform.

### Step 4: Run Automated Tests
Execute the Jest test suite verifying mathematical convergence and decision rules against all 14 worked examples:
```bash
npm test
```

---

## 4. Deployment Guide

### A. Deploy Backend on Render (Render.com)
1. Push your repository to GitHub.
2. Sign in to [Render](https://render.com) and click **New → Web Service**.
3. Select your repository.
4. Configure service settings:
   - **Name:** `corvo-procurement-server`
   - **Root Directory:** `server`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance Type:** `Free`
5. Under **Environment Variables**, add:
   - `PORT`: `5000`
   - `NODE_ENV`: `production`
   - `MONGODB_URI`: `<Your_MongoDB_Atlas_Connection_String>` (or leave empty to use resilient in-memory store)
6. Click **Create Web Service**. Note your backend URL (e.g. `https://corvo-procurement-server.onrender.com`).

*(Alternatively, connect via `render.yaml` for 1-click blueprint deployment).*

### B. Deploy Frontend on Vercel (Vercel.com)
1. Sign in to [Vercel](https://vercel.com) and click **Add New → Project**.
2. Select your GitHub repository.
3. Configure the project:
   - **Framework Preset:** `Vite`
   - **Root Directory:** `client`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Under **Environment Variables**, add:
   - `VITE_API_URL`: `https://<your-render-backend-url>/api`
5. Click **Deploy**. Vercel will build and deploy the SPA. The provided `client/vercel.json` ensures client-side routing works seamlessly.

---

## 5. API Specification

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | System health check, active policy version, and cache stats |
| `POST` | `/api/process-batch` | Process PR batch CSV; accepts `multipart/form-data` or JSON body. Add `?format=csv` for direct CSV download |
| `POST` | `/api/chat` | Conversational PR intake assistant; extracts entities, handles missing fields, evaluates policy |
| `GET` | `/api/buyer/requirements` | Fetch clubbed requirements with query filters (`route`, `plant`, `status`, `search`) |
| `POST` | `/api/buyer/approve/:id` | Approve requirement and assign PO/RFQ reference |
| `POST` | `/api/buyer/override/:id` | Override route or supplier; enforces **mandatory comment** justification |
| `GET` | `/api/buyer/export-csv` | Download all current requirements in official submission CSV format |
| `GET` | `/api/policy` | Fetch active policy parameters and historical versions |
| `POST` | `/api/policy/preview-diff` | Preview side-by-side plain-English diff of proposed clause amendments |
| `POST` | `/api/policy/activate` | Activate new policy version without code changes |
| `GET` | `/api/suppliers/preferred` | Calculate preferred supplier rankings as of `?as_of_date=YYYY-MM-DD` |
| `GET` | `/api/suppliers/preferred/export-csv` | Download `yourname__preferred.csv` format (Top 3 suppliers per item) |
| `GET` | `/api/contracts` | Fetch contract register with real-time ceiling consumption and headroom |
| `POST` | `/api/contracts/upload-pdf` | Upload and parse new rate contract PDF |

---

## 6. Blind Test Protocol (Thursday 19 Nov)

During the blind test window, when the new test dataset (`new_pr_batch.csv`) and policy amendment are released:

1. **Policy Update (Zero Code Change):**
   - Open the **Policy Manager** tab on the hosted app.
   - Enter the policy amendment details or paste the amendment document.
   - Click **Preview Plain-English Diff**, review changes, and click **Approve & Activate** (e.g. `v5.1`).
2. **Execute Run 1 & Run 2:**
   - **Run 1:** Upload the pre-amendment PR batch or invoke `POST /api/process-batch?format=csv` under `v5.0`. Save as `submission/yourname__run1.csv`.
   - **Run 2:** Upload the post-amendment PR batch under `v5.1`. Save as `submission/yourname__run2.csv`.
3. **Generate Preferred Suppliers List:**
   - Open **Suppliers & Contracts** → **Export Preferred CSV** as of the test date. Save as `submission/yourname__preferred.csv`.
4. **Git Push:**
   - Commit and push only the three CSV files to the `submission/` directory before 12:00 noon IST:
     ```bash
     git add submission/*.csv
     git commit -m "Submit blind-test run outputs"
     git push origin main
     ```

---

## 7. Compliance & Standards

- **Task Data Isolation:** As required by task guidelines, `.gitignore` strictly excludes `data/`, `master_data/`, `contracts/`, and `pr_batches/` from being pushed to the public Git repository.
- **AI Disclosure:** Full disclosure of AI tools utilized during development and within the application is documented in [APPROACH.md](file:///C:/Users/kumar/OneDrive/Desktop/cantill-procurement-app/APPROACH.md).
- **Assumptions & Edge Cases:** All business assumptions and mathematical proofs are documented in [DECISIONS.md](file:///C:/Users/kumar/OneDrive/Desktop/cantill-procurement-app/DECISIONS.md).

