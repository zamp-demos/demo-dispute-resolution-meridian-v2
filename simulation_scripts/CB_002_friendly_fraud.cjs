const fs = require('fs');
const path = require('path');

// --- Configuration ---
const PROJECT_ROOT = path.join(__dirname, '..');
const PUBLIC_DATA_DIR = path.join(PROJECT_ROOT, 'public/data');
const PROCESSES_FILE = path.join(PUBLIC_DATA_DIR, 'processes.json');
const PROCESS_ID = "CHB_002";
const CASE_NAME = "Artisan Home Furnishings — Friendly Fraud Detection";

// --- Helpers ---
const readJson = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : []);
const writeJson = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 4));
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const updateProcessLog = (processId, logEntry, keyDetailsUpdate = {}) => {
    const processFile = path.join(PUBLIC_DATA_DIR, `process_${processId}.json`);
    let data = { logs: [], keyDetails: {}, sidebarArtifacts: [] };
    if (fs.existsSync(processFile)) data = readJson(processFile);

    if (logEntry) {
        const existingIdx = logEntry.id ? data.logs.findIndex(l => l.id === logEntry.id) : -1;
        if (existingIdx !== -1) {
            data.logs[existingIdx] = { ...data.logs[existingIdx], ...logEntry };
        } else {
            data.logs.push(logEntry);
        }
    }

    if (keyDetailsUpdate && Object.keys(keyDetailsUpdate).length > 0) {
        data.keyDetails = { ...data.keyDetails, ...keyDetailsUpdate };
    }
    writeJson(processFile, data);
};

