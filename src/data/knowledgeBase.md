# Chargeback Resolution Knowledge Base

## Overview

This knowledge base documents Meridian Bank's AI-powered chargeback dispute resolution system, orchestrated by Pega Smart Dispute with Pace as the intelligent evidence analysis and decision engine. The system handles Visa CE 3.0 chargebacks with end-to-end automation, HITL intervention only when required, and cost-benefit analysis for pre-arbitration decisions.

---

## Visa Reason Codes (CE 3.0)

### 10.4 — Other Fraud, Card-Absent Environment

**Definition**: Cardholder claims they did not authorize a card-not-present transaction.

**Common Scenarios**:
- Unauthorized online purchase
- Stolen card details used for e-commerce
- Account takeover fraud

**Compelling Evidence Requirements (CE 3.0)**:
- **IP address, email, physical address match** to previous undisputed transactions
- **Device fingerprinting** (same browser/device used before)
- **Frictionless 3D Secure authentication** (challenge-free 3DS with risk-based approval)
- **Cardholder communication** showing awareness of transaction

**Pace Evidence Scoring**: Must score ≥ 75/100 for auto-accept representment.

---

### 13.1 — Merchandise/Services Not Received

**Definition**: Cardholder claims merchandise was not received (or service not rendered).

**Common Scenarios**:
- Package marked delivered but cardholder denies receipt
- Service subscription not activated
- Digital goods not accessible

**Compelling Evidence Requirements (CE 3.0)**:
- **Proof of delivery** with signature or electronic confirmation
- **Tracking information** showing delivery to cardholder's address
- **GPS/geolocation data** from carrier confirming delivery location accuracy
- **Prior delivery history** to the same address (establishes pattern)

**Pace Evidence Scoring**: Delivery signature + GPS match + prior undisputed deliveries = 95/100 (strong case).

---

### 13.3 — Not as Described or Defective Merchandise/Services

**Definition**: Cardholder received merchandise but claims it was materially different from description or defective.

**Common Scenarios**:
- Product quality issues
- Counterfeit or wrong item shipped
- Service not performed as advertised
- **Friendly fraud** (customer uses chargeback instead of return process)

**Compelling Evidence Requirements**:
- **Product description accuracy** (exact match to listing)
- **Quality assurance documentation** (photos, inspection reports)
- **Customer service interaction logs** showing no prior complaint
- **Return policy documentation** proving customer failed to follow merchant's process
- **Contradictory evidence** (customer reviews, social media posts praising product)

**Friendly Fraud Detection**: Pace analyzes email sentiment, social media activity, and multi-dispute patterns. Evidence score ≥ 85/100 triggers fraud narrative.

---

## System Architecture

### Component Stack

| System | Role | Integration |
|--------|------|-------------|
| **Pega Smart Dispute** | Workflow orchestrator, case lifecycle management | Primary platform |
| **Pace** | Evidence intelligence, fraud scoring, rebuttal generation | Pega API |
| **VROL (Visa Resolve Online)** | Chargeback submission, status tracking, evidence upload | HTTPS API |
| **FedEx/UPS APIs** | Tracking data, delivery proof, GPS coordinates | REST API |
| **SAP S/4HANA** | Merchant transaction history, product data | OData API |
| **Salesforce** | Customer communication logs, service tickets | REST API |
| **UiPath** | Minimal RPA for legacy system data extraction | Orchestrator API |

### Pace Intelligence Layer

**Inputs**:
- Chargeback notification from VROL (ARN, reason code, amount, cardholder details)
- Merchant transaction record from SAP (order ID, amount, timestamp, merchant name)
- Delivery data from carrier APIs (tracking number, signature, GPS, timestamps)
- Customer interaction logs from Salesforce (emails, chats, tickets)
- Historical dispute data (cardholder's prior chargebacks, merchant's win rate)

**Outputs**:
- **Evidence Score (0-100)**: Likelihood of winning representment
- **Fraud Risk Score (0-100)**: Likelihood of friendly fraud
- **Recommended Action**: Accept, Dispute, or Escalate to HITL
- **Generated Rebuttal Letter**: Pre-filled with compelling evidence citations
- **Cost-Benefit Analysis**: For pre-arbitration decisions

---

## Evidence Scoring Framework

### Scoring Algorithm

Pace assigns a **0-100 evidence score** based on weighted factors:

| Factor | Weight | Scoring Criteria |
|--------|--------|------------------|
| **Delivery Proof** | 35% | Signature (30pts), GPS match >95% (5pts) |
| **Prior Transaction History** | 25% | 2+ undisputed deliveries to same address (25pts) |
| **Cardholder Communication** | 20% | Email/chat acknowledgment (15pts), positive sentiment (5pts) |
| **3DS Authentication** | 15% | Frictionless 3DS (15pts), challenge 3DS (10pts) |
| **Device/IP Fingerprint** | 5% | Match to prior transactions (5pts) |

**Decision Thresholds**:
- **≥ 75**: Auto-accept representment (no HITL)
- **50-74**: Escalate to HITL for review
- **< 50**: Auto-decline (accept liability, faster resolution, lower costs)

