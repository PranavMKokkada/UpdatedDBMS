class ChatbotManager {
    constructor() {
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.chatMessages = document.getElementById('chatMessages');
        this.typingIndicator = document.getElementById('typingIndicator');
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateClock();
        this.startClockInterval();
    }

    setupEventListeners() {
        // Send message on Enter key
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Send message on button click
        this.sendButton.addEventListener('click', () => {
            this.sendMessage();
        });
    }

    async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message) return;

        // Add user message to chat
        this.addMessage(message, 'user');
        this.messageInput.value = '';

        // Show typing indicator
        this.showTypingIndicator();

        try {
            // Send message to backend
            const response = await fetch('http://localhost:5000/natural-query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: message })
            });

            if (!response.ok) throw new Error('Failed to get response from server');
            const data = await response.json();
            this.addMessage(
                data.success
                    ? "Here is the result:"
                    : (data.error || "Sorry, I couldn't process your request."),
                'bot',
                data.results && data.results.length > 0 ? data.results : null
            );
        } catch (error) {
            console.error('Error:', error);
            this.hideTypingIndicator();
            this.addMessage('Sorry, I encountered an error. Please try again.', 'bot');
        }
    }

    addMessage(text, sender, table = null) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        const messageText = document.createElement('p');
        messageText.textContent = text;

        const timeSpan = document.createElement('span');
        timeSpan.className = 'message-time';
        timeSpan.textContent = this.getCurrentTime();

        contentDiv.appendChild(messageText);
        contentDiv.appendChild(timeSpan);

        // If bot and table present, add Show Table button
        if (sender === 'bot' && table) {
            const showTableBtn = document.createElement('button');
            showTableBtn.textContent = 'Show Table';
            showTableBtn.className = 'show-table-btn';
            let expanded = false;
            let tableWrapper = null;
            showTableBtn.onclick = () => {
                if (!expanded) {
                    tableWrapper = this.createTableElement(table);
                    tableWrapper.classList.add('table-expand');
                    contentDiv.appendChild(tableWrapper);
                    setTimeout(() => tableWrapper.classList.add('expanded'), 10);
                    showTableBtn.textContent = 'Hide Table';
                } else {
                    if (tableWrapper) {
                        tableWrapper.classList.remove('expanded');
                        setTimeout(() => {
                            if (tableWrapper && tableWrapper.parentNode) tableWrapper.parentNode.removeChild(tableWrapper);
                        }, 300);
                    }
                    showTableBtn.textContent = 'Show Table';
                }
                expanded = !expanded;
            };
            contentDiv.appendChild(showTableBtn);
        }

        messageDiv.appendChild(contentDiv);

        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    createTableElement(tableData) {
        const wrapper = document.createElement('div');
        wrapper.className = 'chat-table-wrapper';
        const table = document.createElement('table');
        table.className = 'chat-table';
        // Table header
        if (tableData && tableData.length > 0) {
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            Object.keys(tableData[0]).forEach(key => {
                const th = document.createElement('th');
                th.textContent = key;
                headerRow.appendChild(th);
            });
            thead.appendChild(headerRow);
            table.appendChild(thead);
            // Table body
            const tbody = document.createElement('tbody');
            tableData.forEach(row => {
                const tr = document.createElement('tr');
                Object.values(row).forEach(val => {
                    const td = document.createElement('td');
                    td.textContent = val;
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
        } else {
            const emptyRow = document.createElement('tr');
            const emptyCell = document.createElement('td');
            emptyCell.colSpan = 100;
            emptyCell.textContent = 'No data available.';
            emptyRow.appendChild(emptyCell);
            table.appendChild(emptyRow);
        }
        wrapper.appendChild(table);
        return wrapper;
    }

    showTypingIndicator() {
        this.typingIndicator.classList.add('active');
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        this.typingIndicator.classList.remove('active');
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    getCurrentTime() {
        const now = new Date();
        return now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    updateClock() {
        const timeElement = document.getElementById('current-time');
        if (timeElement) {
            const now = new Date();
            const timeString = now.toLocaleTimeString('en-US', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            timeElement.textContent = timeString;
        }
    }

    startClockInterval() {
        setInterval(() => {
            this.updateClock();
        }, 1000);
    }
}

// Initialize the chatbot when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.chatbotManager = new ChatbotManager();
}); 