// Dashboard JavaScript

let refreshInterval;
let currentLogsDevice = null;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    updateStats();
    loadLogs();
    setupEventListeners();
    startAutoRefresh();
});

// Setup event listeners
function setupEventListeners() {
    document.getElementById('refreshBtn').addEventListener('click', refreshDashboard);
    document.getElementById('deviceSearch').addEventListener('input', filterDevices);
    document.getElementById('logSearch').addEventListener('input', filterLogs);
    document.getElementById('logDeviceFilter').addEventListener('change', loadLogs);
    document.getElementById('commandAction').addEventListener('change', toggleOtaUrl);
    document.getElementById('commandForm').addEventListener('submit', handleCommandSubmit);
    
    const otaForm = document.getElementById('otaForm');
    if (otaForm) {
        otaForm.addEventListener('submit', handleOtaSubmit);
    }
}

// Update statistics
async function updateStats() {
    try {
        const response = await fetch('/api/devices');
        const devices = await response.json();
        
        const total = devices.length;
        const online = devices.filter(d => d.onlineStatus).length;
        const offline = total - online;
        const queued = devices.reduce((sum, d) => sum + (d.commandQueue?.length || 0), 0);
        
        document.getElementById('totalDevices').textContent = total;
        document.getElementById('onlineDevices').textContent = online;
        document.getElementById('offlineDevices').textContent = offline;
        document.getElementById('queuedCommands').textContent = queued;
        
        updateLastUpdateTime();
        updateDeviceList(devices);
        updateDeviceFilter(devices);
    } catch (error) {
        console.error('Error updating stats:', error);
    }
}

// Update device list
function updateDeviceList(devices) {
    const container = document.getElementById('devicesList');
    const searchTerm = document.getElementById('deviceSearch').value.toLowerCase();
    
    if (devices.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No devices found</p></div>';
        return;
    }
    
    const filtered = devices.filter(d => 
        d.deviceId.toLowerCase().includes(searchTerm)
    );
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No devices match your search</p></div>';
        return;
    }
    
    container.innerHTML = filtered.map(device => `
        <div class="device-card" data-device-id="${device.deviceId}">
            <div class="device-header">
                <div class="device-info">
                    <h3>${device.deviceId}</h3>
                    <span class="device-status ${device.onlineStatus ? 'online' : 'offline'}">
                        ${device.onlineStatus ? '🟢 Online' : '🔴 Offline'}
                    </span>
                </div>
                <button class="btn-icon" onclick="toggleDeviceDetails('${device.deviceId}')">▼</button>
            </div>
            <div class="device-details" id="details-${device.deviceId}" style="display: none;">
                <div class="detail-row">
                    <span class="detail-label">Last Seen:</span>
                    <span class="detail-value">${formatDate(device.lastSeen)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Queue Length:</span>
                    <span class="detail-value">${device.commandQueue?.length || 0}</span>
                </div>
                ${device.health?.ip ? `
                <div class="detail-row">
                    <span class="detail-label">IP Address:</span>
                    <span class="detail-value">${device.health.ip}</span>
                </div>
                ` : ''}
                ${device.health?.rssi ? `
                <div class="detail-row">
                    <span class="detail-label">WiFi RSSI:</span>
                    <span class="detail-value">${device.health.rssi} dBm</span>
                </div>
                ` : ''}
                ${device.health?.heap ? `
                <div class="detail-row">
                    <span class="detail-label">Free Heap:</span>
                    <span class="detail-value">${device.health.heap} bytes</span>
                </div>
                ` : ''}
                <div class="device-actions">
                    <button class="btn btn-sm btn-primary" onclick="sendCommand('${device.deviceId}', 'relay_on')">Relay ON</button>
                    <button class="btn btn-sm btn-primary" onclick="sendCommand('${device.deviceId}', 'relay_off')">Relay OFF</button>
                    <button class="btn btn-sm btn-secondary" onclick="sendCommand('${device.deviceId}', 'led_toggle')">Toggle LED</button>
                    <button class="btn btn-sm btn-warning" onclick="openOtaModal('${device.deviceId}')">🔄 OTA Update</button>
                    <button class="btn btn-sm btn-info" onclick="viewLogs('${device.deviceId}')">View Logs</button>
                </div>
            </div>
        </div>
    `).join('');
}