### Fraud Risk Scoring

For RC 13.3 cases, Pace calculates a **fraud likelihood score**:


| Red Flag | Points | Detection Method |
|----------|--------|------------------|
| **Email sentiment contradiction** | 25pts | NLP analysis: praise email → defect claim |
| **Social media product posts** | 20pts | Instagram/Facebook scraping for unboxing/review |
| **Multiple simultaneous disputes** | 30pts | Same cardholder, different merchants, same timeframe |
| **High dispute-to-transaction ratio** | 15pts | Cardholder has >3 disputes in 6 months |
| **No prior customer service contact** | 10pts | Zero emails/calls before chargeback |

**Fraud Thresholds**:
- **≥ 60**: High confidence friendly fraud → generate fraud narrative rebuttal
- **40-59**: Moderate risk → HITL review with fraud indicators flagged
- **< 40**: Likely legitimate complaint → standard defect rebuttal

---

## SLA Rules

### Evidence Gathering Phase
- **Trigger**: Chargeback notification received from VROL
- **Deadline**: 4 hours to collect all evidence
- **Activities**:
  - Query carrier APIs for delivery data
  - Pull transaction record from SAP
  - Retrieve customer communications from Salesforce
  - Fetch historical dispute data
- **HITL Trigger**: API timeout or missing critical data (e.g., tracking number not found)

### Rebuttal Review Phase
- **Trigger**: Evidence score 50-74 OR fraud score 40-59
- **Deadline**: 24 hours for analyst review
- **HITL Decision**: Approve rebuttal, request additional evidence, or decline case

### VROL Filing Phase
- **Trigger**: Auto-approved (score ≥75) OR HITL-approved rebuttal
- **Deadline**: 48 hours to submit via VROL API
- **Submission**: Upload rebuttal PDF, supporting documents (delivery proof, emails)

### Resolution Timeline
- **Visa Standard**: 30 days from representment submission
- **Pre-Arbitration**: If merchant loses, 10-day window for pre-arb decision
- **Arbitration**: $500 filing fee, 45-day Visa ruling

---

## Rebuttal Letter Standards

### Structure (CE 3.0 Compliance)

**Header Section**:
- Case ID, ARN (Acquirer Reference Number)
- Merchant name, cardholder name, dispute amount
- Reason code + CE 3.0 rule citation

**Evidence Summary**:
- Bulleted list of compelling evidence with rule references
- Quantified metrics (GPS accuracy %, prior delivery count, 3DS result)

**Narrative Section** (for fraud cases):
- Timeline of contradictory behavior
- Specific evidence of cardholder awareness/use
- Pattern analysis (multi-dispute behavior)

**Conclusion**:
- Recommended outcome (reverse chargeback)
- Contact information for questions

### Example Opening (RC 13.1)

```
Re: Representment Rebuttal — Visa Reason Code 13.1 (Merchandise Not Received)
Case ID: CHB-2026-0147 | ARN: 7729-4481-0037-2841
Cardholder: James R. Patterson | Amount: $2,847.00
Merchant: NovaTech Electronics

COMPELLING EVIDENCE (Visa CE 3.0):

- Delivery Confirmation: FedEx tracking #7729-4481-0037 shows delivery on Feb 24, 2026 at 2:14 PM
- Signature Obtained: Package signed by "J. Patterson"
- GPS Verification: Delivery coordinates 99.2% match to cardholder's registered address
- Prior Transaction History: 2 previous deliveries to same address (Jan 12, Feb 3) without dispute
```

### Example Opening (RC 13.3 Friendly Fraud)

```
Re: Fraud Narrative Rebuttal — Visa Reason Code 13.3 (Not as Described)
Case ID: CHB-2026-0289 | ARN: 8841-2293-0156-7723
Cardholder: Sarah M. Chen | Amount: $6,420.00
Merchant: Artisan Home Furnishings

FRIENDLY FRAUD INDICATORS:

- Email Contradiction: Cardholder sent praise email on Feb 18 ("Absolutely love the sectional!"), filed defect claim Feb 22
- Social Media Evidence: Instagram post dated Feb 16 shows unboxing video with positive caption
- Multi-Dispute Pattern: Concurrent dispute filed with Urban Loft Furniture ($3,180), total disputed $9,600 within 6 days
- Zero Prior Contact: No customer service tickets, emails, or calls before chargeback
```

---

## HITL Trigger Conditions

Pace escalates cases to human analyst review when:

### Automatic Triggers
1. **Evidence Score 50-74**: Borderline cases requiring judgment
2. **Fraud Score 40-59**: Moderate fraud risk, unclear friendly fraud vs. legitimate complaint
3. **Missing Critical Data**: Carrier API timeout, tracking number invalid, signature unavailable
4. **High-Value Cases**: Dispute amount > $10,000 (risk threshold)
5. **Pre-Arbitration Decisions**: Cost-benefit analysis below confidence threshold

### HITL Interface (Pega)
- **Radio button approval**: Approve/Decline/Request More Evidence
- **Evidence detail panel**: Expandable sections for delivery proof, customer comms, fraud indicators
- **Rebuttal preview**: Generated letter with edit capability
- **Timeline view**: SLA countdown, case milestones

