const fs = require('fs');
const path = require('path');

// --- Configuration ---
const PROJECT_ROOT = path.join(__dirname, '..');
const PUBLIC_DATA_DIR = path.join(PROJECT_ROOT, 'public/data');
const PROCESSES_FILE = path.join(PUBLIC_DATA_DIR, 'processes.json');
const PROCESS_ID = "CHB_006";
const CASE_NAME = "TechVault Electronics — Premature Dispute Hold";

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

(async () => {
    console.log(`Starting ${PROCESS_ID}: ${CASE_NAME}...`);

    writeJson(path.join(PUBLIC_DATA_DIR, `process_${PROCESS_ID}.json`), {
        logs: [],
        keyDetails: {
            "Case ID": "CHB-2026-0588",
            "Reason Code": "Visa 13.1 — Merchandise Not Received",
            "Amount": "$892.00",
            "Cardholder": "Marcus J. Rivera",
            "Merchant": "TechVault Electronics",
            "Carrier": "SwiftShip Logistics",
            "Tracking": "TRC590243",
            "Card Last 4": "4417"
        }
    });

    const steps = [
        {
            id: "step-1",
            title_p: "Pega Smart Dispute — Ingesting case CHB-2026-0588...",
            title_s: "Pega Smart Dispute — Case Intake Received",
            reasoning: [
                "Chargeback received via VROL webhook",
                "RC 13.1 — delivery evidence required to proceed"
            ],
            artifacts: [{
                id: "case-intake",
                type: "json",
                label: "Pega Case Details",
                data: {
                    case_id: "CHB-2026-0588",
                    reason_code: "Visa 13.1",
                    reason_description: "Merchandise Not Received",
                    amount: "$892.00",
                    cardholder: "Marcus J. Rivera",
                    merchant: "TechVault Electronics",
                    mcc: "5732",
                    transaction_date: "February 25, 2026",
                    carrier: "SwiftShip Logistics",
                    tracking_number: "TRC590243"
                }
            }]
        },
        {
            id: "step-2",
            title_p: "Querying carrier API registry for SwiftShip connector...",
            title_s: "Carrier API Lookup — SwiftShip Integration Unavailable",
            reasoning: [
                "SwiftShip has no registered API in Pega connector library",
                "Structured carrier query returned null response",
                "Browser agent fallback required — navigating to public tracking portal"
            ],
            artifacts: [{
                id: "api-lookup",
                type: "json",
                label: "Carrier API Query Result",
                data: {
                    carrier: "SwiftShip Logistics",
                    tracking_number: "TRC590243",
                    api_registry_match: null,
                    connector_status: "NOT_FOUND",
                    supported_carriers: ["UPS", "FedEx", "USPS", "DHL"],
                    fallback_action: "BROWSER_AGENT_NAVIGATION",
                    target_url: "https://track.swiftship.com"
                }
            }]
        },
        {
            id: "step-3",
            title_p: "Browser agent navigating to SwiftShip tracking portal...",
            title_s: "Browser Agent — SwiftShip Tracking Portal",
            reasoning: [
                "Browser agent successfully loaded SwiftShip tracking portal",
                "Shipment TRC590243 located — real and actively moving",
                "Package one hop from destination on estimated delivery date",
                "Delivery not yet confirmed — dispute filing would be premature"
            ],
            artifacts: [{
                id: "browser-recording",
                type: "video",
                label: "SwiftShip Tracking Portal — Browser Recording",
                videoPath: "/videos/chb006_swiftship_tracking.mp4"
            }]
        },
        {
            id: "step-4",
            title_p: "Evaluating dispute timing against delivery window...",
            title_s: "Case Hold — Premature Dispute, Delivery Pending",
            reasoning: [
                "Item is in transit — not lost, not missing",
                "Filing RC 13.1 now would be rejected — no missed delivery window yet",
                "Hold is the correct action — protects cardholder without premature filing",
                "Automated recheck scheduled for Mar 10"
            ],
            artifacts: [{
                id: "hold-details",
                type: "json",
                label: "Case Hold Summary",
                data: {
                    action: "CASE_HOLD",
                    reason: "Premature dispute — package in transit",
                    tracking_status: "IN_TRANSIT",
                    last_scan: "Memphis, TN — Out for regional transfer",
                    estimated_delivery: "March 8, 2026",
                    recheck_date: "March 10, 2026",
                    hold_expires: "March 15, 2026",
                    filing_recommendation: "DO_NOT_FILE",
                    rationale: "RC 13.1 requires missed delivery window — filing now risks automatic rejection"
                }
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

        if (isFinal) {
            // Step 4 is a terminal warning — not HITL, no signal wait
            updateProcessLog(PROCESS_ID, {
                id: step.id,
                title: step.title_s,
                status: "warning",
                reasoning: step.reasoning || [],
                artifacts: step.artifacts || []
            });
            await updateProcessListStatus(PROCESS_ID, "Needs Attention", step.title_s);
        } else {
            updateProcessLog(PROCESS_ID, {
                id: step.id,
                title: step.title_s,
                status: "success",
                reasoning: step.reasoning || [],
                artifacts: step.artifacts || []
            });
            await updateProcessListStatus(PROCESS_ID, "In Progress", step.title_s);
            await delay(1500);
        }
    }

    console.log(`${PROCESS_ID} Complete: ${CASE_NAME}`);
})();