// Update device filter dropdown
function updateDeviceFilter(devices) {
    const select = document.getElementById('logDeviceFilter');
    const currentValue = select.value;
    
    select.innerHTML = '<option value="">All Devices</option>' + 
        devices.map(d => `<option value="${d.deviceId}">${d.deviceId}</option>`).join('');
    
    if (currentValue) {
        select.value = currentValue;
    }
}

// Filter devices
function filterDevices() {
    updateStats();
}

// Toggle device details
function toggleDeviceDetails(deviceId) {
    const details = document.getElementById(`details-${deviceId}`);
    const button = event.target;
    
    if (details.style.display === 'none') {
        details.style.display = 'block';
        button.textContent = '▲';
    } else {
        details.style.display = 'none';
        button.textContent = '▼';
    }
}

// Send command
function sendCommand(deviceId, action, url = null) {
    if (action === 'ota_update' && !url) {
        openCommandModal(deviceId, action);
        return;
    }
    
    const payload = url ? { url } : {};
    
    fetch('/api/command', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            deviceId,
            action,
            url
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            alert(`Command "${action}" sent to ${deviceId}`);
            refreshDashboard();
        } else {
            alert(`Error: ${data.error || 'Failed to send command'}`);
        }
    })
    .catch(error => {
        console.error('Error sending command:', error);
        alert('Failed to send command');
    });
}

// Open command modal
function openCommandModal(deviceId, action = 'relay_on') {
    const modal = document.getElementById('commandModal');
    document.getElementById('commandDeviceId').value = deviceId;
    document.getElementById('commandAction').value = action;
    modal.classList.add('show');
}

// Close modal
function closeModal() {
    document.getElementById('commandModal').classList.remove('show');
    document.getElementById('commandForm').reset();
}

// Toggle OTA URL field
function toggleOtaUrl() {
    const action = document.getElementById('commandAction').value;
    const otaGroup = document.getElementById('otaUrlGroup');
    otaGroup.style.display = action === 'ota_update' ? 'block' : 'none';
}

// Handle command form submit
function handleCommandSubmit(e) {
    e.preventDefault();
    
    const deviceId = document.getElementById('commandDeviceId').value;
    const action = document.getElementById('commandAction').value;
    const url = document.getElementById('otaUrl').value;
    
    closeModal();
    sendCommand(deviceId, action, url || null);
}

// View logs
async function viewLogs(deviceId) {
    currentLogsDevice = deviceId;
    const modal = document.getElementById('logsModal');
    document.getElementById('logsDeviceId').textContent = deviceId;
    modal.classList.add('show');
    
    const viewer = document.getElementById('logsViewer');
    viewer.innerHTML = '<div class="loading">Loading logs...</div>';
    
    try {
        const response = await fetch(`/api/device/${deviceId}`);
        const data = await response.json();
        
        if (data.logs && data.logs.length > 0) {
            viewer.innerHTML = data.logs.map(log => `
                <div class="log-entry">
                    <div class="log-header">
                        <span class="log-time">${formatDate(new Date(log.ts))}</span>
                    </div>
                    <div class="log-message">${escapeHtml(log.log)}</div>
                </div>
            `).join('');
        } else {
            viewer.innerHTML = '<div class="empty-state"><p>No logs found</p></div>';
        }
    } catch (error) {
        console.error('Error loading logs:', error);
        viewer.innerHTML = '<div class="empty-state"><p>Error loading logs</p></div>';
    }
}

// Close logs modal
function closeLogsModal() {
    document.getElementById('logsModal').classList.remove('show');
    currentLogsDevice = null;
}

// Open OTA modal
function openOtaModal(deviceId) {
    const modal = document.getElementById('otaModal');
    document.getElementById('otaDeviceId').value = deviceId;
    document.getElementById('otaFirmwareUrl').value = '';
    document.getElementById('otaConfirm').checked = false;
    document.getElementById('otaStatus').style.display = 'none';
    modal.classList.add('show');
}

// Close OTA modal
function closeOtaModal() {
    document.getElementById('otaModal').classList.remove('show');
    document.getElementById('otaForm').reset();
    document.getElementById('otaStatus').style.display = 'none';
}

