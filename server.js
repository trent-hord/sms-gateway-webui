require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const fetch = require('node-fetch');

class NodeFetchClient {
    async request(url, method, body, headers) {
        const options = {
            method,
            headers: {
                ...headers,
                'Content-Type': 'application/json',
            },
        };
        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);
        if (!response.ok) {
            let errorMsg = `HTTP Error ${response.status} ${response.statusText}`;
            try {
                const errorData = await response.json();
                errorMsg += ` - ${JSON.stringify(errorData)}`;
            } catch (e) {
                // ignore json parse error
            }
            throw new Error(errorMsg);
        }

        // Handle empty responses
        const text = await response.text();
        return text ? JSON.parse(text) : {};
    }

    get(url, headers) {
        return this.request(url, 'GET', null, headers);
    }
    post(url, body, headers) {
        return this.request(url, 'POST', body, headers);
    }
    put(url, body, headers) {
        return this.request(url, 'PUT', body, headers);
    }
    patch(url, body, headers) {
        return this.request(url, 'PATCH', body, headers);
    }
    delete(url, headers) {
        return this.request(url, 'DELETE', null, headers);
    }
}

const DEFAULT_GATEWAY_URL = 'https://api.sms-gate.app/3rdparty/v1';
const JOBS_FILE = process.env.JOBS_FILE || path.join(__dirname, 'jobs.json');
const CONTACTS_FILE = process.env.CONTACTS_FILE || path.join(__dirname, 'contacts.json');
const HISTORY_FILE = process.env.HISTORY_FILE || path.join(__dirname, 'history.json');
const SETTINGS_FILE = process.env.SETTINGS_FILE || path.join(__dirname, 'settings.json');

class SmsGatewayClient {
    constructor(login, password, httpClient, baseUrl) {
        this.baseUrl = normalizeGatewayUrl(baseUrl);
        this.httpClient = httpClient;
        this.defaultHeaders = {
            'User-Agent': 'sms-gateway-webui/1.0',
            Authorization: `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`
        };
    }

    send(request) {
        return this.httpClient.post(`${this.baseUrl}/messages`, request, this.defaultHeaders);
    }

    getHealth() {
        return this.httpClient.get(`${this.baseUrl}/health`, this.defaultHeaders);
    }
}

function ensureJsonFile(filePath, defaultValue) {
    if (fs.existsSync(filePath)) {
        return;
    }

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
}

ensureJsonFile(JOBS_FILE, []);
ensureJsonFile(CONTACTS_FILE, []);
ensureJsonFile(HISTORY_FILE, []);
ensureJsonFile(SETTINGS_FILE, {});

function normalizeGatewayUrl(gatewayUrl) {
    return gatewayUrl.trim().replace(/\/+$/, '');
}

function validateGatewayUrl(gatewayUrl) {
    if (!gatewayUrl || typeof gatewayUrl !== 'string') {
        return 'Gateway URL is required.';
    }

    let parsed;
    try {
        parsed = new URL(gatewayUrl);
    } catch (e) {
        return 'Gateway URL must be a valid URL.';
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
        return 'Gateway URL must start with http:// or https://.';
    }

    return null;
}

function getEnvGatewayUrl() {
    return normalizeGatewayUrl(process.env.GATEWAY_URL || DEFAULT_GATEWAY_URL);
}

function getSettings() {
    let savedSettings = {};
    try {
        const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
        savedSettings = JSON.parse(data);
    } catch (e) {
        savedSettings = {};
    }

    const savedGatewayUrl = typeof savedSettings.gatewayUrl === 'string'
        ? normalizeGatewayUrl(savedSettings.gatewayUrl)
        : '';
    const gatewayUrl = savedGatewayUrl || getEnvGatewayUrl();

    return {
        gatewayUrl,
        savedGatewayUrl,
        source: savedGatewayUrl ? 'saved' : (process.env.GATEWAY_URL ? 'env' : 'default'),
        defaultGatewayUrl: DEFAULT_GATEWAY_URL
    };
}

function saveSettings(settings) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

function getGatewayUrl() {
    return getSettings().gatewayUrl;
}

function getJobs() {
    try {
        const data = fs.readFileSync(JOBS_FILE, 'utf8');
        let jobs = JSON.parse(data);
        let updated = false;
        jobs = jobs.map(j => {
            if (!j.id) {
                j.id = require('crypto').randomBytes(8).toString('hex');
                updated = true;
            }
            return j;
        });
        if (updated) saveJobs(jobs);
        return jobs;
    } catch (e) {
        return [];
    }
}

function saveJobs(jobs) {
    fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2));
}

