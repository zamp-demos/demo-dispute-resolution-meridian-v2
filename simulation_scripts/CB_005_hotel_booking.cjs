const fs = require('fs');
const path = require('path');

// --- Configuration ---
const PROJECT_ROOT = path.join(__dirname, '..');
const PUBLIC_DATA_DIR = path.join(PROJECT_ROOT, 'public/data');
const PROCESSES_FILE = path.join(PUBLIC_DATA_DIR, 'processes.json');
const PROCESS_ID = "CHB_005";
const CASE_NAME = "Grand Meridian Hotel — Representment Document Analysis";

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
            "Case ID": "CHB-2026-0731",
            "Reason Code": "Visa 13.1 — Merchandise/Services Not Received",
            "Amount": "$4,200.00",
            "Cardholder": "Katherine E. Whitfield",
            "Merchant": "Grand Meridian Hotel & Suites",
            "Card Last 4": "4892"
        }
    });

    const steps = [
        {
            id: "step-1",
            title_p: "Pega Smart Dispute — Ingesting case CHB-2026-0731...",
            title_s: "Pega Smart Dispute — Representment Received (4 Merchant Documents)",
            reasoning: [
                "Webhook received from Visa VROL — merchant representment filed",
                "Case ID: CHB-2026-0731",
                "Reason Code: Visa 13.1 — Merchandise / Services Not Received",
                "Dispute amount: $4,200.00",
                "Cardholder: Katherine E. Whitfield (card ending 4892)",
                "Merchant: Grand Meridian Hotel & Suites (MCC 7011 — Lodging / Hotels)",
                "Transaction date: February 8, 2026",
                "Cardholder claim: 'Hotel stay was never rendered — booking was cancelled'",
                "",
                "Provisional credit of $4,200.00 issued to cardholder on 2026-02-18",
                "Merchant submitted representment packet: 4 documents attached",
                "Pega STP cannot parse unstructured merchant evidence — routing to Pace intelligence layer"
            ],
            artifacts: [{
                id: "case-intake-cb005",
                type: "json",
                label: "Pega Case Details",
                data: {
                    case_id: "CHB-2026-0731",
                    reason_code: "Visa 13.1",
                    amount: "$4,200.00",
                    cardholder: "Katherine E. Whitfield",
                    merchant: "Grand Meridian Hotel & Suites",
                    mcc: "7011",
                    transaction_date: "2026-02-08",
                    cardholder_claim: "Hotel stay never rendered — booking was cancelled",
                    representment_documents: 4,
                    routing: "Pace Intelligence Layer"
                }
            }]
        },
        {
            id: "step-2",
            title_p: "Extracting evidence from merchant representment packet (3 documents)...",
            title_s: "Document Extraction — 19 Facts Extracted from 3 Merchant Documents",
            reasoning: [
                "Merchant representment packet — 3 documents processed:",
                "  Document 1: Hotel check-in scan (image)",
                "    Guest: Katherine E. Whitfield",
                "    Check-in: February 10, 2026 at 14:32 EST",
                "    Room: Suite 1204",
                "    Signature: PRESENT — verified against card-on-file name",
                "    ID verification: Driver license ending *8834 — matched",
                "",
                "  Document 2: Email correspondence thread (PDF, 6 messages)",
                "    Original booking: Feb 5–8, 2026",
                "    Date change requested: Feb 3 by cardholder",
                "    New dates: Feb 10–13, 2026",
                "    Cardholder's exact words: 'I need to move my dates to Feb 10-13 instead'",
                "    Hotel confirmed: GM-2026-88412-REV",
                "    Cancellation mentioned: NO",
                "",
                "  Document 3: Hotel folio / itemized invoice (PDF)",
                "    Folio: FO-2026-1204-WH",
                "    Room: $3,600.00 (3 nights × $1,200/night)",
                "    Minibar: $187.50 (Feb 10, 11, 12)",
                "    Room service: $312.50 (Feb 11 dinner, Feb 12 breakfast)",
                "    Spa: $100.00 (Feb 11)",
                "    Total: $4,200.00",
                "",
                "Cross-document findings (facts that require multiple sources):",
                "  ⚠ Finding 1 — Docs 2 + 1 + 3: Guest stayed Feb 10–13 (confirmed by 3 sources)",
                "    Email: new dates requested as Feb 10–13",
                "    Check-in scan: physical arrival confirmed Feb 10 at 14:32",
                "    Folio: minibar + room service charges on Feb 10, 11, 12 prove continuous occupancy",
                "",
                "  ⚠ Finding 2 — Docs 2 + 3: Charge of $4,200 matches the modified booking",
                "    Email: 3 nights (Feb 10–13) at Executive Suite",
                "    Folio: $1,200/night × 3 = $3,600 + $600 incidentals = $4,200.00",
                "    No unexplained charges — math is internally consistent",
                "",
                "  ⚠ Finding 3 — Docs 1 + 2: Guest identity is the cardholder",
                "    Check-in scan: signature + driver license *8834 for Katherine E. Whitfield",
                "    Email thread: sent from katherine.whitfield@bellvue-partners.com",
                "    Physical ID + digital identity match — no third-party dispute possible",
                "",
                "  ⚠ Evidence gap identified:",
                "    Email thread references a 'non-refundable modified booking' but no cancellation",
                "    or modification policy was included in the merchant's evidence package",
                "    Cannot verify refundability claim without the hotel's official policy",
                "    Initiating browser agent to retrieve policy from merchant website",
                "",
                "19 facts extracted + 3 cross-document findings in 3.8 seconds"
            ],
            artifacts: [
                {
                    id: "doc1-checkin",
                    type: "file",
                    label: "Document 1 — Hotel Check-In Registration Scan",
                    pdfPath: "/pdfs/chb005_checkin_scan.pdf"
                },
                {
                    id: "doc2-email",
                    type: "file",
                    label: "Document 2 — Email Correspondence Thread",
                    pdfPath: "/pdfs/chb005_email_thread.pdf"
                },
                {
                    id: "doc3-folio",
                    type: "file",
                    label: "Document 3 — Hotel Folio / Itemized Invoice",
                    pdfPath: "/pdfs/chb005_hotel_folio.pdf"
                },
                {
                    id: "extraction-summary",
                    type: "json",
                    label: "Extraction Summary — All 3 Documents",
                    data: {
                        totalDocumentsProcessed: 3,
                        totalFactsExtracted: 19,
                        crossDocumentFindings: 3,
                        evidenceGapIdentified: true,
                        evidenceGap: "No cancellation/modification policy in merchant packet — cannot verify refundability claim",
                        processingTime: "3.8 seconds",
                        document1_checkinScan: {
                            type: "Image (scanned registration card)",
                            guestName: "Katherine E. Whitfield",
                            checkInDate: "2026-02-10",
                            checkOutDate: "2026-02-13",
                            roomNumber: "Suite 1204",
                            guestSignature: "PRESENT — verified against card-on-file name",
                            signatureTimestamp: "2026-02-10 at 14:32 EST",
                            idVerification: "Driver license ending *8834 — matched"
                        },
                        document2_emailThread: {
                            type: "PDF (6-message email thread)",
                            originalBookingDates: "2026-02-05 to 2026-02-08",
                            dateChangeRequested: "2026-02-03",
                            newDatesRequested: "2026-02-10 to 2026-02-13",
                            requestedBy: "Katherine Whitfield (katherine.whitfield@bellvue-partners.com)",
                            hotelConfirmation: "Confirmed by reservations@grandmeridian.com on 2026-02-03",
                            newConfirmationNumber: "GM-2026-88412-REV",
                            cancellationMentioned: "NO — cardholder explicitly wrote 'move my dates' not 'cancel'"
                        },
                        document3_hotelFolio: {
                            type: "PDF (itemized charges)",
                            folioNumber: "FO-2026-1204-WH",
                            totalCharges: "$4,200.00",
                            roomCharges: "$3,600.00 (3 nights × $1,200/night — Executive Suite)",
                            minibarCharges: "$187.50 (Feb 10, 11, 12)",
                            roomService: "$312.50 (Feb 11 dinner, Feb 12 breakfast)",
                            spaServices: "$100.00 (Feb 11)",
                            occupancyEvidence: "Room service + minibar + spa across 3 days confirms physical presence"
                        },
                        crossDocumentFindings: [
                            {
                                finding: "Guest stayed Feb 10–13 (triple-confirmed)",
                                sources: ["Document 2 — Email Thread", "Document 1 — Check-In Scan", "Document 3 — Hotel Folio"],
                                synthesis: "Email: dates requested → Check-in: physical arrival Feb 10 → Folio: charges on Feb 10, 11, 12 prove continuous occupancy"
                            },
                            {
                                finding: "Charge of $4,200 matches modified booking",
                                sources: ["Document 2 — Email Thread", "Document 3 — Hotel Folio"],
                                synthesis: "Email: 3 nights at Executive Suite → Folio: $1,200/night × 3 + $600 incidentals = $4,200 — internally consistent"
                            },
                            {
                                finding: "Guest identity is the cardholder",
                                sources: ["Document 1 — Check-In Scan", "Document 2 — Email Thread"],
                                synthesis: "Physical ID (license *8834) + digital identity (katherine.whitfield@bellvue-partners.com) match — no third-party dispute possible"
                            }
                        ]
                    }
                }
            ]
        },
        {
            id: "step-3",
            title_p: "Browser agent navigating to Grand Meridian Hotel website to retrieve cancellation policy...",
            title_s: "Browser Agent — Cancellation Policy Retrieved from Grand Meridian Hotel",
            reasoning: [
                "Evidence gap from document extraction: merchant claims booking is non-refundable",
                "after modification, but no policy document was submitted in representment packet",
                "Launching browser agent to independently verify cancellation terms",
                "",
                "  Target: grandmeridianhotel.com/policies/booking",
                "  Action: Navigate to hotel website → locate cancellation and modification policy → extract relevant terms",
                "",
                "  Retrieved — Grand Meridian Hotel Booking & Cancellation Policy:",
                "    Section 3.1: Standard cancellations — free cancellation up to 72 hours before check-in",
                "    Section 4.2(a): Modifications to existing bookings — permitted up to 48 hours before original check-in",
                "    Section 4.2(b): Revised bookings created by date modification are classified as non-refundable",
                "    Section 4.2(c): Modified reservations receive new confirmation number with suffix '-REV'",
                "",
                "  Key finding: Section 4.2(b) confirms the merchant's claim",
                "    Cardholder modified her booking on Feb 3 (7 days before original check-in Feb 10)",
                "    Modification was within the permitted window under Section 4.2(a)",
                "    But Section 4.2(b) reclassified the booking as non-refundable upon modification",
                "    Confirmation GM-2026-88412-REV matches the '-REV' suffix pattern from Section 4.2(c)",
                "",
                "  Policy independently verified — not reliant on merchant-submitted documentation"
            ],
            artifacts: [{
                id: "browser-agent-cb005",
                type: "video",
                label: "Browser Agent — Grand Meridian Hotel Policy Retrieval",
                videoPath: "/videos/chb005_grand_meridian_policy.webm"
            }]
        },
        {
            id: "step-4",
            title_p: "Cross-referencing extracted facts against cardholder claim...",
            title_s: "Evidence Cross-Reference — All 5 Tests Contradict Cardholder Claim",
            reasoning: [
                "Cross-reference analysis — cardholder claim vs documentary evidence:",
                "",
                "  Test 1: Was the booking cancelled?",
                "    Finding: NO",
                "    Email thread message #2 (Feb 3 at 09:14): 'I need to move my dates to Feb 10-13 instead'",
                "    This is a modification request, not a cancellation",
                "",
                "  Test 2: Did the cardholder check in?",
                "    Finding: YES",
                "    Registration card signed by Katherine E. Whitfield on Feb 10 at 14:32 EST",
                "    Driver license ending *8834 verified — Suite 1204 assigned",
                "",
                "  Test 3: Did the cardholder physically stay at the hotel?",
                "    Finding: YES",
                "    Minibar charges: Feb 10, 11, 12",
                "    Room service: Feb 11 dinner, Feb 12 breakfast",
                "    Spa services: Feb 11",
                "    These charges require physical room key access",
                "",
                "  Test 4: Is the revised booking refundable?",
                "    Finding: NO",
                "    Browser agent retrieved policy from grandmeridianhotel.com",
                "    Section 4.2(b): date modifications create a non-refundable booking",
                "    Independently verified — not reliant on merchant-submitted documentation",
                "    Confirmation GM-2026-88412-REV matches Section 4.2(c) naming convention",
                "",
                "  Test 5: Does the charge amount match the dispute?",
                "    Finding: YES",
                "    Folio total $4,200.00 matches disputed amount exactly",
                "    Breakdown: $3,600 room + $187.50 minibar + $312.50 room service + $100 spa",
                "",
                "All 5 tests fail the cardholder's claim — evidence is internally consistent"
            ],
            artifacts: [{
                id: "cross-ref-matrix",
                type: "json",
                label: "Evidence Cross-Reference Matrix",
                data: {
                    cardholderClaim: "Hotel stay never rendered — booking was cancelled",
                    crossReferenceResults: [
                        {
                            test: "Was the booking cancelled?",
                            finding: "NO",
                            evidence: "Email thread shows DATE CHANGE request, not cancellation. Exact words: 'I need to move my dates to Feb 10-13 instead.'",
                            sources: ["Document 2 — Email Thread (message #2, Feb 3 at 09:14)"]
                        },
                        {
                            test: "Did the cardholder check in?",
                            finding: "YES",
                            evidence: "Physical registration card signed Feb 10 at 14:32 EST. Driver license verified. Suite 1204.",
                            sources: ["Document 1 — Check-In Scan"]
                        },
                        {
                            test: "Did the cardholder physically stay?",
                            finding: "YES",
                            evidence: "Minibar, room service, spa charges across 3 days require physical room key access.",
                            sources: ["Document 3 — Hotel Folio"]
                        },
                        {
                            test: "Is the revised booking refundable?",
                            finding: "NO",
                            evidence: "Section 4.2(b): date modifications create non-refundable booking. Independently verified via browser agent from grandmeridianhotel.com. Confirmation GM-2026-88412-REV matches Section 4.2(c) naming convention.",
                            sources: ["Browser Agent — Grand Meridian Hotel Website", "Document 2 — Email Thread"]
                        },
                        {
                            test: "Does the charge amount match?",
                            finding: "YES",
                            evidence: "Folio total $4,200.00 matches disputed amount. Breakdown: $3,600 room + $600 incidentals.",
                            sources: ["Document 3 — Hotel Folio"]
                        }
                    ],
                    summary: "3 merchant documents + 1 independently verified policy contradict the cardholder's claim across all 5 tests"
                }
            }]
        },
        {
            id: "step-5",
            title_p: "Computing representment verdict...",
            title_s: "Representment Verdict — Merchant Wins (97.2% Confidence)",
            reasoning: [
                "  Evidence cross-reference score: 5/5 tests contradict cardholder claim",
                "  Deciding document: Email correspondence thread (Document 2)",
                "    Key fact: Cardholder wrote 'move my dates' — proves modification, not cancellation",
                "    Significance: Directly contradicts the dispute claim",
                "",
                "  Corroborating evidence:",
                "    Check-in scan: Physical signature on Feb 10 at 14:32 — cardholder arrived",
                "    Hotel folio: Minibar + room service + spa across 3 days — cardholder stayed",
                "    Cancellation policy: Section 4.2(b) — independently verified via browser agent",
                "",
                "  Visa CE 3.0 compliance:",
                "    Signed check-in + itemized folio + correspondence = compelling evidence",
                "    Representment filed within 30-day window — deadline met",
                "",
                "  Verdict: MERCHANT WINS — Representment Accepted",
                "  Confidence: 97.2%",
                "  Pre-arbitration risk: LOW — evidence is overwhelming",
                "  Recommendation: Accept representment, reverse provisional credit of $4,200.00"
            ],
            artifacts: [{
                id: "verdict-cb005",
                type: "json",
                label: "Representment Verdict",
                data: {
                    caseId: "CHB-2026-0731",
                    verdict: "MERCHANT WINS — Representment Accepted",
                    confidence: "97.2%",
                    decidingEvidence: "Email thread — cardholder requested date change, not cancellation",
                    corroborating: [
                        "Check-in scan: signed registration card",
                        "Hotel folio: in-room charges across 3 days",
                        "Cancellation policy: Section 4.2(b) — independently verified via browser agent"
                    ],
                    recommendedAction: "Accept representment. Reverse provisional credit of $4,200.00.",
                    preArbitrationRisk: "LOW"
                }
            }]
        },
        {
            id: "step-6",
            title_p: "Awaiting analyst approval of representment verdict...",
            title_s: "Approve Representment Acceptance",
            reasoning: [
                "Recommendation: Accept merchant representment",
                "  Verdict: Merchant wins — confidence 97.2%",
                "  Action: Reverse provisional credit of $4,200.00",
                "  Pre-arbitration risk: LOW",
                "",
                "Evidence summary:",
                "  Cardholder claim: Hotel stay never rendered, booking was cancelled",
                "  Finding: Cardholder's own email proves date change, not cancellation",
                "  Corroboration: Signed check-in + in-room charges + independently verified non-refundable policy",
                "",
                "Awaiting analyst confirmation to proceed..."
            ],
            isHitl: true,
            hitlSignal: "APPROVE_REPRESENTMENT_CB005",
            artifacts: [{
                id: "analyst-decision-cb005",
                type: "decision",
                label: "Approve Representment Acceptance?",
                options: [
                    { label: "Approve — Accept representment, reverse provisional credit", signal: "APPROVE_REPRESENTMENT_CB005" },
                    { label: "Override — Reject representment, maintain cardholder credit", signal: "APPROVE_REPRESENTMENT_CB005" }
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
            await updateProcessListStatus(PROCESS_ID, "In Progress", "Analyst approved — drafting response to Visa network");

            // --- Post-HITL Step 7: Email Draft ---
            await delay(2000);

            const emailStepId = "step-7";
            updateProcessLog(PROCESS_ID, {
                id: emailStepId,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                title: "Directing Pega to prepare Visa response...",
                status: "processing"
            });
            await updateProcessListStatus(PROCESS_ID, "In Progress", "Directing Pega to prepare Visa response...");
            await delay(2000);

            updateProcessLog(PROCESS_ID, {
                id: emailStepId,
                title: "Directing Pega to Send Visa Response — Representment Accepted",
                status: "warning",
                reasoning: [
                    "Representment acceptance response drafted for Pega Correspondence Engine:",
                    "  Endpoint: POST /prweb/api/v1/cases/CHB-2026-0731/correspondence",
                    "  Template: VISA-REP-ACCEPT-001",
                    "  Recipient: Visa Dispute Resolution (via VROL)",
                    "",
                    "Response payload prepared — review and send to dispatch via Pega"
                ],
                artifacts: [{
                    id: "email-draft-cb005",
                    type: "email_draft",
                    label: "Visa VROL Response — Representment Accepted",
                    data: {
                        to: "visa-vrol-disputes@visa.com",
                        cc: "disputes-ops@meridianbank.com",
                        subject: "RE: Case CHB-2026-0731 — Representment Accepted — Grand Meridian Hotel & Suites",
                        body: `Dear Visa Dispute Resolution Team,\n\nFollowing our review of the merchant representment for Case CHB-2026-0731, Meridian Bank has determined that the merchant's evidence is compelling and the representment is accepted.\n\nCase Summary:\n- Case ID: CHB-2026-0731\n- Reason Code: Visa 13.1 — Merchandise/Services Not Received\n- Cardholder: Katherine E. Whitfield (card ending 4892)\n- Merchant: Grand Meridian Hotel & Suites\n- Disputed Amount: $4,200.00\n- Transaction Date: February 8, 2026\n\nDecision: REPRESENTMENT ACCEPTED — Merchant Wins (Confidence: 97.2%)\n\nKey Findings:\n1. Cardholder's own email proves date modification, not cancellation\n2. Physical check-in confirmed (signed registration, ID verified)\n3. In-room charges across 3 days prove continuous occupancy\n4. Hotel cancellation policy independently verified — Section 4.2(b) confirms non-refundable status\n\nAction Required:\n- Provisional credit of $4,200.00 to be reversed\n- Case to be closed in favor of merchant\n\nPlease process this response accordingly.\n\nRegards,\nMeridian Bank Dispute Resolution\nAutomated via Pace Intelligence Layer`
                    }
                }]
            });
            await updateProcessListStatus(PROCESS_ID, "Needs Attention", "Directing Pega to Send Visa Response — Representment Accepted");
            await waitForEmailSent();

            updateProcessLog(PROCESS_ID, {
                id: emailStepId,
                status: "success"
            });
            await updateProcessListStatus(PROCESS_ID, "Completed", "Case CHB-2026-0731 — Representment accepted, Visa response sent");
        } else {
            updateProcessLog(PROCESS_ID, {
                id: step.id,
                title: step.title_s,
                status: "success",
                reasoning: step.reasoning || [],
                artifacts: step.artifacts || []
            });
            if (isFinal) {
                await updateProcessListStatus(PROCESS_ID, "Completed", step.title_s);
            }
        }
        await delay(1000);
    }

    console.log(`${PROCESS_ID} simulation complete.`);
})();
