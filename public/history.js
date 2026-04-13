document.addEventListener('DOMContentLoaded', () => {
    const historyList = document.getElementById('historyList');
    const loading = document.getElementById('loading');
    const emptyState = document.getElementById('emptyState');
    const btnClearHistory = document.getElementById('btnClearHistory');

    async function fetchHistory() {
        try {
            const response = await fetch('/history');
            const history = await response.json();
            
            loading.style.display = 'none';
            
            if (history.length === 0) {
                emptyState.style.display = 'block';
                historyList.style.display = 'none';
                btnClearHistory.style.display = 'none';
            } else {
                emptyState.style.display = 'none';
                historyList.style.display = 'block';
                btnClearHistory.style.display = 'block';
                renderHistory(history);
            }
        } catch (error) {
            console.error('Error fetching history:', error);
            loading.innerText = 'Error loading history.';
        }
    }

    function renderHistory(history) {
        historyList.innerHTML = '';
        history.forEach(item => {
            const div = document.createElement('div');
            div.className = 'history-item';
            
            const date = new Date(item.timestamp).toLocaleString();
            const recipients = Array.isArray(item.phoneNumbers) ? item.phoneNumbers.join(', ') : item.phoneNumbers;
            
            div.innerHTML = `
                <div class="history-header">
                    <span class="timestamp">${date}</span>
                    <span class="status status-${item.status}">${item.status}</span>
                </div>
                <div class="message-content">${escapeHTML(item.message)}</div>
                <div class="recipients"><strong>To:</strong> ${recipients}</div>
                ${item.details ? `<div class="details">${escapeHTML(item.details)}</div>` : ''}
                <div class="actions">
                    <button class="btn-delete" data-id="${item.id}">Delete</button>
                </div>
            `;
            
            historyList.appendChild(div);
        });

        // Add event listeners for delete buttons
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                if (confirm('Are you sure you want to delete this history entry?')) {
                    await deleteEntry(id);
                }
            });
        });
    }

    async function deleteEntry(id) {
        try {
            const response = await fetch(`/history/${id}`, { method: 'DELETE' });
            if (response.ok) {
                fetchHistory();
            } else {
                alert('Failed to delete entry');
            }
        } catch (error) {
            console.error('Error deleting entry:', error);
            alert('Error deleting entry');
        }
    }

    btnClearHistory.addEventListener('click', async () => {
        if (confirm('Are you sure you want to clear ALL history? This cannot be undone.')) {
            try {
                const response = await fetch('/history', { method: 'DELETE' });
                if (response.ok) {
                    fetchHistory();
                } else {
                    alert('Failed to clear history');
                }
            } catch (error) {
                console.error('Error clearing history:', error);
                alert('Error clearing history');
            }
        }
    });

    function escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    fetchHistory();
});