function getContacts() {
    try {
        const data = fs.readFileSync(CONTACTS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

function saveContacts(contacts) {
    fs.writeFileSync(CONTACTS_FILE, JSON.stringify(contacts, null, 2));
}

function getHistory() {
    try {
        const data = fs.readFileSync(HISTORY_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

function saveHistory(history) {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

function addToHistory(request, status, details = null) {
    const history = getHistory();
    history.unshift({
        id: require('crypto').randomBytes(8).toString('hex'),
        timestamp: Date.now(),
        message: request.message,
        phoneNumbers: request.phoneNumbers,
        status: status,
        details: details
    });
    // Keep only last 100 entries
    if (history.length > 100) {
        history.length = 100;
    }
    saveHistory(history);
}

function calculateNextOccurrence(time, recurring) {
    const date = new Date(time);
    if (recurring === 'daily') {
        date.setDate(date.getDate() + 1);
    } else if (recurring === 'weekly') {
        date.setDate(date.getDate() + 7);
    } else if (recurring === 'monthly') {
        date.setMonth(date.getMonth() + 1);
    }
    return date.getTime();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendSmsWithRecipientDelay(client, request) {
    const shouldDelayBetweenRecipients = request.phoneNumbers.length > 2;
    const states = [];

    for (let i = 0; i < request.phoneNumbers.length; i++) {
        const phoneNumber = request.phoneNumbers[i];
        const state = await client.send({
            message: request.message,
            phoneNumbers: [phoneNumber],
        });

        states.push({
            phoneNumber,
            state,
        });

        if (shouldDelayBetweenRecipients && i < request.phoneNumbers.length - 1) {
            await sleep(2000);
        }
    }

    return states;
}

// Background task to process scheduled messages
cron.schedule('* * * * *', async () => {
    const jobs = getJobs();
    const now = Date.now();
    const pendingJobs = [];
    const jobsToRun = [];

    for (const job of jobs) {
        if (job.scheduledTime <= now) {
            jobsToRun.push(job);
        } else {
            pendingJobs.push(job);
        }
    }

    if (jobsToRun.length > 0) {
        saveJobs(pendingJobs); // Save remaining jobs immediately to avoid duplicates on crash

        const login = process.env.GATEWAY_LOGIN;
        const password = process.env.GATEWAY_PASSWORD;
        const baseUrl = getGatewayUrl();

        if (login && password) {
            const httpClient = new NodeFetchClient();
            const client = new SmsGatewayClient(login, password, httpClient, baseUrl);

            for (const job of jobsToRun) {
                try {
                    await sendSmsWithRecipientDelay(client, job.request);
                    console.log(`[Cron] Sent scheduled message to ${job.request.phoneNumbers.length} recipients`);
                    addToHistory(job.request, 'sent', 'Scheduled message sent');

                    if (job.recurring) {
                        const nextTime = calculateNextOccurrence(job.scheduledTime, job.recurring);
                        const allJobs = getJobs();
                        allJobs.push({
                            id: require('crypto').randomBytes(8).toString('hex'),
                            scheduledTime: nextTime,
                            request: job.request,
                            recurring: job.recurring
                        });
                        saveJobs(allJobs);
                        console.log(`[Cron] Scheduled next occurrence for recurring message (recurring: ${job.recurring})`);
                    }
                } catch (err) {
                    console.error('[Cron] Error sending scheduled SMS:', err);
                    addToHistory(job.request, 'failed', err.message);
                    // In a more robust system, we might add this back to pendingJobs with a retry count
                }
            }
        } else {
            console.error('[Cron] Cannot send scheduled messages: Gateway credentials are not configured.');
        }
    }
});

app.post('/send-sms', async (req, res) => {
    try {
        const { message, phoneNumbers, scheduledAt, recurring } = req.body;

        if (!message || !phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
            return res.status(400).json({ error: 'Message and an array of phone numbers are required.' });
        }

        const login = process.env.GATEWAY_LOGIN;
        const password = process.env.GATEWAY_PASSWORD;
        const baseUrl = getGatewayUrl();

        if (!login || !password) {
            return res.status(500).json({ error: 'Gateway credentials are not configured.' });
        }

        const httpClient = new NodeFetchClient();
        const client = new SmsGatewayClient(login, password, httpClient, baseUrl);

        const request = {
            message: message,
            phoneNumbers: phoneNumbers,
        };

        let delay = 0;
        if (scheduledAt) {
            const scheduledTime = new Date(scheduledAt).getTime();
            delay = scheduledTime - Date.now();
        }

        if (delay > 0) {
            // To ensure the client wrapper doesn't fail immediately with bad credentials, check health first
            await client.getHealth(); // This will throw 401 if unauthorized

            const jobs = getJobs();
            jobs.push({
                id: require('crypto').randomBytes(8).toString('hex'),
                scheduledTime: new Date(scheduledAt).getTime(),
                request: request,
                recurring: recurring
            });
            saveJobs(jobs);

            res.json({
                success: true,
                message: 'Message scheduled successfully',
                scheduledFor: new Date(Date.now() + delay).toISOString()
            });
        } else {
            const state = await sendSmsWithRecipientDelay(client, request);
            addToHistory(request, 'sent', 'Message sent successfully');

            if (recurring) {
                const jobs = getJobs();
                const nextTime = calculateNextOccurrence(Date.now(), recurring);
                jobs.push({
                    id: require('crypto').randomBytes(8).toString('hex'),
                    scheduledTime: nextTime,
                    request: request,
                    recurring: recurring
                });
                saveJobs(jobs);
                console.log(`[Send-SMS] Message sent immediately and scheduled next occurrence for recurring message (recurring: ${recurring})`);
            }

            res.json({
                success: true,
                message: 'Message sent successfully to the gateway',
                state: state
            });
        }
    } catch (error) {
        console.error('Error sending SMS:', error);
        
        // Only add to history if it's not a scheduling request (delay <= 0)
        // Or actually, maybe we should log failed attempts too? 
        // But the request object might not be fully formed if it failed early.
        // Let's at least log if it was an attempt to send now.
        if (req.body && req.body.message && req.body.phoneNumbers) {
            addToHistory({ 
                message: req.body.message, 
                phoneNumbers: req.body.phoneNumbers 
            }, 'failed', error.message);
        }

        res.status(500).json({
            error: 'Failed to send SMS via gateway',
            details: error.message
        });
    }
});

app.get('/settings', (req, res) => {
    res.json(getSettings());
});

app.put('/settings', (req, res) => {
    const gatewayUrl = typeof req.body.gatewayUrl === 'string'
        ? normalizeGatewayUrl(req.body.gatewayUrl)
        : '';
    const validationError = validateGatewayUrl(gatewayUrl);

    if (validationError) {
        return res.status(400).json({ error: validationError });
    }

    saveSettings({ gatewayUrl });

    res.json({
        success: true,
        message: 'Settings saved successfully',
        settings: getSettings()
    });
});

// History endpoint
app.get('/history', (req, res) => {
    res.json(getHistory());
});

app.delete('/history', (req, res) => {
    saveHistory([]);
    res.json({ success: true, message: 'History cleared' });
});

app.delete('/history/:id', (req, res) => {
    let history = getHistory();
    const initialLength = history.length;
    history = history.filter(item => item.id !== req.params.id);
    if (history.length !== initialLength) {
        saveHistory(history);
        res.json({ success: true, message: 'History entry deleted' });
    } else {
        res.status(404).json({ error: 'History entry not found' });
    }
});

app.get('/jobs', (req, res) => {
    res.json(getJobs());
});

app.delete('/jobs/:id', (req, res) => {
    let jobs = getJobs();
    const initialLength = jobs.length;
    jobs = jobs.filter(j => j.id !== req.params.id);
    if (jobs.length !== initialLength) {
        saveJobs(jobs);
        res.json({ success: true, message: 'Job deleted' });
    } else {
        res.status(404).json({ error: 'Job not found' });
    }
});

app.put('/jobs/:id', (req, res) => {
    const { message, phoneNumbers, scheduledAt, recurring } = req.body;
    let jobs = getJobs();
    const jobIndex = jobs.findIndex(j => j.id === req.params.id);
    if (jobIndex === -1) {
        return res.status(404).json({ error: 'Job not found' });
    }

    if (message) jobs[jobIndex].request.message = message;
    if (phoneNumbers) jobs[jobIndex].request.phoneNumbers = phoneNumbers;
    if (scheduledAt) jobs[jobIndex].scheduledTime = new Date(scheduledAt).getTime();
    if (recurring !== undefined) jobs[jobIndex].recurring = recurring === 'none' ? null : recurring;

    saveJobs(jobs);
    res.json({ success: true, message: 'Job updated', job: jobs[jobIndex] });
});

// Contacts CRUD
app.get('/contacts', (req, res) => {
    res.json(getContacts());
});

app.post('/contacts', (req, res) => {
    const { name, phoneNumbers, type } = req.body;
    if (!name || !phoneNumbers || !Array.isArray(phoneNumbers)) {
        return res.status(400).json({ error: 'Name and a valid array of phoneNumbers are required.' });
    }

    const contacts = getContacts();
    const newContact = {
        id: require('crypto').randomBytes(8).toString('hex'),
        name: name,
        phoneNumbers: phoneNumbers,
        type: type === 'group' ? 'group' : 'individual'
    };

    contacts.push(newContact);
    saveContacts(contacts);
    res.json({ success: true, message: 'Contact added successfully', contact: newContact });
});

app.put('/contacts/:id', (req, res) => {
    const { name, phoneNumbers, type } = req.body;
    let contacts = getContacts();
    const contactIndex = contacts.findIndex(c => c.id === req.params.id);

    if (contactIndex === -1) {
        return res.status(404).json({ error: 'Contact not found' });
    }

    if (name) contacts[contactIndex].name = name;
    if (phoneNumbers && Array.isArray(phoneNumbers)) contacts[contactIndex].phoneNumbers = phoneNumbers;
    if (type) contacts[contactIndex].type = type === 'group' ? 'group' : 'individual';

    saveContacts(contacts);
    res.json({ success: true, message: 'Contact updated successfully', contact: contacts[contactIndex] });
});

app.delete('/contacts/:id', (req, res) => {
    let contacts = getContacts();
    const initialLength = contacts.length;
    contacts = contacts.filter(c => c.id !== req.params.id);

    if (contacts.length !== initialLength) {
        saveContacts(contacts);
        res.json({ success: true, message: 'Contact deleted successfully' });
    } else {
        res.status(404).json({ error: 'Contact not found' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
