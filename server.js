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

// Implement a simple wrapper around node-fetch to match the HttpClient interface
// expected by android-sms-gateway
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

// Import Client from the android-sms-gateway package
// It's exported as default, but in CommonJS we need to access .default
const AndroidSmsGatewayClient = require('android-sms-gateway').default;

const JOBS_FILE = path.join(__dirname, 'jobs.json');

// Initialize jobs file if it doesn't exist
if (!fs.existsSync(JOBS_FILE)) {
    fs.writeFileSync(JOBS_FILE, JSON.stringify([]));
}

function getJobs() {
    try {
        const data = fs.readFileSync(JOBS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

function saveJobs(jobs) {
    fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2));
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
        const baseUrl = process.env.GATEWAY_URL || 'https://api.sms-gate.app/3rdparty/v1';

        if (login && password) {
            const httpClient = new NodeFetchClient();
            const client = new AndroidSmsGatewayClient(login, password, httpClient, baseUrl);

            for (const job of jobsToRun) {
                try {
                    await client.send(job.request);
                    console.log(`[Cron] Sent scheduled message to ${job.request.phoneNumbers.length} recipients`);

                    if (job.recurring) {
                        const nextTime = calculateNextOccurrence(job.scheduledTime, job.recurring);
                        const allJobs = getJobs();
                        allJobs.push({
                            scheduledTime: nextTime,
                            request: job.request,
                            recurring: job.recurring
                        });
                        saveJobs(allJobs);
                        console.log(`[Cron] Scheduled next occurrence for recurring message (recurring: ${job.recurring})`);
                    }
                } catch (err) {
                    console.error('[Cron] Error sending scheduled SMS:', err);
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
        const baseUrl = process.env.GATEWAY_URL || 'https://api.sms-gate.app/3rdparty/v1'; // Default Cloud URL

        if (!login || !password) {
            return res.status(500).json({ error: 'Gateway credentials are not configured.' });
        }

        const httpClient = new NodeFetchClient();
        const client = new AndroidSmsGatewayClient(login, password, httpClient, baseUrl);

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
            const state = await client.send(request);

            if (recurring) {
                const jobs = getJobs();
                const nextTime = calculateNextOccurrence(Date.now(), recurring);
                jobs.push({
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
        res.status(500).json({
            error: 'Failed to send SMS via gateway',
            details: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
