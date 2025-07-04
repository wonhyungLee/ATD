// Global variables
let authToken = null;
let currentAccounts = {};

// Check authentication on load
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    checkServerStatus();
    loadApiKeys();
    refreshSummary();
    updateWebhookUrl();
    
    // Set up form handlers
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('apiKeyForm').addEventListener('submit', handleApiKeySubmit);
    document.getElementById('manualOrderForm').addEventListener('submit', handleManualOrder);
    
    // Refresh data every 30 seconds
    setInterval(() => {
        checkServerStatus();
        if (document.getElementById('dashboard').classList.contains('active')) {
            refreshSummary();
        }
    }, 30000);
});

// Authentication
function checkAuth() {
    const auth = localStorage.getItem('auth');
    if (auth) {
        authToken = auth;
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    const auth = btoa(`${username}:${password}`);
    authToken = `Basic ${auth}`;
    localStorage.setItem('auth', authToken);
    
    document.getElementById('loginModal').classList.remove('show');
    loadApiKeys();
    refreshSummary();
}

// Server status check
async function checkServerStatus() {
    try {
        const response = await fetch('/health');
        const data = await response.json();
        
        const statusEl = document.getElementById('status');
        if (data.status === 'running') {
            statusEl.classList.add('online');
            statusEl.classList.remove('offline');
            statusEl.querySelector('.status-text').textContent = 'Online';
        }
    } catch (error) {
        const statusEl = document.getElementById('status');
        statusEl.classList.add('offline');
        statusEl.classList.remove('online');
        statusEl.querySelector('.status-text').textContent = 'Offline';
    }
}

// Tab switching
function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');
    
    // Load data for the tab
    if (tabName === 'dashboard') {
        refreshSummary();
    } else if (tabName === 'apikeys') {
        loadApiKeys();
    }
}

// Dashboard functions
async function refreshSummary() {
    try {
        const response = await fetch('/api/summary', {
            headers: authToken ? { 'Authorization': authToken } : {}
        });
        
        if (response.status === 401) {
            document.getElementById('loginModal').classList.add('show');
            return;
        }
        
        const data = await response.json();
        
        if (data.success) {
            displayAccountsSummary(data.summary);
        }
    } catch (error) {
        console.error('Failed to load summary:', error);
    }
}

function displayAccountsSummary(summary) {
    const container = document.getElementById('accounts-summary');
    container.innerHTML = '';
    
    if (Object.keys(summary).length === 0) {
        container.innerHTML = '<div class="loading">No accounts configured</div>';
        return;
    }
    
    for (const [account, data] of Object.entries(summary)) {
        if (data.error) {
            container.innerHTML += createErrorCard(account, data.error);
        } else {
            container.innerHTML += createAccountCard(account, data);
        }
    }
}

function createAccountCard(account, data) {
    const balance = data.balance;
    const profitClass = parseFloat(balance.profitLoss) >= 0 ? 'positive' : 'negative';
    
    return `
        <div class="account-card">
            <h3>${account}</h3>
            <div class="account-info">
                <div class="info-row">
                    <span class="info-label">Total Asset:</span>
                    <span class="info-value">${formatNumber(balance.totalAsset)}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Deposit:</span>
                    <span class="info-value">${formatNumber(balance.deposit)}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Total Buy:</span>
                    <span class="info-value">${formatNumber(balance.totalBuy)}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Total Eval:</span>
                    <span class="info-value">${formatNumber(balance.totalEval)}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">P&L:</span>
                    <span class="info-value ${profitClass}">${formatNumber(balance.profitLoss)}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">P&L Rate:</span>
                    <span class="info-value ${profitClass}">${balance.profitRate}%</span>
                </div>
            </div>
        </div>
    `;
}

function createErrorCard(account, error) {
    return `
        <div class="account-card">
            <h3>${account}</h3>
            <div class="account-info">
                <div style="color: #e74c3c;">Error: ${error}</div>
            </div>
        </div>
    `;
}

// API Key Management
async function loadApiKeys() {
    try {
        const response = await fetch('/api/keys', {
            headers: authToken ? { 'Authorization': authToken } : {}
        });
        
        if (response.status === 401) {
            document.getElementById('loginModal').classList.add('show');
            return;
        }
        
        const data = await response.json();
        
        if (data.success) {
            displayApiKeys(data.keys);
            updateAccountSelects(data.keys);
            currentAccounts = data.keys;
        }
    } catch (error) {
        console.error('Failed to load API keys:', error);
    }
}

