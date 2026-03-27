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
            title_p: "Extracting evidence from merchant representment packet (4 documents)...",
            title_s: "Document Extraction — 23 Facts Extracted from 4 Merchant Documents",
            reasoning: [
                "Merchant representment packet — 4 documents processed:",
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
                "  Document 3: Hotel cancellation & modification policy (PDF)",
                "    Free cancellation: 72 hours before check-in",
                "    Modification clause: Section 4.2(b) — revised bookings are non-refundable",
                "",
                "  Document 4: Hotel folio / itemized invoice (PDF)",
                "    Folio: FO-2026-1204-WH",
                "    Room: $3,600.00 (3 nights × $1,200/night)",
                "    Minibar: $187.50 (Feb 10, 11, 12)",
                "    Room service: $312.50 (Feb 11 dinner, Feb 12 breakfast)",
                "    Spa: $100.00 (Feb 11)",
                "    Total: $4,200.00",
                "",
                "Cross-document findings (facts that require multiple sources):",
                "  ⚠ Finding 1 — Docs 2 + 3: Revised booking is non-refundable",
                "    Email thread proves this was a MODIFICATION (not a cancellation)",
                "    Policy Section 4.2(b) states modifications create a non-refundable booking",
                "    → Cardholder forfeited cancellation rights when she changed dates on Feb 3",
                "",
                "  ⚠ Finding 2 — Docs 2 + 1 + 4: Guest stayed Feb 10–13 (confirmed by 3 sources)",
                "    Email: new dates requested as Feb 10–13",
                "    Check-in scan: physical arrival confirmed Feb 10 at 14:32",
                "    Folio: minibar + room service charges on Feb 10, 11, 12 prove continuous occupancy",
                "",
                "  ⚠ Finding 3 — Docs 2 + 4: Charge of $4,200 matches the modified booking",
                "    Email: 3 nights (Feb 10–13) at Executive Suite",
                "    Folio: $1,200/night × 3 = $3,600 + $600 incidentals = $4,200.00",
                "    No unexplained charges — math is internally consistent",
                "",
                "  ⚠ Finding 4 — Docs 1 + 2: Guest identity is the cardholder",
                "    Check-in scan: signature + driver license *8834 for Katherine E. Whitfield",
                "    Email thread: sent from katherine.whitfield@bellvue-partners.com",
                "    Physical ID + digital identity match — no third-party dispute possible",
                "",
                "23 facts extracted + 4 cross-document findings in 4.2 seconds"
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
                    id: "doc3-policy",
                    type: "file",
                    label: "Document 3 — Hotel Cancellation & Modification Policy",
                    pdfPath: "/pdfs/chb005_cancellation_policy.pdf"
                },
                {
                    id: "doc4-folio",
                    type: "file",
                    label: "Document 4 — Hotel Folio / Itemized Invoice",
                    pdfPath: "/pdfs/chb005_hotel_folio.pdf"
                },
                {
                    id: "extraction-summary",
                    type: "json",
                    label: "Extraction Summary — All 4 Documents",
                    data: {
                        totalDocumentsProcessed: 4,
                        totalFactsExtracted: 23,
                        crossDocumentFindings: 4,
                        processingTime: "4.2 seconds",
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
                        document3_cancellationPolicy: {
                            type: "PDF (terms and conditions)",
                            freeCancellationWindow: "72 hours before check-in",
                            modificationPolicy: "Date changes within 48 hours of new check-in are non-refundable",
                            modificationBinding: "Revised booking becomes non-refundable per Section 4.2(b)"
                        },
                        document4_hotelFolio: {
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
                                finding: "Revised booking is non-refundable",
                                sources: ["Document 2 — Email Thread", "Document 3 — Cancellation Policy"],
                                synthesis: "Email proves MODIFICATION (not cancellation) + Policy Section 4.2(b) makes modifications non-refundable → cardholder forfeited cancellation rights on Feb 3"
                            },
                            {
                                finding: "Guest stayed Feb 10–13 (triple-confirmed)",
                                sources: ["Document 2 — Email Thread", "Document 1 — Check-In Scan", "Document 4 — Hotel Folio"],
                                synthesis: "Email: dates requested → Check-in: physical arrival Feb 10 → Folio: charges on Feb 10, 11, 12 prove continuous occupancy"
                            },
                            {
                                finding: "Charge of $4,200 matches modified booking",
                                sources: ["Document 2 — Email Thread", "Document 4 — Hotel Folio"],
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
                "    Section 4.2(b): date modifications create a new non-refundable booking",
                "    Confirmation GM-2026-88412-REV is binding",
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
                            sources: ["Document 4 — Hotel Folio"]
                        },
                        {
                            test: "Is the revised booking refundable?",
                            finding: "NO",
                            evidence: "Section 4.2(b): date modifications create non-refundable booking. Confirmation GM-2026-88412-REV is binding.",
                            sources: ["Document 3 — Cancellation Policy", "Document 2 — Email Thread"]
                        },
                        {
                            test: "Does the charge amount match?",
                            finding: "YES",
                            evidence: "Folio total $4,200.00 matches disputed amount. Breakdown: $3,600 room + $600 incidentals.",
                            sources: ["Document 4 — Hotel Folio"]
                        }
                    ],
                    summary: "4 independent evidence sources contradict the cardholder's claim across all 5 tests"
                }
            }]
        },
        {
            id: "step-4",
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
                "    Cancellation policy: Section 4.2(b) — revised booking is non-refundable",
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
                        "Cancellation policy: Section 4.2(b) non-refundable"
                    ],
                    recommendedAction: "Accept representment. Reverse provisional credit of $4,200.00.",
                    preArbitrationRisk: "LOW"
                }
            }]
        },
        {
            id: "step-5",
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
                "  Corroboration: Signed check-in + in-room charges + non-refundable policy",
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

            // --- Post-HITL Step 6: Email Draft ---
            await delay(2000);
            updateProcessLog(PROCESS_ID, {
                id: "step-6",
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                title: "Drafting representment acceptance response for Pega Correspondence...",
                status: "processing"
            });
            await updateProcessListStatus(PROCESS_ID, "In Progress", "Drafting Visa response for Pega dispatch...");
            await delay(2000);
            updateProcessLog(PROCESS_ID, {
                id: "step-6",
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
                    id: "visa-response-email",
                    type: "email_draft",
                    label: "Response to Visa — Representment Accepted",
                    data: {
                        from: "disputes@meridianbank.com",
                        to: "visa-disputes@visa.com",
                        subject: "RE: Chargeback CHB-2026-0731 — Representment Accepted, Provisional Credit Reversal",
                        body: "Dear Visa Dispute Resolution Team,\n\nRegarding Case CHB-2026-0731 (Visa RC 13.1 — Merchandise/Services Not Received), Meridian Bank has completed its review of the merchant representment submitted by Grand Meridian Hotel & Suites.\n\nAfter thorough analysis of the submitted evidence package, we have determined that the merchant's representment is valid and the cardholder's claim is not substantiated.\n\nKey Findings:\n\n1. The cardholder did not cancel the booking. Email correspondence dated February 3, 2026 shows the cardholder requested a date modification from Feb 5-8 to Feb 10-13, not a cancellation. The cardholder's exact words were: \"I need to move my dates to Feb 10-13 instead.\"\n\n2. The cardholder checked in and stayed at the hotel. A signed physical registration card (Feb 10 at 14:32 EST) and itemized folio showing minibar, room service, and spa charges across February 10-12 confirm physical occupancy.\n\n3. The revised booking is non-refundable. Per the hotel's cancellation policy Section 4.2(b), date modifications create a new non-refundable reservation. The revised confirmation (GM-2026-88412-REV) is binding.\n\nAction Taken:\n- Representment accepted in full\n- Provisional credit of $4,200.00 will be reversed to cardholder account ending ****4892\n- Merchant funds released\n\nEvidence package reference: 4 documents on file (check-in scan, email thread, cancellation policy, hotel folio).\n\nPlease confirm receipt and processing.\n\nRegards,\nMeridian Bank Disputes Team\nCase Reference: CHB-2026-0731"
                    }
                }]
            });
            await updateProcessListStatus(PROCESS_ID, "Needs Attention", "Review Visa response before dispatching via Pega");

            // Wait for the email Send button to be clicked
            await waitForEmailSent();
            await updateProcessListStatus(PROCESS_ID, "In Progress", "Response dispatched via Pega — closing case");

            // --- Post-Email Step 7: Pega Case Closure ---
            await delay(2000);
            updateProcessLog(PROCESS_ID, {
                id: "step-7",
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                title: "Pega Smart Dispute — Closing case...",
                status: "processing"
            });
            await updateProcessListStatus(PROCESS_ID, "In Progress", "Pega processing case closure and credit reversal...");
            await delay(2000);
            updateProcessLog(PROCESS_ID, {
                id: "step-7",
                title: "Pega Smart Dispute — Case Closed (Won — Representment Accepted)",
                status: "completed",
                reasoning: [
                    "Case closed — CHB-2026-0731:",
                    "  Resolution: Merchant representment accepted",
                    "  Provisional credit reversed: $4,200.00 to cardholder account ****4892",
                    "  Merchant: Grand Meridian Hotel & Suites — funds released",
                    "",
                    "  Deciding evidence: Email correspondence (cardholder requested date change, not cancellation)",
                    "  Corroboration: Signed check-in + in-room charges + non-refundable policy",
                    "  Confidence: 97.2%",
                    "  Pre-arbitration risk: LOW",
                    "",
                    "  Processing time: 28.4 seconds (vs ~52 minutes manual analyst average)",
                    "  Documents analyzed: 4",
                    "  Facts extracted: 23",
                    "  Human touchpoints: 2 (analyst approval + email review)",
                    "",
                    "  Case archived to Pega Smart Dispute — Case Management"
                ],
                artifacts: [{
                    id: "case-closure-cb005",
                    type: "json",
                    label: "Case Closure — CHB-2026-0731",
                    data: {
                        caseId: "CHB-2026-0731",
                        status: "CLOSED",
                        resolution: "Merchant Representment Accepted",
                        provisionalCreditReversed: "$4,200.00",
                        cardholderAccount: "****4892",
                        merchantName: "Grand Meridian Hotel & Suites",
                        processingTime: "28.4 seconds",
                        documentsAnalyzed: 4,
                        factsExtracted: 23,
                        confidenceScore: "97.2%",
                        preArbitrationRisk: "LOW",
                        closedBy: "Pace Intelligence Layer + Analyst Approval",
                        archivedTo: "Pega Smart Dispute — Case Management"
                    }
                }]
            });
            await updateProcessListStatus(PROCESS_ID, "Done", "Pega Smart Dispute — Case Closed (Won — Representment Accepted)");
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
