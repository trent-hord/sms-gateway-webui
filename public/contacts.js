document.addEventListener('DOMContentLoaded', loadContacts);

function showStatus(message, type) {
    const statusMessage = document.getElementById('statusMessage');
    statusMessage.innerText = message;
    statusMessage.className = type;
    statusMessage.style.display = 'block';
    setTimeout(() => {
        statusMessage.style.display = 'none';
    }, 5000);
}

async function loadContacts() {
    const loading = document.getElementById('loading');
    const container = document.getElementById('contactsContainer');
    loading.style.display = 'block';
    container.innerHTML = '';

    try {
        const res = await fetch('/contacts');
        if (!res.ok) throw new Error('Failed to load contacts');
        const contacts = await res.json();

        loading.style.display = 'none';

        if (contacts.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #777;">No contacts found.</p>';
            return;
        }

        contacts.sort((a, b) => a.name.localeCompare(b.name));

        contacts.forEach(contact => {
            container.appendChild(createContactCard(contact));
        });
    } catch (err) {
        loading.style.display = 'none';
        showStatus(err.message, 'error');
    }
}

function createContactCard(contact) {
    const div = document.createElement('div');
    div.className = 'contact-card';
    div.id = `contact-${contact.id}`;

    const phones = contact.phoneNumbers.join(', ');
    const badgeClass = contact.type === 'group' ? 'badge-group' : 'badge-individual';
    const badgeText = contact.type === 'group' ? 'Group' : 'Individual';

    div.innerHTML = `
        <span class="badge ${badgeClass}">${badgeText}</span>
        <div class="form-group">
            <label>Name:</label>
            <input type="text" id="name-${contact.id}" value="${contact.name}">
        </div>
        <div class="form-group">
            <label>Type:</label>
            <select id="type-${contact.id}">
                <option value="individual" ${contact.type === 'individual' ? 'selected' : ''}>Individual</option>
                <option value="group" ${contact.type === 'group' ? 'selected' : ''}>Group</option>
            </select>
        </div>
        <div class="form-group">
            <label>Phone Numbers (comma-separated):</label>
            <textarea id="phones-${contact.id}" rows="2">${phones}</textarea>
        </div>
        <div class="btn-group">
            <button class="btn-save" onclick="updateContact('${contact.id}')">Save Changes</button>
            <button class="btn-delete" onclick="deleteContact('${contact.id}')">Delete</button>
        </div>
    `;

    return div;
}

async function addContact() {
    const nameInput = document.getElementById('newName').value;
    const typeInput = document.getElementById('newType').value;
    const phonesInput = document.getElementById('newPhones').value;

    const formattedPhones = phonesInput.split(/[\n,]+/).map(number => number.trim()).filter(number => number !== '');

    if (!nameInput.trim() || formattedPhones.length === 0) {
        showStatus('Please enter a name and at least one phone number.', 'error');
        return;
    }

    try {
        const res = await fetch('/contacts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: nameInput,
                type: typeInput,
                phoneNumbers: formattedPhones
            })
        });

        const data = await res.json();
        if (res.ok) {
            showStatus('Contact added successfully.', 'success');
            document.getElementById('newName').value = '';
            document.getElementById('newPhones').value = '';
            loadContacts();
        } else {
            showStatus(`Error: ${data.error}`, 'error');
        }
    } catch (err) {
        showStatus(`An error occurred: ${err.message}`, 'error');
    }
}


async function updateContact(id) {
    const nameInput = document.getElementById(`name-${id}`).value;
    const typeInput = document.getElementById(`type-${id}`).value;
    const phonesInput = document.getElementById(`phones-${id}`).value;

    const formattedPhones = phonesInput.split(/[\n,]+/).map(number => number.trim()).filter(number => number !== '');

    if (!nameInput.trim() || formattedPhones.length === 0) {
        showStatus('Please enter a valid name and phone numbers.', 'error');
        return;
    }

    try {
        const res = await fetch(`/contacts/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: nameInput,
                type: typeInput,
                phoneNumbers: formattedPhones
            })
        });

        const data = await res.json();
        if (res.ok) {
            showStatus('Contact updated successfully.', 'success');
            loadContacts(); // reload to reflect type badge changes if any
        } else {
            showStatus(`Error: ${data.error}`, 'error');
        }
    } catch (err) {
        showStatus(`An error occurred: ${err.message}`, 'error');
    }
}

async function deleteContact(id) {
    if (!confirm('Are you sure you want to delete this contact/group?')) return;

    try {
        const res = await fetch(`/contacts/${id}`, { method: 'DELETE' });
        const data = await res.json();

        if (res.ok) {
            showStatus('Contact deleted successfully.', 'success');
            loadContacts();
        } else {
            showStatus(`Error: ${data.error}`, 'error');
        }
    } catch (err) {
        showStatus(`An error occurred: ${err.message}`, 'error');
    }
}