---

## Cost-Benefit Analysis for Pre-Arbitration

When a representment is **rejected by Visa** (merchant loses first round), Pace calculates whether to proceed to arbitration.

### Cost Factors
- **Arbitration filing fee**: $500 (non-refundable)
- **Analyst time**: ~4 hours @ $75/hr = $300
- **Legal review** (optional): $500-1,500
- **Total cost**: ~$1,300 minimum

### Benefit Factors
- **Dispute amount**: Recovery value if arbitration won
- **Win probability**: Historical arbitration success rate for similar cases
- **Expected value**: (Dispute amount × Win probability) - Costs

### Decision Rule
- **EV > $500**: Recommend arbitration
- **EV $0-$500**: Escalate to HITL (marginal case)
- **EV < $0**: Auto-decline, accept liability

### Example Calculation (CHB-2026-0412)

```
Dispute Amount: $1,180.00
Win Probability: 35% (frictionless 3DS insufficient, IP mismatch not addressed in representment)
Arbitration Costs: $1,300

Expected Value: ($1,180 × 0.35) - $1,300 = $413 - $1,300 = -$887

Recommendation: DECLINE arbitration. Accept liability. Faster resolution, lower total cost.
```

**HITL Override**: Analyst can override if there's strategic value (e.g., precedent-setting case, merchant relationship priority).

---

## Workflow States

| State | Description | Next Action |
|-------|-------------|-------------|
| **Ready** | New chargeback received, pending evidence collection | Auto-trigger Pace analysis |
| **Analyzing** | Pace gathering evidence from APIs | Wait for scoring results |
| **HITL Review** | Escalated to analyst | Analyst approval via Pega |
| **Rebuttal Approved** | Ready for VROL submission | Upload to VROL API |
| **Submitted** | Filed with Visa via VROL | Wait 30 days for Visa decision |
| **Won** | Visa reversed chargeback | Case closed, funds recovered |
| **Lost - Pre-Arb Pending** | Representment rejected | Pace runs cost-benefit analysis |
| **Arbitration Filed** | Escalated to Visa arbitration | Wait 45 days for ruling |
| **Closed - Accepted Liability** | Merchant accepts chargeback | Refund cardholder |

---

## Integration Details

### VROL API
- **Endpoint**: `https://vrol.visa.com/api/v2/disputes`
- **Authentication**: OAuth 2.0 client credentials
- **Key Operations**:
  - `GET /disputes/{arn}` — Fetch chargeback details
  - `POST /disputes/{arn}/representment` — Submit rebuttal + evidence
  - `GET /disputes/{arn}/status` — Check Visa decision

### FedEx/UPS APIs
- **Tracking**: `GET /track/v1/trackingnumbers/{trackingNumber}/shipmentdetails`
- **Proof of Delivery**: Returns signature image, GPS coordinates, delivery timestamp
- **GPS Accuracy**: Pace calculates haversine distance between delivery coords and cardholder address

### Pega Smart Dispute Integration
- **Case Creation**: VROL webhook → Pega case creation → Pace API call
- **HITL Workflow**: Pega presents Pace-generated evidence summary + rebuttal draft
- **Approval Actions**: Radio button submit → Pace receives approval signal → VROL submission

---

## Key Metrics

### Performance Targets
- **Auto-resolution rate**: ≥ 70% (no HITL)
- **Representment win rate**: ≥ 65%
- **SLA compliance**: ≥ 95% within 48-hour filing window
- **Cost per case**: < $50 (including Pace API + analyst time)

### Current Performance (Feb 2026)
- Auto-resolution: 73%
- Win rate: 68%
- SLA compliance: 97%
- Average cost: $42/case

---

## Common Questions

**Q: What happens if carrier API is down during evidence gathering?**
A: Pace triggers HITL with "Missing Evidence" flag. Analyst can manually pull tracking data from carrier web portal or decline case if delivery proof is critical.

**Q: How does Pace detect Instagram/social media posts?**
A: Graph API integrations (when cardholder profile is public) + manual analyst search during HITL review. Not all cases have social media evidence; it's a bonus signal for friendly fraud detection.

**Q: Can merchants override Pace's auto-decline recommendation?**
A: Yes. HITL analysts can override and force representment submission if they have additional context (e.g., high-value customer relationship, strategic precedent).

**Q: What's the arbitration success rate for Meridian Bank?**
A: Historical data: 42% win rate in arbitration. Pace factors this into EV calculations.

**Q: How are VROL credentials managed?**
A: Stored in Pega credential vault, rotated every 90 days per Visa security requirements.

---

## Version History

- **v2.1** (March 2026): Added friendly fraud detection for RC 13.3, integrated Instagram Graph API
- **v2.0** (January 2026): Migrated from Visa CE 2.0 to CE 3.0 rule framework
- **v1.5** (November 2025): Introduced pre-arbitration cost-benefit analysis
- **v1.0** (August 2025): Initial deployment with Pega Smart Dispute + Pace integration
