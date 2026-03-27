const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { exec } = require('child_process');

// Graceful dotenv load (Railway/Vercel set env vars natively)
try { require('dotenv').config(); } catch(e) {}

const { GoogleGenerativeAI } = require('@google/generative-ai');

const PORT = process.env.PORT || 3001;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(PUBLIC_DIR, 'data');
const SNAPSHOTS_DIR = path.join(DATA_DIR, 'snapshots');
const KB_FILE = path.join(__dirname, 'src/data/knowledgeBase.md');
const FEEDBACK_QUEUE_PATH = path.join(DATA_DIR, 'feedbackQueue.json');
const KB_VERSIONS_PATH = path.join(DATA_DIR, 'kbVersions.json');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(SNAPSHOTS_DIR)) fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });

// Initialize processes.json from base_processes.json if not exists
const baseProcessesPath = path.join(DATA_DIR, 'base_processes.json');
const processesPath = path.join(DATA_DIR, 'processes.json');
if (fs.existsSync(baseProcessesPath)) {
    fs.copyFileSync(baseProcessesPath, processesPath);
    console.log('Initialized processes.json from base_processes.json');
}

// Initialize interaction-signals.json
const signalFilePath = path.join(__dirname, 'interaction-signals.json');
if (!fs.existsSync(signalFilePath)) {
    fs.writeFileSync(signalFilePath, JSON.stringify({
        APPROVE_EVIDENCE_CB002: false,
        APPROVE_PARTIAL_REFUND_CB003: false,
        APPROVE_EVIDENCE_REQUEST_CB004: false,
        APPROVE_REPRESENTMENT_CB005: false
    }, null, 4));
}

// Initialize feedback queue and KB versions
if (!fs.existsSync(FEEDBACK_QUEUE_PATH)) {
    fs.writeFileSync(FEEDBACK_QUEUE_PATH, '[]');
}
if (!fs.existsSync(KB_VERSIONS_PATH)) {
    fs.writeFileSync(KB_VERSIONS_PATH, '[]');
}

// State management
let state = { sent: false, confirmed: false, signals: {} };
const runningProcesses = new Map();

// CORS headers (MUST include DELETE for FeedbackQueuePanel.jsx)
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webm': 'video/webm',
    '.mp4': 'video/mp4',
    '.pdf': 'application/pdf',
    '.md': 'text/markdown'
};

// Helper: Send JSON response
const sendJson = (res, statusCode, data) => {
    res.writeHead(statusCode, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
};

// Helper: Send error
const sendError = (res, statusCode, message) => {
    sendJson(res, statusCode, { error: message });
};

// Helper: Read request body
const readBody = (req) => {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => resolve(body));
        req.on('error', reject);
    });
};

// Gemini client
let genAI;
try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
        genAI = new GoogleGenerativeAI(apiKey);
    } else {
        console.warn('⚠️  GEMINI_API_KEY not set. Chat features will be disabled.');
    }
} catch (e) {
    console.error('Failed to initialize Gemini client:', e.message);
}

