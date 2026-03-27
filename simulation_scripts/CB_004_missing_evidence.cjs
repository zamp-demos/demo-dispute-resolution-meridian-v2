const fs = require('fs');
const path = require('path');

// --- Configuration ---
const PROJECT_ROOT = path.join(__dirname, '..');
const PUBLIC_DATA_DIR = path.join(PROJECT_ROOT, 'public/data');
const PROCESSES_FILE = path.join(PUBLIC_DATA_DIR, 'processes.json');
const PROCESS_ID = "CHB_004";
const CASE_NAME = "Pinnacle Electronics — Missing Evidence Escalation";

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

const waitForEmailSent = async () => {
    console.log('Waiting for email to be sent via /email-status...');
    const apiUrl = process.env.VITE_API_URL || 'http://localhost:3001';

    while (true) {
        try {
            const response = await fetch(`${apiUrl}/email-status`);
            const data = await response.json();
            if (data.sent) {
                console.log('Email sent signal received!');
                return true;
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
            "Case ID": "CHB-2026-0583",
            "Reason Code": "Visa 13.1 — Merchandise Not Received",
            "Amount": "$1,948.00",
            "Cardholder": "Michael T. Rivera",
            "Merchant": "Pinnacle Electronics",
            "Card Last 4": "5092"
        }
    });

    const steps = [
        {
            id: "step-1",
            title_p: "Pega Smart Dispute — Ingesting case CHB-2026-0583...",
            title_s: "Pega Smart Dispute — Case Intake Received",
            reasoning: [
                "Webhook received from Visa VROL — new chargeback filed",
                "Case ID: CHB-2026-0583",
                "Reason Code: Visa 13.1 — Merchandise / Services Not Received",
                "Dispute amount: $1,948.00",
                "Cardholder: Michael T. Rivera (card ending 5092)",
                "Merchant: Pinnacle Electronics (MCC 5732 — Electronics Stores)",
                "Transaction date: February 22, 2026",
                "Cardholder claim: 'Order never arrived — tracking shows delivered but I never received it'",
                "Pega case created — routing to Pace intelligence layer"
            ],
            artifacts: [{
                id: "case-intake",
                type: "json",
                label: "Pega Case Details",
                data: {
                    case_id: "CHB-2026-0583",
                    reason_code: "Visa 13.1",
                    amount: "$1,948.00",
                    cardholder: "Michael T. Rivera",
                    merchant: "Pinnacle Electronics",
                    mcc: "5732",
                    transaction_date: "2026-02-22"
                }
            }]
        },
        {
            id: "step-2",
            title_p: "Querying FedEx Ship API for delivery confirmation...",
            title_s: "FedEx Ship API — Delivered but No Signature on File",
            reasoning: [
                "FedEx tracking data for shipment #7789-4420-1583:",
                "  Status: DELIVERED — February 25, 2026 at 2:14 PM",
                "  Delivery address: 1847 Oakridge Dr, Austin, TX 78704",
                "  Left at: Front door",
                "  Signature: NOT REQUIRED (standard shipping tier)",
                "  Delivery photo: Available (shows package at door)",
                "",
                "⚠ Critical gap: No signed proof of delivery",
                "  Merchant used standard shipping — signature not requested",
                "  For RC 13.1 representment, Visa CE 3.0 requires signed POD",
                "  Delivery photo alone is insufficient for compelling evidence"
            ],
            artifacts: [{
                id: "fedex-tracking",
                type: "json",
                label: "FedEx Delivery Record",
                data: {
                    tracking_number: "7789-4420-1583",
                    status: "DELIVERED",
                    delivery_date: "2026-02-25",
                    delivery_time: "2:14 PM",
                    address: "1847 Oakridge Dr, Austin, TX 78704",
                    left_at: "Front door",
                    signature_required: false,
                    signature_on_file: false,
                    delivery_photo: true
                }
            }]
        },
        {
            id: "step-3",
            title_p: "Querying Salesforce CRM for merchant dispute history...",
            title_s: "Salesforce CRM — Merchant Clean History (2 Prior Disputes Won)",
            reasoning: [
                "Salesforce CRM — Merchant profile for Pinnacle Electronics:",
                "  Merchant ID: PNE-33107",
                "  Active since: 2019",
                "  Total disputes received: 14 (last 12 months)",
                "  Disputes won via representment: 12 (85.7% win rate)",
                "  Disputes lost: 2 (both lacked delivery evidence)",
                "",
                "Cardholder profile — Michael T. Rivera:",
                "  First dispute on file with Meridian Bank",
                "  Account in good standing since 2021",
                "  No prior fraud flags",
                "",
                "Merchant is reliable with strong win rate — evidence gap is the risk factor"
            ],
            artifacts: [{
                id: "salesforce-merchant",
                type: "json",
                label: "Salesforce Merchant Profile",
                data: {
                    merchant_id: "PNE-33107",
                    merchant_name: "Pinnacle Electronics",
                    active_since: 2019,
                    disputes_12mo: 14,
                    win_rate: "85.7%",
                    losses_reason: "Missing delivery evidence",
                    cardholder_prior_disputes: 0,
                    cardholder_fraud_flags: "None"
                }
            }]
        },
        {
            id: "step-4",
            title_p: "Evaluating evidence package against Visa CE 3.0 criteria...",
            title_s: "Visa CE 3.0 — Evidence Insufficient (2 of 4 Required Elements Met)",
            reasoning: [
                "Visa Compelling Evidence 3.0 evaluation for RC 13.1:",
                "",
                "  Element 1: Proof of shipment to cardholder address — MET",
                "     FedEx tracking confirms shipment to 1847 Oakridge Dr",
                "",
                "  Element 2: Carrier delivery confirmation — MET",
                "     FedEx status DELIVERED, Feb 25 at 2:14 PM",
                "",
                "  Element 3: Signed proof of delivery (POD) — NOT MET",
                "     No signature collected — standard shipping tier used",
                "     This is the mandatory element for RC 13.1 representment",
                "",
                "  Element 4: Prior successful delivery to same address — NOT MET",
                "     No prior transactions found for this cardholder/address",
                "",
                "Evidence score: 2/4 — INSUFFICIENT for representment",
                "Win probability with current evidence: ~35%",
                "Win probability with signed POD added: ~85%+",
                "",
                "Recommendation: Request signed POD from merchant before filing"
            ],
            artifacts: [{
                id: "visa-ce3-eval",
                type: "json",
                label: "Visa CE 3.0 Evidence Evaluation",
                data: {
                    elements_met: "2 of 4",
                    element_1_shipment_proof: "MET",
                    element_2_delivery_confirmation: "MET",
                    element_3_signed_pod: "NOT MET — No signature collected",
                    element_4_prior_delivery: "NOT MET — No prior transactions",
                    current_win_probability: "~35%",
                    with_signed_pod: "~85%+",
                    recommendation: "Request signed POD from merchant"
                }
            }]
        },
        {
            id: "step-5",
            title_p: "Computing fraud likelihood score...",
            title_s: "Fraud Likelihood Scoring — Score: 28/100 (Low Risk — Genuine MNR)",
            reasoning: [
                "  Cardholder first dispute ever: -15 points",
                "  Account in good standing since 2021: -10 points",
                "  No prior fraud indicators: -8 points",
                "  Delivery to correct address confirmed: +12 points",
                "  High-value electronics (theft target): +8 points",
                "  No signature on delivery: +15 points",
                "  Package left at door (porch theft risk): +10 points",
                "  Apartment complex — shared entrance: +6 points",
                "",
                "Final Score: 28/100 (Low Fraud Risk)",
                "Assessment: Likely genuine merchandise-not-received claim",
                "Porch theft or misdelivery is plausible",
                "Recommendation: Strengthen evidence package, do not assume fraud"
            ],
            artifacts: [{
                id: "fraud-score",
                type: "json",
                label: "Fraud Risk Assessment",
                data: {
                    fraud_score: "28/100",
                    risk_level: "Low",
                    assessment: "Likely genuine MNR — porch theft plausible",
                    recommendation: "Strengthen evidence before representment",
                    escalation: "None required"
                }
            }]
        },
        {
            id: "step-6",
            title_p: "Awaiting analyst decision on evidence strategy...",
            title_s: "Analyst Review Required — Approve Evidence Request to Merchant",
            reasoning: [
                "HUMAN-IN-THE-LOOP checkpoint reached",
                "",
                "Current evidence package is insufficient for representment:",
                "  Visa CE 3.0 score: 2/4 elements (missing signed POD)",
                "  Win probability with current evidence: ~35%",
                "  Win probability with signed POD: ~85%+",
                "",
                "Pace recommends requesting signed proof of delivery from merchant",
                "before filing representment. Two options:",
                "",
                "  Option 1: Request missing evidence — delay filing, improve win rate",
                "  Option 2: File now with current evidence — faster but likely loss",
                "",
                "Awaiting analyst confirmation to proceed..."
            ],
            isHitl: true,
            hitlSignal: "APPROVE_EVIDENCE_REQUEST_CB004",
            artifacts: [{
                id: "analyst-decision-cb004",
                type: "decision",
                label: "Analyst Decision Required",
                options: [
                    { label: "Approve — Request signed POD from merchant via Pega", signal: "APPROVE_EVIDENCE_REQUEST_CB004" },
                    { label: "Override — File representment with current evidence", signal: "APPROVE_EVIDENCE_REQUEST_CB004" }
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
            await updateProcessListStatus(PROCESS_ID, "In Progress", "Analyst approved — directing Pega to request evidence from merchant");

            // --- Post-HITL Step 7: Email Draft to Pega Correspondence ---
            await delay(2000);
            updateProcessLog(PROCESS_ID, {
                id: "step-7",
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                title: "Drafting evidence request for Pega Correspondence Engine...",
                status: "processing"
            });
            await updateProcessListStatus(PROCESS_ID, "In Progress", "Drafting merchant evidence request...");
            await delay(2000);
            updateProcessLog(PROCESS_ID, {
                id: "step-7",
                title: "Directing Pega to Send Merchant Evidence Request",
                status: "warning",
                reasoning: [
                    "Evidence request drafted for Pega Correspondence Engine:",
                    "  Endpoint: POST /prweb/api/v1/cases/CHB-2026-0583/correspondence",
                    "  Template: MER-EVD-REQUEST-001",
                    "  Recipient merchant: Pinnacle Electronics (PNE-33107)",
                    "",
                    "Request payload prepared — review and send to dispatch via Pega"
                ],
                artifacts: [{
                    id: "evidence-request-email",
                    type: "email_draft",
                    label: "Evidence Request — Pega Dispatch",
                    data: {
                        from: "Pace",
                        to: "https://pega-dispute.meridianbank.com/prweb/api/v1/cases/CHB-2026-0583/correspondence",
                        subject: "Evidence Request: Signed Proof of Delivery Required — Case CHB-2026-0583",
                        body: "REQUEST TYPE: Merchant Evidence Request\nCASE REF: CHB-2026-0583\nTEMPLATE: MER-EVD-REQUEST-001\n\nRECIPIENT:\n  Merchant ID: PNE-33107\n  Merchant: Pinnacle Electronics\n  Contact: Merchant Disputes Team\n  Channel: Email (primary), Merchant Portal (secondary)\n\nREQUIRED EVIDENCE:\n  1. Signed Proof of Delivery (POD) with recipient signature\n     - Current status: Carrier tracking confirms delivery, no signature on file\n     - Visa CE 3.0 requirement: Rule 13.1.3 — physical signature or electronic POD\n     - Without this document, representment win probability is ~35%\n     - With this document, win probability increases to 85%+\n\nDEADLINE: 10 business days from dispatch\nESCALATION: If no response, auto-escalate to pre-arbitration review\n\nCONTEXT FOR MERCHANT:\n  Current evidence package scores 2/4 on Visa CE 3.0 criteria.\n  The signed POD is the single missing element blocking representment.\n  Merchant has an 85.7% historical win rate — this case is winnable with proper evidence.\n\nAUTHORIZATION: Approved by analyst — dispatch immediately."
                    }
                }]
            });
            await updateProcessListStatus(PROCESS_ID, "Needs Attention", "Review evidence request before dispatching to Pega");

            // Wait for the email Send button to be clicked
            await waitForEmailSent();
            await updateProcessListStatus(PROCESS_ID, "In Progress", "Evidence request dispatched — Pega processing merchant outreach");

            // --- Post-Email Step 8: Pega Correspondence Dispatched ---
            await delay(2000);
            updateProcessLog(PROCESS_ID, {
                id: "step-8",
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                title: "Pega Correspondence Engine processing dispatch...",
                status: "processing"
            });
            await updateProcessListStatus(PROCESS_ID, "In Progress", "Pega sending evidence request to Pinnacle Electronics...");
            await delay(2000);
            updateProcessLog(PROCESS_ID, {
                id: "step-8",
                title: "Pega Correspondence — Evidence Request Dispatched to Pinnacle Electronics",
                status: "success",
                reasoning: [
                    "Pega Correspondence Engine execution:",
                    "  API response: 200 OK — correspondence queued",
                    "  Correspondence ID: COR-2026-0583-001",
                    "  Template used: MER-EVD-REQUEST-001",
                    "  Recipient: disputes@pinnacle-electronics.com",
                    "  Channel: Email dispatched + Merchant Portal notification",
                    "  SLA timer started: 10 business days",
                    "  Auto-escalation scheduled: March 20, 2026"
                ]
            });
            await delay(1500);

            // --- Post-Email Step 9: UiPath SAP Status Update ---
            updateProcessLog(PROCESS_ID, {
                id: "step-9",
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                title: "UiPath — Updating case status in SAP...",
                status: "processing"
            });
            await updateProcessListStatus(PROCESS_ID, "In Progress", "UiPath updating SAP case records...");
            await delay(2000);
            updateProcessLog(PROCESS_ID, {
                id: "step-9",
                title: "UiPath — SAP Case Status Updated (Pending Merchant Evidence)",
                status: "success",
                reasoning: [
                    "UiPath RPA execution:",
                    "  SAP case status: PENDING_EVIDENCE",
                    "  Chargeback reserve: $1,948.00 held",
                    "  Evidence deadline logged: March 20, 2026",
                    "  Auto-reminder scheduled: March 14, 2026 (T-5 days)"
                ]
            });
            await delay(1500);

            // --- Post-Email Step 10: Pega Case Paused ---
            updateProcessLog(PROCESS_ID, {
                id: "step-10",
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                title: "Pega Smart Dispute — Pausing case pending evidence...",
                status: "processing"
            });
            await updateProcessListStatus(PROCESS_ID, "In Progress", "Pega pausing case until merchant responds...");
            await delay(2000);
            updateProcessLog(PROCESS_ID, {
                id: "step-10",
                title: "Pega Smart Dispute — Case Paused (Awaiting Merchant Evidence)",
                status: "completed",
                reasoning: [
                    "Case paused pending merchant response:",
                    "  Pega case status: PAUSED — Awaiting Evidence",
                    "  Evidence request sent to: Pinnacle Electronics (PNE-33107)",
                    "  Required document: Signed Proof of Delivery",
                    "  SLA deadline: March 20, 2026 (10 business days)",
                    "  Auto-escalation: Pre-arbitration review if no response",
                    "",
                    "Next steps on merchant response:",
                    "  If POD received → auto-resume case, file representment (win prob ~85%+)",
                    "  If no response → escalate to pre-arbitration, accept partial liability",
                    "",
                    "Total Pace processing time: 3 minutes 47 seconds",
                    "Human touchpoints: 2 (analyst approval + email review)"
                ]
            });
            await updateProcessListStatus(PROCESS_ID, "Needs Attention", "Case paused — awaiting merchant evidence (SLA: March 20, 2026)");
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