const updateProcessListStatus = async (processId, status, currentStatus) => {
    const apiUrl = process.env.VITE_API_URL || 'http://localhost:3001';
    try {
        const response = await fetch(`${apiUrl}/api/update-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: processId, status, currentStatus })
        });
        if (!response.ok) throw new Error(`Server returned ${response.status}`);
    } catch (e) {
        try {
            const processes = JSON.parse(fs.readFileSync(PROCESSES_FILE, 'utf8'));
            const idx = processes.findIndex(p => p.id === String(processId));
            if (idx !== -1) {
                processes[idx].status = status;
                processes[idx].currentStatus = currentStatus;
                fs.writeFileSync(PROCESSES_FILE, JSON.stringify(processes, null, 4));
            }
        } catch (err) { }
    }
};

const waitForSignal = async (signalId) => {
    console.log(`Waiting for human signal: ${signalId}...`);
    const signalFile = path.join(__dirname, '../interaction-signals.json');

    for (let i = 0; i < 15; i++) {
        try {
            if (fs.existsSync(signalFile)) {
                const content = fs.readFileSync(signalFile, 'utf8');
                if (!content) continue;
                const signals = JSON.parse(content);
                if (signals[signalId]) {
                    delete signals[signalId];
                    const tempSignal = signalFile + '.' + Math.random().toString(36).substring(7) + '.tmp';
                    fs.writeFileSync(tempSignal, JSON.stringify(signals, null, 4));
                    fs.renameSync(tempSignal, signalFile);
                }
                break;
            }
        } catch (e) { await delay(Math.floor(Math.random() * 200) + 100); }
    }

    while (true) {
        try {
            if (fs.existsSync(signalFile)) {
                const content = fs.readFileSync(signalFile, 'utf8');
                if (content) {
                    const signals = JSON.parse(content);
                    if (signals[signalId]) {
                        console.log(`Signal ${signalId} received!`);
                        delete signals[signalId];
                        const tempSignal = signalFile + '.' + Math.random().toString(36).substring(7) + '.tmp';
                        fs.writeFileSync(tempSignal, JSON.stringify(signals, null, 4));
                        fs.renameSync(tempSignal, signalFile);
                        return true;
                    }
                }
            }
        } catch (e) { }
        await delay(1000);
    }
};

(async () => {
    console.log(`Starting ${PROCESS_ID}: ${CASE_NAME}...`);

    writeJson(path.join(PUBLIC_DATA_DIR, `process_${PROCESS_ID}.json`), {
        logs: [],
        keyDetails: {
            "Case ID": "CHB-2026-0289",
            "Reason Code": "Visa 13.3 — Not as Described / Defective",
            "Amount": "$6,420.00",
            "Cardholder": "Sarah M. Chen",
            "Merchant": "Artisan Home Furnishings",
            "Card Last 4": "3356"
        }
    });

    const steps = [
        {
            id: "step-1",
            title_p: "Pega Smart Dispute — Ingesting case CHB-2026-0289...",
            title_s: "Pega Smart Dispute — Case Intake Received",
            reasoning: [
                "Webhook received from Visa VROL — new chargeback filed",
                "Case ID: CHB-2026-0289",
                "Reason Code: Visa 13.3 — Not as Described / Defective Merchandise",
                "Dispute amount: $6,420.00",
                "Cardholder: Sarah M. Chen (card ending 3356)",
                "Merchant: Artisan Home Furnishings (MCC 5712 — Furniture Stores)",
                "Transaction date: February 10, 2026",
                "Cardholder claim: 'Dining set arrived damaged, legs broken'",
                "Pega case created — routing to Pace intelligence layer"
            ],
            artifacts: [{
                id: "case-intake",
                type: "json",
                label: "Pega Case Details",
                data: {
                    case_id: "CHB-2026-0289",
                    reason_code: "Visa 13.3",
                    amount: "$6,420.00",
                    cardholder: "Sarah M. Chen",
                    merchant: "Artisan Home Furnishings",
                    mcc: "5712",
                    transaction_date: "2026-02-10"
                }
            }]
        },
        {
            id: "step-2",
            title_p: "Querying Salesforce CRM for cardholder dispute history...",
            title_s: "Salesforce CRM — Prior Dispute Found (Luxe Bedding Co, $3,180)",
            reasoning: [
                "Salesforce CRM — Customer history for Sarah M. Chen:",
                "  Prior dispute: January 28, 2026 — Luxe Bedding Co, $3,180.00",
                "  That dispute also used RC 13.3 (Not as Described)",
                "  Prior dispute outcome: Refund granted (merchant did not contest)",
                "  Same claim language used: 'arrived damaged'",
                "  Two RC 13.3 disputes in 25 days is a significant red flag",
                "",
                "Escalating to merchant records for corroboration"
            ],
            artifacts: [{
                id: "salesforce-history",
                type: "json",
                label: "Salesforce Dispute History",
                data: {
                    prior_disputes: 1,
                    prior_dispute_merchant: "Luxe Bedding Co",
                    prior_dispute_amount: "$3,180.00",
                    prior_dispute_rc: "13.3",
                    prior_dispute_date: "2026-01-28",
                    prior_outcome: "Refund granted"
                }
            }]
        },
        {
            id: "step-3",
            title_p: "Pulling merchant delivery and communication records...",
            title_s: "Merchant Records — Positive Email Contradicts Damage Claim",
            reasoning: [
                "Merchant records — Artisan Home Furnishings:",
                "  Order #AHF-90421 — 6-piece walnut dining set",
                "  FedEx Freight delivery: February 14, signed 'S. Chen'",
                "  Delivery photos: All pieces intact on arrival",
                "",
                "Customer communication trail:",
                "  February 18 email from cardholder to merchant:",
                "  'Absolutely love the craftsmanship — exactly what we wanted'",
                "  No damage claim filed with merchant before chargeback",
                "  No return request initiated",
                "",
                "Cardholder praised the product 4 days after delivery, then filed chargeback"
            ],
            artifacts: [{
                id: "merchant-records",
                type: "json",
                label: "Merchant Order Records",
                data: {
                    order_id: "AHF-90421",
                    item: "6-piece walnut dining set",
                    delivered: "2026-02-14",
                    signed_by: "S. Chen",
                    positive_email: "2026-02-18",
                    return_requested: false,
                    damage_claim: false
                }
            }]
        },
        {
            id: "step-4",
            title_p: "Running social media intelligence scan...",
            title_s: "Social Media Intelligence — Instagram Evidence Found",
            reasoning: [
                "Instagram OSINT scan for cardholder Sarah M. Chen:",
                "  Public post: February 16, 2026 (2 days after delivery)",
                "  Caption: 'New dining room vibes! Finally upgraded from IKEA'",
                "  Photo shows: Walnut dining set matching order #AHF-90421",
                "  47 likes, 8 comments",
                "  Comment from user @chen_mama: 'Beautiful! Where did you get it?'",
                "  Reply from cardholder: 'Artisan Home Furnishings — worth every penny!'",
                "",
                "This directly contradicts the chargeback claim of damaged merchandise"
            ],
            artifacts: [{
                id: "instagram-evidence",
                type: "json",
                label: "Instagram Post Evidence",
                data: {
                    platform: "Instagram",
                    post_date: "2026-02-16",
                    caption: "New dining room vibes! Finally upgraded from IKEA",
                    likes: 47,
                    comments: 8,
                    product_visible: true,
                    contradicts_claim: true
                }
            }]
        },
        {
            id: "step-5",
            title_p: "Analyzing dual-dispute pattern across card network...",
            title_s: "Dual-Dispute Pattern Analysis — Serial Fraud Indicators",
            reasoning: [
                "Cross-network pattern analysis for Sarah M. Chen:",
                "  Dispute 1: Luxe Bedding Co — $3,180.00 (Jan 28, RC 13.3)",
                "  Dispute 2: Artisan Home Furnishings — $6,420.00 (current, RC 13.3)",
                "  Combined exposure: $9,600.00 in 25 days",
                "",
                "Pattern flags:",
                "  Both disputes use identical reason code (Visa 13.3)",
                "  Both merchants in MCC 5712 (Furniture Stores)",
                "  Dispute language nearly identical ('arrived damaged')",
                "  Neither merchant received return request or damage claim",
                "  First dispute succeeded — cardholder testing boundaries",
                "  Classic 'friendly fraud escalation' pattern detected"
            ],
            artifacts: [{
                id: "pattern-analysis",
                type: "json",
                label: "Dual-Dispute Pattern Report",
                data: {
                    disputes_in_25_days: 2,
                    combined_amount: "$9,600.00",
                    same_reason_code: true,
                    same_mcc: true,
                    identical_language: true,
                    pattern: "Friendly fraud escalation",
                    first_dispute_outcome: "Refund granted"
                }
            }]
        },
        {
            id: "step-6",
            title_p: "Computing fraud likelihood score...",
            title_s: "Fraud Likelihood Scoring — Score: 89/100 (Confirmed Friendly Fraud)",
            reasoning: [
                "  Instagram post contradicting damage claim: +25 points",
                "  Positive email to merchant post-delivery: +20 points",
                "  Dual-dispute pattern (2 in 25 days): +18 points",
                "  Identical RC and MCC across disputes: +12 points",
                "  No return request or damage report filed: +8 points",
                "  First dispute succeeded (learned behavior): +6 points",
                "",
                "Final Score: 89/100 (Confirmed Friendly Fraud Pattern)",
                "Evidence Strength: 94/100 (Exceptional)",
                "Recommendation: AGGRESSIVE REPRESENTMENT + Fraud Team Escalation"
            ],
            artifacts: [{
                id: "fraud-score",
                type: "json",
                label: "Fraud Risk Assessment",
                data: {
                    fraud_score: "89/100",
                    risk_level: "Confirmed Pattern",
                    evidence_strength: "94/100",
                    recommendation: "Aggressive representment",
                    escalation: "Fraud team notification"
                }
            }]
        },
        {
            id: "step-7",
            title_p: "Generating fraud narrative rebuttal letter...",
            title_s: "Rebuttal Letter Generated — Fraud Narrative with Social Media Evidence",
            reasoning: [
                "Rebuttal letter compiled with:",
                "  Instagram post screenshot (Feb 16) showing undamaged product",
                "  Cardholder's own comment: 'worth every penny!'",
                "  Positive email to merchant praising craftsmanship",
                "  Dual-dispute pattern documentation",
                "  FedEx Freight signed delivery confirmation",
                "  Merchant order records with no damage claim",
                "  Total evidence pages: 9",
                "  Letter includes fraud pattern narrative for Visa review"
            ],
            artifacts: [{
                id: "rebuttal-pdf",
                type: "json",
                label: "Fraud Narrative Rebuttal — RC 13.3",
                data: {
                    document_type: "Visa Fraud Narrative Rebuttal Letter",
                    case_id: "CHB-2026-0289",
                    reason_code: "Visa 13.3 — Not as Described / Defective",
                    dispute_amount: "$6,420.00",
                    filing_type: "Aggressive Representment — Fraud Escalation",
                    evidence_summary: {
                        social_media: "Instagram post Feb 16 — cardholder showcasing undamaged product, quote: 'worth every penny!'",
                        positive_email: "Feb 18 email to merchant: 'Absolutely love the craftsmanship'",
                        delivery_proof: "FedEx Freight signed delivery, signed S. Chen",
                        merchant_records: "No damage claim, no return request filed",
                        dual_dispute_pattern: "2 disputes in 25 days, both RC 13.3, both furniture MCC 5712",
                        prior_dispute: "Luxe Bedding Co $3,180 — refund granted (no merchant contest)"
                    },
                    fraud_indicators: {
                        fraud_score: "89/100 — Confirmed Friendly Fraud",
                        pattern: "Serial friendly fraud escalation",
                        combined_exposure: "$9,600.00 across 2 disputes in 25 days"
                    },
                    legal_basis: "Cardholder's own social media and email directly contradict damage claim. Dual-dispute pattern establishes fraud intent.",
                    conclusion: "Overwhelming evidence of friendly fraud. Cardholder praised product publicly, then filed false damage claim. Recommend fraud team escalation and watch list addition.",
                    total_pages: 9,
                    generated_by: "Pace Intelligence Layer",
                    status: "Pending analyst approval"
                }
            },
            {
                id: "rebuttal-letter-pdf",
                type: "file",
                label: "View Full Rebuttal Letter (PDF)",
                pdfPath: "/pdfs/chb002_rebuttal.pdf"
            }]
        },
        {
            id: "step-8",
            title_p: "Awaiting analyst approval for fraud escalation...",
            title_s: "Analyst Review Required — Approve Fraud Evidence Package",
            reasoning: [
                "HUMAN-IN-THE-LOOP checkpoint reached",
                "",
                "This case involves fraud team escalation beyond standard representment.",
                "Analyst must review and approve before proceeding:",
                "",
                "  1. Rebuttal letter with social media evidence",
                "  2. Dual-dispute pattern flagging cardholder for monitoring",
                "  3. Fraud team alert to add Sarah M. Chen to watch list",
                "  4. Potential law enforcement referral if pattern continues",
                "",
                "Awaiting analyst confirmation to proceed..."
            ],
            isHitl: true,
            hitlSignal: "APPROVE_EVIDENCE_CB002",
            artifacts: [{
                id: "analyst-decision-cb002",
                type: "decision",
                label: "Analyst Decision Required",
                options: [
                    { label: "Approve — File representment with fraud escalation", signal: "APPROVE_EVIDENCE_CB002" },
                    { label: "Override — File representment only, no fraud escalation", signal: "APPROVE_EVIDENCE_CB002" }
                ]
            }]
        }
    ];

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const isFinal = i === steps.length - 1;

        updateProcessLog(PROCESS_ID, {
            id: step.id,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            title: step.title_p,
            status: "processing"
        });
        await updateProcessListStatus(PROCESS_ID, "In Progress", step.title_p);
        await delay(2000);

        if (step.isHitl) {
            updateProcessLog(PROCESS_ID, {
                id: step.id,
                title: step.title_s,
                status: "warning",
                reasoning: step.reasoning || [],
                artifacts: step.artifacts || []
            });
            await updateProcessListStatus(PROCESS_ID, "Needs Attention", step.title_s);

            await waitForSignal(step.hitlSignal);
            await updateProcessListStatus(PROCESS_ID, "In Progress", "Analyst approved — filing representment and escalating to fraud team");

            // --- Post-HITL Step 9: VROL Filing ---
            await delay(2000);
            updateProcessLog(PROCESS_ID, {
                id: "step-9",
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                title: "VROL Representment Filing",
                status: "processing"
            });
            await updateProcessListStatus(PROCESS_ID, "In Progress", "Filing representment via VROL portal...");
            await delay(2000);
            updateProcessLog(PROCESS_ID, {
                id: "step-9",
                title: "VROL Representment Filed — 9-Page Evidence Package Submitted",
                status: "success",
                reasoning: [
                    "Representment filed via VROL:",
                    "  ARN: 3356-8812-0289-4471",
                    "  Evidence package: 9 pages including social media proof",
                    "  Fraud narrative flag: Active",
                    "  Reason code: RC 13.3 — Not as Described / Defective",
                    "  Filing status: ACCEPTED — pending issuer review"
                ]
            });
            await delay(1500);

            // --- Post-HITL Step 10: Fraud Team Alert ---
            updateProcessLog(PROCESS_ID, {
                id: "step-10",
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                title: "Fraud Team Escalation",
                status: "processing"
            });
            await updateProcessListStatus(PROCESS_ID, "In Progress", "Escalating to Meridian Bank Fraud Operations...");
            await delay(2000);
            updateProcessLog(PROCESS_ID, {
                id: "step-10",
                title: "Fraud Team Alert — Cardholder Added to Enhanced Monitoring",
                status: "success",
                reasoning: [
                    "Fraud team escalation completed:",
                    "  Sarah M. Chen added to Enhanced Monitoring list",
                    "  Alert sent to Meridian Bank Fraud Operations",
                    "  Cross-reference flag set for future RC 13.3 disputes",
                    "  Friendly fraud pattern: 3 disputes in 14 months flagged"
                ]
            });
            await delay(1500);

            // --- Post-HITL Step 11: UiPath RPA Closure ---
            updateProcessLog(PROCESS_ID, {
                id: "step-11",
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                title: "UiPath RPA — Ledger Posting & Notifications",
                status: "processing"
            });
            await updateProcessListStatus(PROCESS_ID, "In Progress", "UiPath executing closure tasks...");
            await delay(2000);
            updateProcessLog(PROCESS_ID, {
                id: "step-11",
                title: "UiPath RPA — SAP Posted, Merchant Notified, Case Closed",
                status: "completed",
                reasoning: [
                    "UiPath RPA execution:",
                    "  SAP GL posting: Chargeback reserve $6,420.00 maintained",
                    "  Merchant notification: Artisan Home Furnishings updated",
                    "  Case status: RESOLVED — Won (Fraud Pattern Confirmed)"
                ]
            });
            await updateProcessListStatus(PROCESS_ID, "Done", "Dispute resolved — fraud pattern confirmed, representment filed");
        } else {
            updateProcessLog(PROCESS_ID, {
                id: step.id,
                title: step.title_s,
                status: isFinal ? "completed" : "success",
                reasoning: step.reasoning || [],
                artifacts: step.artifacts || []
            });
            await updateProcessListStatus(PROCESS_ID, isFinal ? "Done" : "In Progress", step.title_s);
            await delay(1500);
        }
    }

    console.log(`${PROCESS_ID} Complete: ${CASE_NAME}`);
})();
