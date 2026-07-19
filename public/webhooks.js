document.addEventListener('DOMContentLoaded', () => {
    loadWebhooks();
    loadWebhookHistory();
    const relayUrlCode = document.getElementById('relayUrlCode');
    if (relayUrlCode) {
        relayUrlCode.innerText = window.location.origin + '/api/webhooks/incoming';
    }
});

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
                <button class="btn btn-success btn-test" id="btn-test-${webhook.id}" onclick="testWebhook('${webhook.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                    Test
                </button>
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

        <!-- Test Results Container -->
        <div class="test-results-container" id="test-results-${webhook.id}" style="display: none; margin-top: 15px; padding-top: 15px; border-top: 1px dashed var(--border-color);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <h4 style="margin: 0; font-size: 13px; font-weight: 600;">Test Connection Results</h4>
                <button class="btn btn-secondary" style="padding: 2px 8px; font-size: 11px; width: auto;" onclick="closeTestResults('${webhook.id}')">Dismiss</button>
            </div>
            <div id="test-status-badge-${webhook.id}" style="margin-bottom: 10px;"></div>
            
            <div class="form-group" style="margin-bottom: 8px;">
                <label style="font-size: 11px; margin-bottom: 2px; text-align: left;">Payload Sent</label>
                <pre id="test-payload-${webhook.id}" style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px; border-radius: 4px; font-size: 11px; font-family: monospace; overflow-x: auto; margin: 0; max-height: 150px; text-align: left;"></pre>
            </div>

            <div class="form-group" style="margin-bottom: 0;">
                <label style="font-size: 11px; margin-bottom: 2px; text-align: left;">Server Response Body</label>
                <pre id="test-response-${webhook.id}" style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px; border-radius: 4px; font-size: 11px; font-family: monospace; overflow-x: auto; margin: 0; max-height: 150px; white-space: pre-wrap; word-break: break-all; text-align: left;"></pre>
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

