# LegalAId — Indian Rule Engine (IRE)
## 36/36 Tests · 9 Document Families · 61 Document Types

---

## Setup

### 1. Place IRE next to your knowledge-base
```
LegalAId/
├── backend/
├── frontend/
├── knowledge-base/    ← your existing KB
└── IRE/               ← rename LegalAId_IRE to IRE, place here
```

### 2. Install
```bash
cd IRE
npm install
```

### 3. Verify
```bash
node test.integration.js
```
Expected:
```
Loaded 104 clauses · 9 constraint sets · 36/36 ✅
```

---

## API (already wired in your documentService.js)
```js
import { validateDocument } from "../../IRE/engine.js";

const result = await validateDocument(
  "NDA",           // document type
  draft.clauses,   // [{clause_id, category, title, text}]
  {                // optional
    state: "Maharashtra",
    stampDutyPaid: 500,
  }
);

// result.certified   → true / false
// result.risk_level  → "LOW" | "MEDIUM" | "HIGH" | "BLOCKED"
// result.issues      → [{rule_id, severity, message, suggestion, statutory_reference}]
// result._layers     → {blueprint, structural, completeness, execution, semantic,
//                       universal, statutory, illegal, stamp}
```

---

## Risk Levels
| Level | Meaning | Certified? |
|-------|---------|-----------|
| `LOW` | No issues of concern | ✅ Yes |
| `MEDIUM` | Advisory issues only | ✅ Yes |
| `HIGH` | 2+ HIGH severity issues | ✅ Yes (with warning) |
| `BLOCKED` | Any CRITICAL issue | ❌ No |

---

## Adding a New Document Type
One entry in `src/indian-rule-engine/domainRegistry.js`:
```js
MY_DOCUMENT: {
  displayName  : "My Document",
  family       : "CONTRACTS",
  domains      : ["contract"],
  acts         : ["the_indian_contract_act_1872"],
  categories   : ["IDENTITY", "PURPOSE", "GOVERNING_LAW", "SIGNATURE_BLOCK"],
  stampDuty    : true,
  registration : false,
}
```

---

## 61 Document Types · 9 Families
**Contracts:** NDA · Service · Consultancy · Independent Contractor · Supply · Distribution ·
Sales of Goods · Franchise · Agency · MOU · LOI · Addendum · Settlement

**Employment:** Employment Agreement · Offer Letter · Appointment Letter · Separation Agreement

**Property:** Rental · Leave & License · Commercial Lease · Sale Deed · Gift Deed ·
Mortgage Deed · Relinquishment · Partition · Development Agreement

**Corporate:** Shareholders Agreement · Partnership Deed · LLP Agreement · Joint Venture ·
Share Purchase · Asset Purchase · Debenture Trust Deed · Founders Agreement

**Financial:** Loan · Guarantee · Promissory Note · Pledge · Hypothecation

**IP:** IP Assignment · IP Licence · Software Development · SaaS · Privacy Policy

**Family:** Will · Gift Deed (Movable) · Adoption Deed · Divorce Deed · Maintenance Agreement

**Litigation:** Affidavit · Legal Notice · Vakalatnama · Indemnity Bond · Undertaking

**Regulatory:** Power of Attorney · General POA · Special POA · RTI Application · Declaration