// HTTP Server
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const cleanPath = parsedUrl.pathname.replace(/\/+$/, '') || '/';

    // CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, corsHeaders);
        res.end();
        return;
    }

    // === RESET ENDPOINT ===
    if (cleanPath === '/reset') {
        state = { sent: false, confirmed: false, signals: {} };
        console.log('🔄 Demo Reset Triggered');

        // Reset signals file
        fs.writeFileSync(signalFilePath, JSON.stringify({
            APPROVE_EVIDENCE_CB002: false,
            APPROVE_PARTIAL_REFUND_CB003: false,
            APPROVE_EVIDENCE_REQUEST_CB004: false,
            APPROVE_REPRESENTMENT_CB005: false
        }, null, 4));

        // Kill existing tracked processes
        runningProcesses.forEach((proc, id) => {
            try {
                process.kill(-proc.pid, 'SIGKILL');
            } catch (e) { }
        });
        runningProcesses.clear();

        // Kill straggler simulation processes
        exec('pkill -9 -f "node(.*)simulation_scripts" || true', (err) => {
            setTimeout(() => {
                // Initialize cases
                const cases = [
                    {
                        id: "CHB_001",
                        category: "Dispute Resolution",
                        name: "NovaTech Electronics \u2014 Merchandise Not Received",
                        stockId: "CHB-2026-0147",
                        year: new Date().toISOString().split('T')[0],
                        status: "In Progress",
                        currentStatus: "Initializing...",
                        caseId: "CHB-2026-0147",
                        reasonCode: "Visa 13.1",
                        disputeAmount: "$2,847.00",
                        cardholderName: "James R. Patterson",
                        merchantName: "NovaTech Electronics"
                    },
                    {
                        id: "CHB_002",
                        category: "Dispute Resolution",
                        name: "Artisan Home Furnishings \u2014 Friendly Fraud Detection",
                        stockId: "CHB-2026-0289",
                        year: new Date().toISOString().split('T')[0],
                        status: "In Progress",
                        currentStatus: "Initializing...",
                        caseId: "CHB-2026-0289",
                        reasonCode: "Visa 13.3",
                        disputeAmount: "$6,420.00",
                        cardholderName: "Sarah M. Chen",
                        merchantName: "Artisan Home Furnishings"
                    },
                    {
                        id: "CHB_003",
                        category: "Dispute Resolution",
                        name: "CloudFit Athletic Gear \u2014 Pre-Arb Cost-Benefit Reversal",
                        stockId: "CHB-2026-0412",
                        year: new Date().toISOString().split('T')[0],
                        status: "In Progress",
                        currentStatus: "Initializing...",
                        caseId: "CHB-2026-0412",
                        reasonCode: "Visa 10.4",
                        disputeAmount: "$1,180.00",
                        cardholderName: "David L. Morrison",
                        merchantName: "CloudFit Athletic Gear"
                    },
                    {
                        id: "CHB_004",
                        category: "Dispute Resolution",
                        name: "Pinnacle Electronics \u2014 Missing Evidence Escalation",
                        stockId: "CHB-2026-0583",
                        year: new Date().toISOString().split('T')[0],
                        status: "In Progress",
                        currentStatus: "Initializing...",
                        caseId: "CHB-2026-0583",
                        reasonCode: "Visa 13.1",
                        disputeAmount: "$1,948.00",
                        cardholderName: "Michael T. Rivera",
                        merchantName: "Pinnacle Electronics"
                    }
                    ,
                    {
                        id: "CHB_005",
                        category: "Dispute Resolution",
                        name: "Grand Meridian Hotel \u2014 Representment Document Analysis",
                        stockId: "CHB-2026-0731",
                        year: new Date().toISOString().split('T')[0],
                        status: "In Progress",
                        currentStatus: "Initializing...",
                        caseId: "CHB-2026-0731",
                        reasonCode: "Visa 13.1",
                        disputeAmount: "$4,200.00",
                        cardholderName: "Katherine E. Whitfield",
                        merchantName: "Grand Meridian Hotel \u0026 Suites"
                    },
                    {
                        id: "CHB_006",
                        category: "Dispute Resolution",
                        name: "TechVault Electronics \u2014 Premature Dispute Hold",
                        stockId: "CHB-2026-0588",
                        year: new Date().toISOString().split('T')[0],
                        status: "In Progress",
                        currentStatus: "Initializing...",
                        caseId: "CHB-2026-0588",
                        reasonCode: "Visa 13.1",
                        disputeAmount: "$892.00",
                        cardholderName: "Marcus J. Rivera",
                        merchantName: "TechVault Electronics"
                    }
                ];
                fs.writeFileSync(processesPath, JSON.stringify(cases, null, 4));

                // Reset feedback queue and KB versions
                fs.writeFileSync(FEEDBACK_QUEUE_PATH, '[]');
                fs.writeFileSync(KB_VERSIONS_PATH, '[]');

                // Launch scripts with staggered delay
                // Reset email-status for CHB_004
                state.sent = false;

                const scripts = [
                    { file: 'CB_001_legitimate_purchase.cjs', id: 'CB_001' },
                    { file: 'CB_002_friendly_fraud.cjs', id: 'CB_002' },
                    { file: 'CB_003_partial_refund.cjs', id: 'CB_003' },
                    { file: 'CB_004_missing_evidence.cjs', id: 'CB_004' },
                    { file: 'CB_005_hotel_booking.cjs', id: 'CB_005' },
                    { file: 'CB_006_premature_dispute.cjs', id: 'CB_006' }
                ];

                let totalDelay = 0;
                scripts.forEach((script) => {
                    setTimeout(() => {
                        const scriptPath = path.join(__dirname, 'simulation_scripts', script.file);
                        const child = exec(
                            `node "${scriptPath}" > "${scriptPath}.log" 2>&1`,
                            (error) => {
                                if (error && error.code !== 0) {
                                    console.error(`${script.file} error:`, error.message);
                                }
                                runningProcesses.delete(script.id);
                            }
                        );
                        runningProcesses.set(script.id, child);
                    }, totalDelay * 1000);
                    totalDelay += 2;
                });
            }, 1000);
        });

        sendJson(res, 200, { status: 'ok' });
        return;
    }

    // === EMAIL STATUS ENDPOINTS ===
    if (cleanPath === '/email-status') {
        if (req.method === 'GET') {
            sendJson(res, 200, { sent: state.sent });
            return;
        }
        if (req.method === 'POST') {
            const body = await readBody(req);
            const parsed = JSON.parse(body);
            state.sent = parsed.sent;
            sendJson(res, 200, { status: 'ok' });
            return;
        }
    }

    // === SIGNAL ENDPOINTS ===
    if (cleanPath === '/signal-status') {
        sendJson(res, 200, state.signals);
        return;
    }

    if (cleanPath === '/signal' && req.method === 'POST') {
        const body = await readBody(req);
        const parsed = JSON.parse(body);
        const sigName = parsed.signal || parsed.name;
        if (sigName) {
            state.signals[sigName] = true;
            if (fs.existsSync(signalFilePath)) {
                const signals = JSON.parse(fs.readFileSync(signalFilePath, 'utf8'));
                signals[sigName] = true;
                fs.writeFileSync(signalFilePath, JSON.stringify(signals, null, 4));
            }
        }
        sendJson(res, 200, { status: 'ok' });
        return;
    }

    // === UPDATE STATUS ENDPOINT (called by simulation scripts) ===
    if (cleanPath === '/api/update-status' && req.method === 'POST') {
        const body = await readBody(req);
        const parsed = JSON.parse(body);
        try {
            const processes = JSON.parse(fs.readFileSync(processesPath, 'utf8'));
            const idx = processes.findIndex(p => p.id === String(parsed.id));
            if (idx !== -1) {
                processes[idx].status = parsed.status;
                processes[idx].currentStatus = parsed.currentStatus;
                fs.writeFileSync(processesPath, JSON.stringify(processes, null, 4));
            }
            sendJson(res, 200, { status: 'ok' });
        } catch (e) {
            sendError(res, 500, e.message);
        }
        return;
    }

    // === CHAT ENDPOINT (handles both KB chat and Work-with-Pace chat) ===
    if (cleanPath === '/api/chat' && req.method === 'POST') {
        if (!genAI) {
            sendError(res, 503, 'Gemini API not configured');
            return;
        }
        try {
            const body = await readBody(req);
            const parsed = JSON.parse(body);

            let messages = [];
            let systemPrompt = '';

            // Detect contract type
            if (parsed.messages && parsed.systemPrompt) {
                // Work-with-Pace contract
                messages = parsed.messages;
                systemPrompt = parsed.systemPrompt;
            } else {
                // KB chat contract
                const { message, knowledgeBase, history } = parsed;
                systemPrompt = `You are a helpful assistant with knowledge about chargeback dispute resolution.

Use the following knowledge base to answer questions:

${knowledgeBase}

If the question is not covered in the knowledge base, politely say so and offer general guidance if appropriate.`;

                messages = (history || []).map(h => ({
                    role: h.role === 'user' ? 'user' : 'model',
                    parts: [{ text: h.content }]
                }));
                messages.push({ role: 'user', parts: [{ text: message }] });
            }

            const model = genAI.getGenerativeModel({
                model: process.env.VITE_MODEL || 'gemini-2.0-flash-exp'
            });

            const chat = model.startChat({
                history: messages.slice(0, -1),
                generationConfig: { maxOutputTokens: 2048 }
            });

            if (systemPrompt) {
                const contextMsg = { role: 'user', parts: [{ text: systemPrompt }] };
                chat._history.unshift(contextMsg);
                chat._history.unshift({ role: 'model', parts: [{ text: 'Understood. I will use this context to answer questions.' }] });
            }

            const result = await chat.sendMessage(messages[messages.length - 1].parts[0].text);
            const response = result.response.text();

            sendJson(res, 200, { response });
        } catch (e) {
            console.error('Chat error:', e);
            sendError(res, 500, e.message);
        }
        return;
    }

    // === FEEDBACK QUESTIONS ENDPOINT ===
    if (cleanPath === '/api/feedback/questions' && req.method === 'POST') {
        if (!genAI) {
            sendError(res, 503, 'Gemini API not configured');
            return;
        }
        try {
            const body = await readBody(req);
            const parsed = JSON.parse(body);
            const { feedback, knowledgeBase } = parsed;

            const model = genAI.getGenerativeModel({
                model: process.env.VITE_MODEL || 'gemini-2.0-flash-exp'
            });

            const prompt = `You are helping to improve a knowledge base about chargeback dispute resolution.

Current Knowledge Base:
${knowledgeBase}

User Feedback:
"${feedback}"

Generate exactly 3 clarifying questions to help understand what changes the user wants. Questions should be:
- Specific and actionable
- Help clarify scope, details, or intent
- Be answerable in 1-2 sentences

Return ONLY a JSON array of 3 strings (the questions), nothing else.`;

            const result = await model.generateContent(prompt);
            const responseText = result.response.text().trim();
            const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const questions = JSON.parse(cleaned);

            sendJson(res, 200, { questions });
        } catch (e) {
            console.error('Questions generation error:', e);
            sendError(res, 500, e.message);
        }
        return;
    }

    // === FEEDBACK SUMMARIZE ENDPOINT ===
    if (cleanPath === '/api/feedback/summarize' && req.method === 'POST') {
        if (!genAI) {
            sendError(res, 503, 'Gemini API not configured');
            return;
        }
        try {
            const body = await readBody(req);
            const parsed = JSON.parse(body);
            const { feedback, questions, answers, knowledgeBase } = parsed;

            const model = genAI.getGenerativeModel({
                model: process.env.VITE_MODEL || 'gemini-2.0-flash-exp'
            });

            let qaSection = '';
            questions.forEach((q, i) => {
                qaSection += `Q${i+1}: ${q}\nA${i+1}: ${answers[i]}\n\n`;
            });

            const prompt = `You are helping to improve a knowledge base about chargeback dispute resolution.

Current Knowledge Base:
${knowledgeBase}

User Feedback:
"${feedback}"

Clarifying Questions & Answers:
${qaSection}

Based on the feedback and answers, generate a clear, concise summary of the proposed change.
The summary should:
- Describe what will be added, removed, or modified
- Be 2-3 sentences
- Be specific enough that someone can understand the change without seeing the Q&A

Return ONLY the summary text, nothing else.`;

            const result = await model.generateContent(prompt);
            const summary = result.response.text().trim();

            sendJson(res, 200, { summary });
        } catch (e) {
            console.error('Summarize error:', e);
            sendError(res, 500, e.message);
        }
        return;
    }

    // === FEEDBACK QUEUE ENDPOINTS ===
    if (cleanPath === '/api/feedback/queue') {
        if (req.method === 'GET') {
            try {
                const queue = JSON.parse(fs.readFileSync(FEEDBACK_QUEUE_PATH, 'utf8'));
                sendJson(res, 200, { queue });
            } catch (e) {
                sendJson(res, 200, { queue: [] });
            }
            return;
        }
        if (req.method === 'POST') {
            try {
                const body = await readBody(req);
                const item = JSON.parse(body);
                const queue = JSON.parse(fs.readFileSync(FEEDBACK_QUEUE_PATH, 'utf8'));
                queue.push({ ...item, status: 'pending', timestamp: new Date().toISOString() });
                fs.writeFileSync(FEEDBACK_QUEUE_PATH, JSON.stringify(queue, null, 2));
                sendJson(res, 200, { status: 'ok' });
            } catch (e) {
                sendError(res, 500, e.message);
            }
            return;
        }
    }

    // === DELETE FEEDBACK ITEM ===
    if (cleanPath.startsWith('/api/feedback/queue/') && req.method === 'DELETE') {
        try {
            const itemId = cleanPath.split('/').pop();
            const queue = JSON.parse(fs.readFileSync(FEEDBACK_QUEUE_PATH, 'utf8'));
            const filtered = queue.filter(item => item.id !== itemId);
            fs.writeFileSync(FEEDBACK_QUEUE_PATH, JSON.stringify(filtered, null, 2));
            sendJson(res, 200, { status: 'ok' });
        } catch (e) {
            sendError(res, 500, e.message);
        }
        return;
    }

    // === APPLY FEEDBACK ENDPOINT ===
    if (cleanPath === '/api/feedback/apply' && req.method === 'POST') {
        if (!genAI) {
            sendError(res, 503, 'Gemini API not configured');
            return;
        }
        try {
            const body = await readBody(req);
            const parsed = JSON.parse(body);
            const { feedbackId } = parsed;

            const queue = JSON.parse(fs.readFileSync(FEEDBACK_QUEUE_PATH, 'utf8'));
            const item = queue.find(i => i.id === feedbackId);
            if (!item) {
                sendError(res, 404, 'Feedback item not found');
                return;
            }

            const currentKB = fs.readFileSync(KB_FILE, 'utf8');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const previousFile = `kb-before-${timestamp}.md`;
            const snapshotFile = `kb-after-${timestamp}.md`;

            // Save "before" snapshot
            fs.writeFileSync(path.join(SNAPSHOTS_DIR, previousFile), currentKB);

            // Generate updated KB
            const model = genAI.getGenerativeModel({
                model: process.env.VITE_MODEL || 'gemini-2.0-flash-exp'
            });

            let qaSection = '';
            if (item.questions && item.answers) {
                item.questions.forEach((q, i) => {
                    qaSection += `Q${i+1}: ${q}\nA${i+1}: ${item.answers[i]}\n\n`;
                });
            }

            const prompt = `You are updating a knowledge base document about chargeback dispute resolution.

Current Knowledge Base:
${currentKB}

User Feedback:
"${item.feedback}"

${qaSection ? `Clarifying Questions & Answers:\n${qaSection}` : ''}

Summary of Change:
${item.summary}

Generate the COMPLETE updated knowledge base with the requested changes applied.
Maintain the existing structure and formatting.
Return ONLY the updated markdown content, nothing else (no code fences, no explanations).`;

            const result = await model.generateContent(prompt);
            let updatedKB = result.response.text().trim();
            updatedKB = updatedKB.replace(/```markdown\n?/g, '').replace(/```\n?/g, '').trim();

            // Save "after" snapshot and update live KB
            fs.writeFileSync(path.join(SNAPSHOTS_DIR, snapshotFile), updatedKB);
            fs.writeFileSync(KB_FILE, updatedKB);

            // Update version history
            const versions = JSON.parse(fs.readFileSync(KB_VERSIONS_PATH, 'utf8'));
            versions.push({
                id: `v${versions.length + 1}`,
                timestamp: new Date().toISOString(),
                snapshotFile,
                previousFile,
                changes: [item.summary]
            });
            fs.writeFileSync(KB_VERSIONS_PATH, JSON.stringify(versions, null, 2));

            // Remove item from queue
            const updatedQueue = queue.filter(i => i.id !== feedbackId);
            fs.writeFileSync(FEEDBACK_QUEUE_PATH, JSON.stringify(updatedQueue, null, 2));

            sendJson(res, 200, { success: true, content: updatedKB });
        } catch (e) {
            console.error('Apply feedback error:', e);
            sendError(res, 500, e.message);
        }
        return;
    }

    // === KB CONTENT ENDPOINT (with optional version) ===
    if (cleanPath === '/api/kb/content' && req.method === 'GET') {
        try {
            const versionId = parsedUrl.query.versionId;
            if (versionId) {
                const versions = JSON.parse(fs.readFileSync(KB_VERSIONS_PATH, 'utf8'));
                const version = versions.find(v => v.id === versionId);
                if (version) {
                    const content = fs.readFileSync(path.join(SNAPSHOTS_DIR, version.snapshotFile), 'utf8');
                    sendJson(res, 200, { content });
                } else {
                    sendError(res, 404, 'Version not found');
                }
            } else {
                const content = fs.readFileSync(KB_FILE, 'utf8');
                sendJson(res, 200, { content });
            }
        } catch (e) {
            sendError(res, 500, e.message);
        }
        return;
    }

    // === KB VERSIONS ENDPOINT ===
    if (cleanPath === '/api/kb/versions' && req.method === 'GET') {
        try {
            const versions = JSON.parse(fs.readFileSync(KB_VERSIONS_PATH, 'utf8'));
            sendJson(res, 200, { versions });
        } catch (e) {
            sendJson(res, 200, { versions: [] });
        }
        return;
    }

    // === KB SNAPSHOT ENDPOINT ===
    if (cleanPath.startsWith('/api/kb/snapshot/') && req.method === 'GET') {
        try {
            const filename = cleanPath.split('/').pop();
            const content = fs.readFileSync(path.join(SNAPSHOTS_DIR, filename), 'utf8');
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'text/markdown' });
            res.end(content);
        } catch (e) {
            sendError(res, 404, 'Snapshot not found');
        }
        return;
    }

    // === KB UPDATE ENDPOINT ===
    if (cleanPath === '/api/kb/update' && req.method === 'POST') {
        try {
            const body = await readBody(req);
            const parsed = JSON.parse(body);
            fs.writeFileSync(KB_FILE, parsed.content);
            sendJson(res, 200, { status: 'ok' });
        } catch (e) {
            sendError(res, 500, e.message);
        }
        return;
    }

    // === DEBUG PATHS ENDPOINT ===
    if (cleanPath === '/debug-paths') {
        sendJson(res, 200, {
            publicDir: PUBLIC_DIR,
            dataDir: DATA_DIR,
            processesFile: processesPath,
            exists: fs.existsSync(processesPath)
        });
        return;
    }

    // === STATIC FILE SERVING ===
    let filePath = path.join(PUBLIC_DIR, cleanPath === '/' ? 'index.html' : cleanPath);

    // Security check
    if (!filePath.startsWith(PUBLIC_DIR)) {
        sendError(res, 403, 'Forbidden');
        return;
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
        // Try appending .html
        if (fs.existsSync(filePath + '.html')) {
            filePath = filePath + '.html';
        } else {
            // Fallback to index.html for SPA routing
            filePath = path.join(PUBLIC_DIR, 'index.html');
        }
    }

    // Handle directories
    if (fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
    }

    // Determine content type
    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Read and serve file
    try {
        const content = fs.readFileSync(filePath);
        res.writeHead(200, { ...corsHeaders, 'Content-Type': contentType });
        res.end(content);
    } catch (e) {
        sendError(res, 404, 'File not found');
    }
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Chargeback Dispute Demo Server running on port ${PORT}`);
    console.log(`   Data directory: ${DATA_DIR}`);
    console.log(`   Processes file: ${processesPath}`);
    console.log(`   Gemini API: ${genAI ? '✅ Connected' : '❌ Not configured'}`);
});
