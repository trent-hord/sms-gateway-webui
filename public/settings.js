const form = document.getElementById('settingsForm');
const gatewayUrlInput = document.getElementById('gatewayUrl');
const gatewaySource = document.getElementById('gatewaySource');
const saveBtn = document.getElementById('saveBtn');

async function loadSettings() {
    try {
        const response = await fetch('/settings');
        const settings = await response.json();

        if (!response.ok) {
            throw new Error(settings.error || 'Failed to load settings.');
        }

        gatewayUrlInput.value = settings.gatewayUrl || '';
        gatewaySource.textContent = getSourceLabel(settings);
    } catch (error) {
        showStatus(`Error: ${error.message}`, 'error');
    }
}

function getSourceLabel(settings) {
    if (settings.source === 'saved') {
        return 'Using saved gateway URL.';
    }

    if (settings.source === 'env') {
        return 'Using GATEWAY_URL from the server environment.';
    }

    return `Using default gateway URL: ${settings.defaultGatewayUrl}`;
}

form.addEventListener('submit', async (event) => {
    event.preventDefault();

    saveBtn.disabled = true;
    saveBtn.innerText = 'Saving...';
    showStatus('', '');

    try {
        const response = await fetch('/settings', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                gatewayUrl: gatewayUrlInput.value
            })
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to save settings.');
        }

        gatewayUrlInput.value = data.settings.gatewayUrl;
        gatewaySource.textContent = getSourceLabel(data.settings);
        showStatus(data.message || 'Settings saved successfully.', 'success');
    } catch (error) {
        showStatus(`Error: ${error.message}`, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = 'Save Settings';
    }
});

function showStatus(message, type) {
    const statusMessage = document.getElementById('statusMessage');

    if (!message) {
        statusMessage.style.display = 'none';
        statusMessage.className = '';
        return;
    }

    statusMessage.innerText = message;
    statusMessage.className = type;
    statusMessage.style.display = 'block';
}

loadSettings();
