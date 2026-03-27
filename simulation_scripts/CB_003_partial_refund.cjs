const fs = require('fs');
const path = require('path');

// --- Configuration ---
const PROJECT_ROOT = path.join(__dirname, '..');
const PUBLIC_DATA_DIR = path.join(PROJECT_ROOT, 'public/data');
const PROCESSES_FILE = path.join(PUBLIC_DATA_DIR, 'processes.json');
const PROCESS_ID = "CHB_003";
const CASE_NAME = "CloudFit Athletic Gear — Pre-Arb Cost-Benefit Reversal";

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
            "Case ID": "CHB-2026-0412",
            "Reason Code": "Visa 10.4 — Other Fraud (Card Absent)",
            "Amount": "$1,180.00",
            "Cardholder": "David L. Morrison",
            "Merchant": "CloudFit Athletic Gear",
            "Card Last 4": "6709"
        }
    });

    const steps = [
        {
            id: "step-1",
            title_p: "Pega Smart Dispute — Ingesting case CHB-2026-0412...",
            title_s: "Pega Smart Dispute — Case Intake Received",
            reasoning: [
                "Webhook received from Visa VROL — chargeback escalation",
                "Case ID: CHB-2026-0412",
                "Reason Code: Visa 10.4 — Other Fraud (Card-Absent Environment)",
                "Dispute amount: $1,180.00",
                "Cardholder: David L. Morrison (card ending 6709)",
                "Merchant: CloudFit Athletic Gear (MCC 5941 — Sporting Goods)",
                "Transaction date: January 30, 2026",
                "Stage: Pre-arbitration (representment previously rejected)",
                "Pega case created — routing to Pace intelligence layer"
            ],
            artifacts: [{
                id: "case-intake",
                type: "json",
                label: "Pega Case Details",
                data: {
                    case_id: "CHB-2026-0412",
                    reason_code: "Visa 10.4",
                    amount: "$1,180.00",
                    cardholder: "David L. Morrison",
                    merchant: "CloudFit Athletic Gear",
                    mcc: "5941",
                    stage: "Pre-arbitration"
                }
            }]
        },
        {
            id: "step-2",
            title_p: "Pulling 3D Secure authentication logs from Visa Directory Server...",
            title_s: "3D Secure 2.0 — Frictionless Authentication (ECI 05, Liability Shift to Issuer)",
            reasoning: [
                "3D Secure 2.0 authentication analysis:",
                "  Authentication type: Frictionless flow (no challenge issued)",
                "  ECI indicator: 05 (fully authenticated)",
                "  3DS Server: Visa Directory Server v2.2.0",
                "  Liability shift: Active — shifts to issuer under Visa rules"
            ],
            artifacts: [{
                id: "3ds-auth",
                type: "json",
                label: "3DS Authentication Log",
                data: {
                    auth_type: "Frictionless 3DS 2.0",
                    eci: "05",
                    liability_shift: "Issuer",
                    ds_version: "Visa DS v2.2.0",
                    challenge_issued: false
                }
            }]
        },
        {
            id: "step-3",
            title_p: "Analyzing device fingerprint and IP geolocation data...",
            title_s: "Device Fingerprint — IP Mismatch (Phoenix vs Denver, 600+ Miles)",
            reasoning: [
                "Device fingerprint analysis for transaction:",
                "  Transaction IP: 172.58.91.204 (Phoenix, AZ — T-Mobile cellular)",
                "  Cardholder registered address: Denver, CO",
                "  Distance: 600+ miles from billing address"
            ],
            artifacts: [{
                id: "device-fingerprint",
                type: "json",
                label: "Device & IP Analysis",
                data: {
                    ip_address: "172.58.91.204",
                    ip_location: "Phoenix, AZ",
                    billing_location: "Denver, CO",
                    distance_miles: 602,
                    ip_mismatch: true,
                    device_known: false,
                    browser: "Chrome 121 / Windows 11"
                }
            }]
        },
        {
            id: "step-4",
            title_p: "Checking VROL for prior representment outcome...",
            title_s: "VROL Status Check — Representment Previously Rejected",
            reasoning: [
                "Visa Resolve Online case history:",
                "  First representment filed: February 15, 2026",
                "  Evidence submitted: 3DS authentication logs, merchant records",
                "  Visa ruling: REJECTED",
                "  Rejection reason: CE 3.0 Rule 10.4.3 not satisfied",
                "  Visa noted IP/device mismatch undermined 3DS evidence"
            ],
            artifacts: [{
                id: "vrol-status",
                type: "json",
                label: "VROL Portal — Rejection Details",
                data: {
                    portal: "Visa Resolve Online (VROL)",
                    case_reference: "CHB-2026-0412",
                    arn: "6709-3388-0412-1180",
                    first_representment: {
                        filed_date: "2026-02-15",
                        evidence_submitted: "3DS authentication logs, merchant delivery records",
                        ruling: "REJECTED",
                        rejection_reason: "CE 3.0 Rule 10.4.3 not satisfied",
                        visa_notes: "IP/device mismatch undermines 3DS frictionless authentication evidence"
                    },
                    current_stage: "Pre-Arbitration",
                    arbitration_deadline: "2026-03-16 (10 calendar days)",
                    arbitration_filing_fee: "$500.00 (non-refundable if lost)",
                    options: "Escalate to arbitration OR accept liability",
                    retrieved_by: "Pace — automated VROL status check"
                }
            }]
        },
        {
            id: "step-5",
            title_p: "Computing fraud likelihood score...",
            title_s: "Fraud Likelihood Scoring — Score: 42/100 (Moderate / Inconclusive)",
            reasoning: [
                "  3DS frictionless authentication (ECI 05): -20 points",
                "  IP geolocation mismatch (600+ miles): +18 points",
                "  Unknown device not in history: +15 points",
                "  Prior representment rejected by Visa: +12 points",
                "  No prior disputes on this card: -8 points",
                "  Merchant has low dispute ratio (0.3%): -5 points",
                "",
                "Final Score: 42/100 (Moderate — Inconclusive)",
                "Evidence Strength: 31/100 (Weak after CE 3.0 rejection)",
                "Recommendation: ACCEPT LIABILITY — evidence insufficient for arbitration"
            ],
            artifacts: [{
                id: "fraud-score",
                type: "json",
                label: "Fraud Risk Assessment",
                data: {
                    fraud_score: "42/100",
                    risk_level: "Moderate",
                    evidence_strength: "31/100",
                    recommendation: "Accept liability",
                    rationale: "Negative EV, weak evidence"
                }
            }]
        },
        {
            id: "step-6",
            title_p: "Awaiting analyst review of cost-benefit recommendation...",
            title_s: "Analyst Review — Accept Liability Recommendation",
            reasoning: [
                "Representment already rejected — no new evidence since.",
                "CE 3.0 Rule 10.4.3 remains unsatisfied.",
                "Fraud score inconclusive — insufficient for arbitration argument.",
                "Liability acceptance recommended"
            ],
            isHitl: true,
            hitlSignal: "APPROVE_PARTIAL_REFUND_CB003",
            artifacts: [{
                id: "analyst-decision-cb003",
                type: "decision",
                label: "Analyst Decision Required",
                options: [
                    { label: "Accept liability — Write off $1,180 (save $500 filing fee)", signal: "APPROVE_PARTIAL_REFUND_CB003" },
                    { label: "Override — Proceed to Visa arbitration ($500 fee)", signal: "APPROVE_PARTIAL_REFUND_CB003" }
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
            await updateProcessListStatus(PROCESS_ID, "In Progress", "Analyst approved liability acceptance — posting to SAP");

            // --- Post-HITL Step 7: SAP Liability Posting ---
            await delay(2000);
            updateProcessLog(PROCESS_ID, {
                id: "step-7",
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                title: "UiPath — Posting liability to SAP General Ledger...",
                status: "processing"
            });
            await updateProcessListStatus(PROCESS_ID, "In Progress", "UiPath posting liability to SAP...");
            await delay(2000);
            updateProcessLog(PROCESS_ID, {
                id: "step-7",
                title: "UiPath — SAP Liability Posted ($1,180.00 to GL 2380)",
                status: "success",
                reasoning: [
                    "UiPath RPA bot executed SAP ledger posting:",
                    "  Chargeback loss: $1,180.00 posted to reserve account GL 2380",
                    "  Journal entry: JE-2026-CHB-0412 posted",
                    "  Accounting period: March 2026",
                    "  Arbitration avoided — saved $500.00 filing fee"
                ]
            });
            await delay(1500);

            // --- Post-HITL Step 8: Merchant Notification ---
            updateProcessLog(PROCESS_ID, {
                id: "step-8",
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                title: "UiPath — Sending merchant notification...",
                status: "processing"
            });
            await updateProcessListStatus(PROCESS_ID, "In Progress", "Notifying CloudFit Athletic Gear...");
            await delay(2000);
            updateProcessLog(PROCESS_ID, {
                id: "step-8",
                title: "UiPath — CloudFit Athletic Gear Notified (No Further Action)",
                status: "success",
                reasoning: [
                    "Merchant notification dispatched:",
                    "  Recipient: CloudFit Athletic Gear (merchant ID: CFA-77203)",
                    "  Channel: Automated email via Pega correspondence",
                    "  Content: Dispute resolved — liability accepted, no merchant action required",
                    "  Transaction reference: TXN-2026-01-28-CFA-1180"
                ]
            });
            await delay(1500);

            // --- Post-HITL Step 9: Pega Case Closure ---
            updateProcessLog(PROCESS_ID, {
                id: "step-9",
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                title: "Pega Smart Dispute — Closing case...",
                status: "processing"
            });
            await updateProcessListStatus(PROCESS_ID, "In Progress", "Finalizing case closure...");
            await delay(2000);
            updateProcessLog(PROCESS_ID, {
                id: "step-9",
                title: "Pega Smart Dispute — Case Closed (Liability Accepted — $587 Saved)",
                status: "completed",
                reasoning: [
                    "Case closure finalized:",
                    "  Pega status: RESOLVED — Liability Accepted",
                    "  Reason: Negative expected value (-$87.00), weak evidence",
                    "  Total resolution time: 2 hours 38 minutes",
                    "  Bank net savings vs arbitration: $587.00"
                ]
            });
            await updateProcessListStatus(PROCESS_ID, "Done", "Liability accepted — $587 saved vs arbitration path");
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