// Handle OTA form submit
function handleOtaSubmit(e) {
    e.preventDefault();
    
    const deviceId = document.getElementById('otaDeviceId').value;
    const firmwareUrl = document.getElementById('otaFirmwareUrl').value;
    const statusDiv = document.getElementById('otaStatus');
    
    if (!firmwareUrl) {
        statusDiv.innerHTML = '<div class="alert alert-error">Please enter a firmware URL</div>';
        statusDiv.style.display = 'block';
        return;
    }
    
    // Validate URL
    try {
        new URL(firmwareUrl);
    } catch (error) {
        statusDiv.innerHTML = '<div class="alert alert-error">Invalid URL format</div>';
        statusDiv.style.display = 'block';
        return;
    }
    
    statusDiv.innerHTML = '<div class="alert alert-info">Sending OTA update command...</div>';
    statusDiv.style.display = 'block';
    
    fetch('/api/command', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            deviceId,
            action: 'ota_update',
            url: firmwareUrl
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            statusDiv.innerHTML = `
                <div class="alert alert-success">
                    <strong>✅ OTA Update Initiated!</strong><br>
                    Command queued successfully. The device will download and install the firmware from:<br>
                    <code>${firmwareUrl}</code><br><br>
                    <small>The device will reboot after a successful update. Check the logs to monitor progress.</small>
                </div>
            `;
            
            // Close modal after 3 seconds
            setTimeout(() => {
                closeOtaModal();
                refreshDashboard();
            }, 3000);
        } else {
            statusDiv.innerHTML = `<div class="alert alert-error">Error: ${data.error || 'Failed to initiate OTA update'}</div>`;
        }
    })
    .catch(error => {
        console.error('Error initiating OTA update:', error);
        statusDiv.innerHTML = '<div class="alert alert-error">Failed to initiate OTA update. Please try again.</div>';
    });
}

// Load logs
async function loadLogs() {
    const container = document.getElementById('logsContainer');
    const deviceFilter = document.getElementById('logDeviceFilter').value;
    const searchTerm = document.getElementById('logSearch').value;
    
    container.innerHTML = '<div class="loading">Loading logs...</div>';
    
    try {
        let url = '/logs?limit=50';
        if (deviceFilter) url += `&deviceId=${encodeURIComponent(deviceFilter)}`;
        if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.logs && data.logs.length > 0) {
            container.innerHTML = data.logs.map(log => {
                const logClass = log.log.toLowerCase().includes('error') ? 'error' : 
                                log.log.toLowerCase().includes('warn') ? 'warning' : '';
                return `
                    <div class="log-entry ${logClass}">
                        <div class="log-header">
                            <span class="log-device">${log.deviceId}</span>
                            <span class="log-time">${formatDate(new Date(log.ts))}</span>
                        </div>
                        <div class="log-message">${escapeHtml(log.log)}</div>
                    </div>
                `;
            }).join('');
        } else {
            container.innerHTML = '<div class="empty-state"><p>No logs found</p></div>';
        }
    } catch (error) {
        console.error('Error loading logs:', error);
        container.innerHTML = '<div class="empty-state"><p>Error loading logs</p></div>';
    }
}

// Filter logs
function filterLogs() {
    loadLogs();
}

// Refresh dashboard
function refreshDashboard() {
    updateStats();
    loadLogs();
}

// Start auto refresh
function startAutoRefresh() {
    refreshInterval = setInterval(() => {
        refreshDashboard();
    }, 10000); // Refresh every 10 seconds
}

// Update last update time
function updateLastUpdateTime() {
    const now = new Date();
    document.getElementById('lastUpdate').textContent = 
        `Last update: ${now.toLocaleTimeString()}`;
}

// Format date
function formatDate(date) {
    if (!date) return 'Never';
    const d = new Date(date);
    return d.toLocaleString();
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Close modals on outside click
window.onclick = function(event) {
    const commandModal = document.getElementById('commandModal');
    const logsModal = document.getElementById('logsModal');
    const otaModal = document.getElementById('otaModal');
    
    if (event.target === commandModal) {
        closeModal();
    }
    if (event.target === logsModal) {
        closeLogsModal();
    }
    if (event.target === otaModal) {
        closeOtaModal();
    }
}