async function testWebhook(id) {
    const btn = document.getElementById(`btn-test-${id}`);
    const originalText = btn.innerHTML;
    
    btn.setAttribute('disabled', 'true');
    btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite;"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
        Testing...
    `;

    try {
        const res = await fetch(`/webhooks/${id}/test`, {
            method: 'POST'
        });
        
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Connection test failed');
        }

        const data = await res.json();
        
        if (currentLogSource === 'local') {
            loadWebhookHistory();
        } else {
            loadServerLogs();
        }
        
        const resultsContainer = document.getElementById(`test-results-${id}`);
        resultsContainer.style.display = 'block';

        const statusBadge = document.getElementById(`test-status-badge-${id}`);
        const payloadPre = document.getElementById(`test-payload-${id}`);
        const responsePre = document.getElementById(`test-response-${id}`);

        payloadPre.innerText = JSON.stringify(data.payload, null, 2);
        responsePre.innerText = data.responseBody || '(empty response body)';

        if (data.success) {
            statusBadge.innerHTML = `
                <span class="test-status-pill test-status-success">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    Success (HTTP ${data.status} ${data.statusText || 'OK'})
                </span>
            `;
        } else {
            statusBadge.innerHTML = `
                <span class="test-status-pill test-status-failure">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    Failed (HTTP ${data.status} ${data.statusText || 'Error'})
                </span>
            `;
        }
    } catch (err) {
        showStatus(err.message, 'error');
    } finally {
        btn.removeAttribute('disabled');
        btn.innerHTML = originalText;
    }
}

function closeTestResults(id) {
    const resultsContainer = document.getElementById(`test-results-${id}`);
    if (resultsContainer) {
        resultsContainer.style.display = 'none';
    }
}

async function loadWebhookHistory() {
    const loading = document.getElementById('historyLoading');
    const container = document.getElementById('webhookHistoryContainer');
    if (!loading || !container) return;
    
    loading.style.display = 'block';
    container.innerHTML = '';

    try {
        const res = await fetch('/api/webhooks/history');
        if (!res.ok) throw new Error('Failed to load webhook history');
        const history = await res.json();

        loading.style.display = 'none';

        if (!Array.isArray(history) || history.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #777; grid-column: 1/-1;">No events logged yet.</p>';
            return;
        }

        history.forEach(item => {
            container.appendChild(createHistoryCard(item));
        });
    } catch (err) {
        loading.style.display = 'none';
        showStatus(err.message, 'error');
    }
}

function createHistoryCard(item) {
    const div = document.createElement('div');
    div.className = 'history-card';
    div.id = `history-${item.id}`;

    const dateStr = new Date(item.timestamp).toLocaleString();
    const sourceClass = item.source.startsWith('Test') ? 'badge-source-test' : 'badge-source-incoming';
    const eventBadgeClass = getBadgeClass(item.event);

    const hasResponse = item.response !== null;
    let responseSection = '';

    if (hasResponse) {
        const responseStatusClass = item.response.success ? 'test-status-success' : 'test-status-failure';
        responseSection = `
            <div style="margin-top: 10px;">
                <label style="font-size: 11px; font-weight: bold; display: block; margin-bottom: 2px;">Response Status:</label>
                <span class="test-status-pill ${responseStatusClass}" style="font-size: 11px; padding: 2px 6px;">
                    HTTP ${item.response.status} ${item.response.statusText}
                </span>
            </div>
            <div style="margin-top: 8px;">
                <label style="font-size: 11px; font-weight: bold; display: block; margin-bottom: 2px;">Response Body:</label>
                <pre style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 6px; border-radius: 4px; font-size: 11px; font-family: monospace; overflow-x: auto; margin: 0; max-height: 80px; text-align: left; white-space: pre-wrap; word-break: break-all;">${escapeHtml(item.response.responseBody)}</pre>
            </div>
        `;
    }

    div.innerHTML = `
        <div class="history-meta">
            <div>
                <span class="badge ${eventBadgeClass}">${item.event}</span>
                <span class="badge ${sourceClass}" style="margin-left: 4px;">${item.source}</span>
            </div>
            <span class="history-timestamp">${dateStr}</span>
        </div>
        <div style="text-align: left; font-size: 13px; color: var(--text-dark);">
            Event ID: <span style="font-family: monospace; font-size: 12px; color: var(--text-muted);">${item.id}</span>
        </div>
        
        <button class="history-payload-toggle" onclick="toggleHistoryPayload('${item.id}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            View Payload details
        </button>

        <div class="history-details-block" id="history-details-${item.id}">
            <div style="margin-bottom: 8px;">
                <label style="font-size: 11px; font-weight: bold; display: block; margin-bottom: 2px;">JSON Payload:</label>
                <pre style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 6px; border-radius: 4px; font-size: 11px; font-family: monospace; overflow-x: auto; margin: 0; max-height: 150px; text-align: left;">${escapeHtml(JSON.stringify(item.payload, null, 2))}</pre>
            </div>
            ${responseSection}
        </div>
    `;

    return div;
}

function toggleHistoryPayload(id) {
    const details = document.getElementById(`history-details-${id}`);
    if (details) {
        details.classList.toggle('open');
        const btn = details.previousElementSibling;
        const isOpen = details.classList.contains('open');
        btn.innerHTML = isOpen 
            ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg> Hide Payload details`
            : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg> View Payload details`;
    }
}

async function clearWebhookHistory() {
    if (!confirm('Are you sure you want to clear the entire webhook event log?')) return;

    try {
        const res = await fetch('/api/webhooks/history', {
            method: 'DELETE'
        });

        const data = await res.json();
        if (res.ok) {
            showStatus('Webhook history cleared successfully.', 'success');
            loadWebhookHistory();
        } else {
            showStatus(`Error: ${data.error || 'Failed to clear log'}`, 'error');
        }
    } catch (err) {
        showStatus(`An error occurred: ${err.message}`, 'error');
    }
}

let currentLogSource = 'local';

function switchLogSource(source) {
    if (currentLogSource === source) return;
    currentLogSource = source;

    document.getElementById('toggle-local').classList.toggle('active', source === 'local');
    document.getElementById('toggle-server').classList.toggle('active', source === 'server');

    const relayBanner = document.getElementById('localRelayConfigBanner');
    const clearBtn = document.getElementById('btnClearWebhookHistory');
    
    if (source === 'local') {
        if (relayBanner) relayBanner.style.display = 'block';
        if (clearBtn) clearBtn.style.display = 'inline-flex';
        loadWebhookHistory();
    } else {
        if (relayBanner) relayBanner.style.display = 'none';
        if (clearBtn) clearBtn.style.display = 'none';
        loadServerLogs();
    }
}

async function loadServerLogs() {
    const loading = document.getElementById('historyLoading');
    const container = document.getElementById('webhookHistoryContainer');
    if (!loading || !container) return;

    loading.style.display = 'block';
    container.innerHTML = '';

    try {
        const res = await fetch('/api/webhooks/logs-server');
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Failed to fetch gateway logs');
        }
        const logs = await res.json();

        loading.style.display = 'none';

        if (!Array.isArray(logs) || logs.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #777; grid-column: 1/-1;">No webhook-related logs found on gateway server.</p>';
            return;
        }

        logs.forEach(log => {
            container.appendChild(createServerLogCard(log));
        });
    } catch (err) {
        loading.style.display = 'none';
        container.innerHTML = `
            <div style="grid-column: 1/-1; padding: 20px; border-radius: 8px; border: 1px solid #f5c6cb; background-color: #f8d7da; color: #721c24; text-align: left; font-size: 13px;">
                <strong>Notice:</strong> ${err.message}<br>
                <span style="font-size: 12px; margin-top: 5px; display: inline-block;">Gateway server logs may be disabled (e.g. running in Cloud mode) or authentication scopes are restricted. Try using Local Relay Log instead.</span>
            </div>
        `;
    }
}

function createServerLogCard(log) {
    const div = document.createElement('div');
    div.className = 'history-card';
    div.id = `server-log-${log.id}`;

    const dateStr = log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A';
    
    let priorityClass = 'badge-priority-unknown';
    const priority = (log.priority || '').toUpperCase();
    if (priority === 'ERROR') priorityClass = 'badge-priority-error';
    else if (priority === 'WARN') priorityClass = 'badge-priority-warn';
    else if (priority === 'INFO') priorityClass = 'badge-priority-info';
    else if (priority === 'DEBUG') priorityClass = 'badge-priority-debug';

    const hasContext = log.context && Object.keys(log.context).length > 0;
    
    div.innerHTML = `
        <div class="history-meta">
            <div>
                <span class="badge ${priorityClass}">${escapeHtml(log.priority || 'log')}</span>
                <span class="badge badge-custom" style="margin-left: 4px; text-transform: none;">Module: ${escapeHtml(log.module || 'system')}</span>
            </div>
            <span class="history-timestamp">${dateStr}</span>
        </div>
        
        <div style="text-align: left; font-size: 13px; color: var(--text-dark); word-break: break-word; font-weight: 500;">
            ${escapeHtml(log.message || '')}
        </div>

        ${hasContext ? `
            <button class="history-payload-toggle" onclick="toggleServerLogContext('${log.id}')">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                View Context details
            </button>

            <div class="history-details-block" id="server-log-context-${log.id}">
                <div style="margin-bottom: 0;">
                    <pre style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px; border-radius: 4px; font-size: 11px; font-family: monospace; overflow-x: auto; margin: 0; max-height: 150px; text-align: left;">${escapeHtml(JSON.stringify(log.context, null, 2))}</pre>
                </div>
            </div>
        ` : ''}
    `;

    return div;
}

function toggleServerLogContext(id) {
    const details = document.getElementById(`server-log-context-${id}`);
    if (details) {
        details.classList.toggle('open');
        const btn = details.previousElementSibling;
        const isOpen = details.classList.contains('open');
        btn.innerHTML = isOpen 
            ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg> Hide Context details`
            : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg> View Context details`;
    }
}
