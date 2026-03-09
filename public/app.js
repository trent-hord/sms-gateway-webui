document.getElementById('smsForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const phoneNumbersInput = document.getElementById('phoneNumbers').value;
    const message = document.getElementById('message').value;
    const scheduledAtValue = document.getElementById('scheduledAt').value;
    const recurringValue = document.getElementById('recurring').value;
    const statusMessage = document.getElementById('statusMessage');
    const submitBtn = document.getElementById('submitBtn');

    statusMessage.style.display = 'none';
    statusMessage.className = '';

    // Parse the phone numbers (split by comma or newline)
    const phoneNumbers = phoneNumbersInput.split(/[\n,]+/).map(number => number.trim()).filter(number => number !== '');

    if (phoneNumbers.length === 0) {
        showStatus('Please enter at least one valid phone number.', 'error');
        return;
    }

    if (!message.trim()) {
        showStatus('Please enter a message.', 'error');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerText = 'Sending...';

    let scheduledAt = null;
    if (scheduledAtValue) {
        scheduledAt = new Date(scheduledAtValue).toISOString();
    }

    let recurring = recurringValue !== 'none' ? recurringValue : null;

    try {
        const response = await fetch('/send-sms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                phoneNumbers: phoneNumbers,
                message: message,
                scheduledAt: scheduledAt,
                recurring: recurring
            })
        });

        const data = await response.json();

        if (response.ok) {
            showStatus(data.message || 'Announcement sent successfully!', 'success');
            // Clear the form
            document.getElementById('phoneNumbers').value = '';
            document.getElementById('message').value = '';
            document.getElementById('scheduledAt').value = '';
            document.getElementById('recurring').value = 'none';
        } else {
            showStatus(`Error: ${data.error} - ${data.details || ''}`, 'error');
        }
    } catch (error) {
        showStatus(`An error occurred: ${error.message}`, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Send Announcement';
    }
});

function showStatus(message, type) {
    const statusMessage = document.getElementById('statusMessage');
    statusMessage.innerText = message;
    statusMessage.className = type;
    statusMessage.style.display = 'block';
}

let loadedContacts = [];

async function initContacts() {
    try {
        const response = await fetch('/contacts');
        if (response.ok) {
            loadedContacts = await response.json();

            if (loadedContacts.length > 0) {
                document.getElementById('contactSelectorGroup').style.display = 'block';
                const selector = document.getElementById('contactSelector');

                loadedContacts.sort((a, b) => a.name.localeCompare(b.name));

                loadedContacts.forEach(contact => {
                    const opt = document.createElement('option');
                    opt.value = contact.id;
                    opt.textContent = `${contact.name} (${contact.type === 'group' ? 'Group' : 'Individual'}) - ${contact.phoneNumbers.length} numbers`;
                    selector.appendChild(opt);
                });
            }
        }
    } catch (e) {
        console.error('Failed to load contacts', e);
    }
}

document.getElementById('btnAddContact').addEventListener('click', () => {
    const selector = document.getElementById('contactSelector');
    const selectedId = selector.value;
    if (!selectedId) return;

    const contact = loadedContacts.find(c => c.id === selectedId);
    if (contact) {
        const phoneField = document.getElementById('phoneNumbers');
        let currentNumbers = phoneField.value;
        const newNumbers = contact.phoneNumbers.join(', ');

        if (currentNumbers.trim().length > 0) {
            phoneField.value = currentNumbers.trim() + ', ' + newNumbers;
        } else {
            phoneField.value = newNumbers;
        }
    }
});

// Initialize on page load
initContacts();