function displayApiKeys(keys) {
    const container = document.getElementById('apiKeysList');
    container.innerHTML = '';
    
    if (Object.keys(keys).length === 0) {
        container.innerHTML = '<div class="loading">No API keys configured</div>';
        return;
    }
    
    for (const [account, data] of Object.entries(keys)) {
        container.innerHTML += `
            <div class="key-item">
                <div class="key-info">
                    <strong>${account}</strong>
                    <br>
                    <small>Account: ${data.accountNumber} | Mode: ${data.isMock ? 'Mock' : 'Real'}</small>
                    <br>
                    <small>Created: ${new Date(data.createdAt).toLocaleString()}</small>
                </div>
                <div class="key-actions">
                    <button class="btn btn-small btn-danger" onclick="deleteApiKey('${account}')">Delete</button>
                </div>
            </div>
        `;
    }
}

function updateAccountSelects(keys) {
    const select = document.getElementById('orderAccount');
    select.innerHTML = '<option value="">Select Account</option>';
    
    for (const account of Object.keys(keys)) {
        select.innerHTML += `<option value="${account}">${account}</option>`;
    }
}

async function handleApiKeySubmit(e) {
    e.preventDefault();
    
    const formData = {
        account: document.getElementById('account').value,
        appKey: document.getElementById('appKey').value,
        appSecret: document.getElementById('appSecret').value,
        accountNumber: document.getElementById('accountNumber').value,
        isMock: document.getElementById('isMock').checked
    };
    
    try {
        const response = await fetch('/api/keys', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authToken
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('API key saved successfully');
            document.getElementById('apiKeyForm').reset();
            loadApiKeys();
        } else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        alert('Failed to save API key: ' + error.message);
    }
}

async function deleteApiKey(account) {
    if (!confirm(`Delete API key for account: ${account}?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/keys/${account}`, {
            method: 'DELETE',
            headers: {
                'Authorization': authToken
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            loadApiKeys();
        } else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        alert('Failed to delete API key: ' + error.message);
    }
}

// Webhook functions
function updateWebhookUrl() {
    const url = `http://${window.location.hostname}/order`;
    document.getElementById('webhookUrl').textContent = url;
}

function copyWebhookUrl() {
    const url = document.getElementById('webhookUrl').textContent;
    navigator.clipboard.writeText(url).then(() => {
        alert('Webhook URL copied to clipboard!');
    });
}

async function testWebhook() {
    const testData = {
        symbol: "005930",
        action: "buy",
        contracts: "1",
        price: "70000",
        time: new Date().toISOString(),
        exchange: "KRX",
        account: "default"
    };
    
    try {
        const response = await fetch('/test', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testData)
        });
        
        const data = await response.json();
        alert('Test webhook sent successfully! Check Discord for notification.');
    } catch (error) {
        alert('Failed to send test webhook: ' + error.message);
    }
}

// Manual order
async function handleManualOrder(e) {
    e.preventDefault();
    
    const orderData = {
        account: document.getElementById('orderAccount').value,
        symbol: document.getElementById('orderSymbol').value,
        action: document.getElementById('orderAction').value,
        contracts: document.getElementById('orderQuantity').value
    };
    
    try {
        const response = await fetch('/api/order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authToken
            },
            body: JSON.stringify(orderData)
        });
        
        const data = await response.json();
        const resultDiv = document.getElementById('orderResult');
        
        if (data.success) {
            resultDiv.className = 'order-result success';
            resultDiv.innerHTML = `Order placed successfully!<br>Order ID: ${data.result.orderId}`;
        } else {
            resultDiv.className = 'order-result error';
            resultDiv.innerHTML = `Order failed: ${data.error}`;
        }
    } catch (error) {
        const resultDiv = document.getElementById('orderResult');
        resultDiv.className = 'order-result error';
        resultDiv.innerHTML = `Error: ${error.message}`;
    }
}

// Utility functions
function formatNumber(num) {
    return new Intl.NumberFormat('ko-KR').format(num);
}