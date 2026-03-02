require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

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

app.post('/send-sms', async (req, res) => {
    try {
        const { message, phoneNumbers } = req.body;

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

        const state = await client.send(request);

        res.json({
            success: true,
            message: 'Message sent successfully to the gateway',
            state: state
        });
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
