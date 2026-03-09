document.addEventListener('DOMContentLoaded', loadJobs);

function showStatus(message, type) {
    const statusMessage = document.getElementById('statusMessage');
    statusMessage.innerText = message;
    statusMessage.className = type;
    statusMessage.style.display = 'block';
    setTimeout(() => {
        statusMessage.style.display = 'none';
    }, 5000);
}

async function loadJobs() {
    const loading = document.getElementById('loading');
    const container = document.getElementById('jobsContainer');
    loading.style.display = 'block';
    container.innerHTML = '';

    try {
        const res = await fetch('/jobs');
        if (!res.ok) throw new Error('Failed to load jobs');
        const jobs = await res.json();

        loading.style.display = 'none';

        if (jobs.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #777;">No scheduled messages found.</p>';
            return;
        }

        jobs.sort((a, b) => a.scheduledTime - b.scheduledTime);

        jobs.forEach(job => {
            container.appendChild(createJobCard(job));
        });
    } catch (err) {
        loading.style.display = 'none';
        showStatus(err.message, 'error');
    }
}

function formatDateForInput(epochTime) {
    const date = new Date(epochTime);
    // YYYY-MM-DDTHH:mm format
    const pad = (n) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function createJobCard(job) {
    const div = document.createElement('div');
    div.className = 'job-card';
    div.id = `job-${job.id}`;

    const dateStr = formatDateForInput(job.scheduledTime);
    const phones = job.request.phoneNumbers.join(', ');

    div.innerHTML = `
        <h3>Job ID: ${job.id}</h3>
        <div class="form-group">
            <label>Phone Numbers (comma-separated):</label>
            <textarea id="phones-${job.id}" rows="2">${phones}</textarea>
        </div>
        <div class="form-group">
            <label>Message:</label>
            <textarea id="msg-${job.id}" rows="3">${job.request.message}</textarea>
        </div>
        <div class="form-group">
            <label>Scheduled For:</label>
            <input type="datetime-local" id="time-${job.id}" value="${dateStr}" required>
        </div>
        <div class="form-group">
            <label>Recurring Schedule:</label>
            <select id="rec-${job.id}">
                <option value="none" ${!job.recurring ? 'selected' : ''}>None (One-time)</option>
                <option value="daily" ${job.recurring === 'daily' ? 'selected' : ''}>Daily</option>
                <option value="weekly" ${job.recurring === 'weekly' ? 'selected' : ''}>Weekly</option>
                <option value="monthly" ${job.recurring === 'monthly' ? 'selected' : ''}>Monthly</option>
            </select>
        </div>
        <div class="btn-group">
            <button class="btn-save" onclick="updateJob('${job.id}')">Save Changes</button>
            <button class="btn-delete" onclick="deleteJob('${job.id}')">Delete</button>
        </div>
    `;

    return div;
}

async function updateJob(id) {
    const phonesInput = document.getElementById(`phones-${id}`).value;
    const msg = document.getElementById(`msg-${id}`).value;
    const timeVal = document.getElementById(`time-${id}`).value;
    const recVal = document.getElementById(`rec-${id}`).value;

    const formattedPhones = phonesInput.split(/[\n,]+/).map(number => number.trim()).filter(number => number !== '');

    if (formattedPhones.length === 0 || !msg.trim() || !timeVal) {
        showStatus('Please fill out all fields correctly.', 'error');
        return;
    }

    try {
        const res = await fetch(`/jobs/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phoneNumbers: formattedPhones,
                message: msg,
                scheduledAt: new Date(timeVal).toISOString(),
                recurring: recVal
            })
        });

        const data = await res.json();
        if (res.ok) {
            showStatus(data.message || 'Job updated.', 'success');
        } else {
            showStatus(`Error: ${data.error}`, 'error');
        }
    } catch (err) {
        showStatus(`An error occurred: ${err.message}`, 'error');
    }
}

async function deleteJob(id) {
    if (!confirm('Are you sure you want to delete this scheduled message?')) return;

    try {
        const res = await fetch(`/jobs/${id}`, { method: 'DELETE' });
        const data = await res.json();

        if (res.ok) {
            showStatus('Job deleted successfully.', 'success');
            const card = document.getElementById(`job-${id}`);
            if (card) card.remove();

            if (document.getElementById('jobsContainer').children.length === 0) {
                document.getElementById('jobsContainer').innerHTML = '<p style="text-align: center; color: #777;">No scheduled messages found.</p>';
            }
        } else {
            showStatus(`Error: ${data.error}`, 'error');
        }
    } catch (err) {
        showStatus(`An error occurred: ${err.message}`, 'error');
    }
}
