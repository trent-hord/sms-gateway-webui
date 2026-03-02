document.getElementById('smsForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const phoneNumbersInput = document.getElementById('phoneNumbers').value;
    const message = document.getElementById('message').value;
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

    try {
        const response = await fetch('/send-sms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                phoneNumbers: phoneNumbers,
                message: message
            })
        });

        const data = await response.json();

        if (response.ok) {
            showStatus(data.message || 'Announcement sent successfully!', 'success');
            // Clear the form
            document.getElementById('phoneNumbers').value = '';
            document.getElementById('message').value = '';
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
