document.addEventListener('DOMContentLoaded', loadWebhooks);

function showStatus(message, type) {
    const statusMessage = document.getElementById('statusMessage');
    statusMessage.innerText = message;
    statusMessage.className = type;
    statusMessage.style.display = 'block';
    setTimeout(() => {
        statusMessage.style.display = 'none';
    }, 5000);
}

function toggleCustomEventInput(selectElement, targetGroupId) {
    const group = document.getElementById(targetGroupId);
    if (selectElement.value === 'custom') {
        group.style.display = 'block';
        group.querySelector('input').setAttribute('required', 'true');
    } else {
        group.style.display = 'none';
        group.querySelector('input').removeAttribute('required');
    }
}

async function loadWebhooks() {
    const loading = document.getElementById('loading');
    const container = document.getElementById('webhooksContainer');
    loading.style.display = 'block';
    container.innerHTML = '';

    try {
        const res = await fetch('/webhooks');
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Failed to load webhooks');
        }
        const webhooks = await res.json();

        loading.style.display = 'none';

        if (!Array.isArray(webhooks) || webhooks.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #777;">No webhooks registered.</p>';
            return;
        }

        // Sort by URL
        webhooks.sort((a, b) => a.url.localeCompare(b.url));

        webhooks.forEach(webhook => {
            container.appendChild(createWebhookCard(webhook));
        });
    } catch (err) {
        loading.style.display = 'none';
        showStatus(err.message, 'error');
    }
}

function getBadgeClass(event) {
    if (event === 'sms:received') return 'badge-sms-received';
    if (event === 'mms:received') return 'badge-mms-received';
    if (event === 'mms:downloaded') return 'badge-mms-downloaded';
    return 'badge-custom';
}

function createWebhookCard(webhook) {
    const div = document.createElement('div');
    div.className = 'webhook-card';
    div.id = `webhook-${webhook.id}`;

    const isStandardEvent = ['sms:received', 'mms:received', 'mms:downloaded'].includes(webhook.event);
    const badgeClass = getBadgeClass(webhook.event);

    div.innerHTML = `
        <!-- View Container -->
        <div class="card-view-container">
            <div class="webhook-header">
                <span class="badge ${badgeClass}">${webhook.event}</span>
                <span class="webhook-id">ID: ${webhook.id}</span>
            </div>
            <div class="webhook-url-container">
                <span class="webhook-url">${escapeHtml(webhook.url)}</span>
            </div>
            <div class="actions-group">
                <button class="btn btn-secondary btn-edit" onclick="toggleEdit('${webhook.id}', true)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                    Edit
                </button>
                <button class="btn btn-danger btn-delete" onclick="deleteWebhook('${webhook.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    Delete
                </button>
            </div>
        </div>

        <!-- Edit Form Container -->
        <div class="edit-form-container">
            <h3 style="font-size: 16px; margin-bottom: 12px;">Edit Webhook Settings</h3>
            <div class="form-group">
                <label>Target URL</label>
                <input type="url" id="edit-url-${webhook.id}" value="${escapeHtml(webhook.url)}" required>
            </div>
            <div class="form-group">
                <label>Event Type</label>
                <select id="edit-select-${webhook.id}" onchange="toggleCustomEventInput(this, 'edit-custom-group-${webhook.id}')" required>
                    <option value="sms:received" ${webhook.event === 'sms:received' ? 'selected' : ''}>SMS Received (sms:received)</option>
                    <option value="mms:received" ${webhook.event === 'mms:received' ? 'selected' : ''}>MMS Received (mms:received)</option>
                    <option value="mms:downloaded" ${webhook.event === 'mms:downloaded' ? 'selected' : ''}>MMS Downloaded (mms:downloaded)</option>
                    <option value="custom" ${!isStandardEvent ? 'selected' : ''}>Custom Event Type...</option>
                </select>
            </div>
            <div class="form-group" id="edit-custom-group-${webhook.id}" style="display: ${isStandardEvent ? 'none' : 'block'};">
                <label>Custom Event Name</label>
                <input type="text" id="edit-custom-val-${webhook.id}" value="${!isStandardEvent ? escapeHtml(webhook.event) : ''}" ${!isStandardEvent ? 'required' : ''}>
            </div>
            <div class="actions-group">
                <button class="btn btn-secondary" onclick="toggleEdit('${webhook.id}', false)">Cancel</button>
                <button class="btn btn-success" onclick="updateWebhook('${webhook.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    Save Changes
                </button>
            </div>
        </div>
    `;

    return div;
}

function toggleEdit(id, showEdit) {
    const card = document.getElementById(`webhook-${id}`);
    if (showEdit) {
        card.classList.add('card-editing');
    } else {
        card.classList.remove('card-editing');
    }
}

async function registerWebhook(event) {
    event.preventDefault();

    const urlInput = document.getElementById('webhookUrl');
    const selectEvent = document.getElementById('webhookEvent');
    const customEventInput = document.getElementById('customEventName');

    let eventType = selectEvent.value;
    if (eventType === 'custom') {
        eventType = customEventInput.value.trim();
    }

    if (!urlInput.value.trim() || !eventType) {
        showStatus('URL and event type are required.', 'error');
        return;
    }

    try {
        const res = await fetch('/webhooks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: urlInput.value.trim(),
                event: eventType
            })
        });

        const data = await res.json();
        if (res.ok) {
            showStatus('Webhook registered successfully.', 'success');
            urlInput.value = '';
            customEventInput.value = '';
            selectEvent.value = 'sms:received';
            document.getElementById('customEventGroup').style.display = 'none';
            loadWebhooks();
        } else {
            showStatus(`Error: ${data.error || 'Failed to register'}`, 'error');
        }
    } catch (err) {
        showStatus(`An error occurred: ${err.message}`, 'error');
    }
}

async function updateWebhook(id) {
    const urlVal = document.getElementById(`edit-url-${id}`).value.trim();
    const selectVal = document.getElementById(`edit-select-${id}`).value;
    let eventType = selectVal;
    if (selectVal === 'custom') {
        eventType = document.getElementById(`edit-custom-val-${id}`).value.trim();
    }

    if (!urlVal || !eventType) {
        showStatus('URL and Event Type cannot be empty.', 'error');
        return;
    }

    try {
        const res = await fetch(`/webhooks/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: urlVal,
                event: eventType
            })
        });

        const data = await res.json();
        if (res.ok) {
            showStatus('Webhook updated successfully.', 'success');
            loadWebhooks();
        } else {
            showStatus(`Error: ${data.error || 'Failed to update'}`, 'error');
        }
    } catch (err) {
        showStatus(`An error occurred: ${err.message}`, 'error');
    }
}

async function deleteWebhook(id) {
    if (!confirm('Are you sure you want to delete this webhook subscription?')) return;

    try {
        const res = await fetch(`/webhooks/${id}`, {
            method: 'DELETE'
        });

        const data = await res.json();
        if (res.ok) {
            showStatus('Webhook deleted successfully.', 'success');
            loadWebhooks();
        } else {
            showStatus(`Error: ${data.error || 'Failed to delete'}`, 'error');
        }
    } catch (err) {
        showStatus(`An error occurred: ${err.message}`, 'error');
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
