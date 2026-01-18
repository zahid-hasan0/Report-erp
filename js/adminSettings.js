import { db } from './firebaseConfig.js';
import { collection, getDocs, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { showToast } from './toast.js';
import { getSystemSettings, setSystemSettings } from './systemSettings.js';

let usersCache = [];
let editingUserUsername = null;
let currentSettings = null;

// --- Initialize Settings Page ---
export async function initSettings() {
    console.log("⚙️ Initializing Settings...");
    currentSettings = await getSystemSettings();

    // Tab Logic
    const tabs = document.querySelectorAll('.settings-nav-item');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            document.querySelectorAll('.settings-section').forEach(s => s.classList.add('d-none'));
            const targetId = tab.getAttribute('data-tab');
            document.getElementById(targetId).classList.remove('d-none');

            // Re-render data when switching tabs (optional but good for freshness)
            if (targetId === 'general-settings') renderGeneralSettings();
            if (targetId === 'whatsapp-settings') renderWhatsAppSettings();
            if (targetId === 'dashboard-settings') renderDashboardSettings();
            if (targetId === 'system-status') refreshSystemLogs();
        });
    });

    // Permission Check
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (currentUser.role !== 'admin') {
        const restricted = ['user-management', 'general-settings', 'whatsapp-settings', 'dashboard-settings'];
        restricted.forEach(id => {
            const container = document.getElementById(id);
            if (container) {
                container.innerHTML = `
                    <div class="alert alert-danger m-4">
                        <i class="fas fa-lock me-2"></i> Access Denied. Only Admins can access these settings.
                    </div>
                `;
            }
        });
        return;
    }

    await loadUserList();
    renderGeneralSettings();
    renderWhatsAppSettings();
    renderDashboardSettings();
}

// --- Load User List ---
// --- Load User List ---
window.loadUserList = async function () {
    const container = document.getElementById('userListContainer');
    if (!container) return;

    container.innerHTML = `
        <tr>
            <td colspan="4" class="text-center py-5 text-muted">
                <i class="fas fa-circle-notch fa-spin fa-2x mb-3 text-primary"></i>
                <div class="small">Syncing user data...</div>
            </td>
        </tr>`;

    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        usersCache = [];
        querySnapshot.forEach((doc) => {
            usersCache.push(doc.data());
        });

        renderUserList();
    } catch (error) {
        console.error("Error loading users:", error);
        container.innerHTML = `
             <tr>
                <td colspan="4" class="text-center py-4 text-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i> Failed to load users: ${error.message}
                </td>
            </tr>`;
    }
}

// --- Render Table ---
function renderUserList() {
    const container = document.getElementById('userListContainer');
    if (!container) return;
    container.innerHTML = '';

    if (usersCache.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="4" class="text-center text-muted py-5">
                    No users found in the system.
                </td>
            </tr>`;
        return;
    }

    // Sort logic (Admin first)
    usersCache.sort((a, b) => {
        if (a.role === 'admin' && b.role !== 'admin') return -1;
        if (a.role !== 'admin' && b.role === 'admin') return 1;
        return a.username.localeCompare(b.username);
    });

    usersCache.forEach(user => {
        const isAdmin = user.role === 'admin';
        const roleLabel = isAdmin ? 'Administrator' : 'User';
        const roleBadge = isAdmin
            ? '<span class="badge bg-dark text-warning border border-warning"><i class="fas fa-crown me-1"></i>Admin</span>'
            : '<span class="badge bg-light text-secondary border">User</span>';

        let modulesSummary = '<span class="text-muted small">No Access</span>';
        if (isAdmin) {
            modulesSummary = '<span class="text-success small fw-bold"><i class="fas fa-check-circle me-1"></i> Full Access</span>';
        } else if (user.allowedModules && user.allowedModules.length > 0) {
            modulesSummary = `<span class="text-primary small fw-bold"><i class="fas fa-layer-group me-1"></i> ${user.allowedModules.length} Modules</span>`;
        }

        const avatarInitial = (user.fullName || user.username).charAt(0).toUpperCase();

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="ps-4">
                <div class="d-flex align-items-center">
                    <div class="avatar-initial bg-white border shadow-sm text-primary me-3" style="width: 40px; height: 40px; font-size: 1.1rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                        ${avatarInitial}
                    </div>
                    <div>
                        <div class="fw-bold text-dark">${user.fullName || 'Unknown'}</div>
                        <div class="small text-muted">@${user.username}</div>
                    </div>
                </div>
            </td>
            <td>${roleBadge}</td>
            <td>${modulesSummary}</td>
            <td class="text-end pe-4">
                <button class="btn btn-sm btn-white border shadow-sm fw-bold px-3" onclick="openUserManagementModal('${user.username}')">
                    <i class="fas fa-cog me-1 text-secondary"></i> Manage
                </button>
            </td>
        `;
        container.appendChild(tr);
    });
}

function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '#' + "00000".substring(0, 6 - c.length) + c;
}

// ================= UNIFIED MODAL LOGIC =================

window.openUserManagementModal = function (username) {
    console.log("🟢 Opening User Management for:", username);
    const user = usersCache.find(u => u.username === username);
    if (!user) return;

    editingUserUsername = username;

    // Set Hidden Field if exists (ensure HTML matches)
    const hiddenInput = document.getElementById('manageUsernameHidden');
    if (hiddenInput) hiddenInput.value = username;

    // Update Title
    const titleEl = document.getElementById('manageModalTitle');
    if (titleEl) titleEl.innerText = `Manage: ${user.fullName || username}`;

    // 1. Populate Manage Tab
    const roleSelect = document.getElementById('manageRoleSelect');
    if (roleSelect) roleSelect.value = user.role || 'user';

    const passInput = document.getElementById('managePasswordInput');
    if (passInput) passInput.value = '';

    const defaultPageSelect = document.getElementById('manageDefaultPage');
    if (defaultPageSelect) defaultPageSelect.value = user.defaultPage || 'dashboardPage';

    // 2. Populate Privileges Tab
    const modules = user.allowedModules || [];
    document.querySelectorAll('.perm-check').forEach(check => {
        check.checked = modules.includes(check.value);
    });

    // Show Modal
    const modalEl = document.getElementById('userManagementModal');
    if (modalEl) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    } else {
        console.error("🔴 Modal 'userManagementModal' not found in DOM");
    }
}

window.saveUserManagement = async function () {
    if (!editingUserUsername) return;

    // A. Gather Data from Manage Tab
    const roleSelect = document.getElementById('manageRoleSelect');
    const passInput = document.getElementById('managePasswordInput');

    if (!roleSelect) return;

    const newRole = roleSelect.value;
    const newPassword = passInput ? passInput.value.trim() : '';

    const defaultPageSelect = document.getElementById('manageDefaultPage');

    // B. Gather Data from Privileges Tab
    const allowedModules = [];
    document.querySelectorAll('.perm-check:checked').forEach(cb => {
        allowedModules.push(cb.value);
    });

    const updateData = {
        role: newRole,
        allowedModules: allowedModules,
        defaultPage: defaultPageSelect ? defaultPageSelect.value : 'dashboardPage'
    };
    if (newPassword) updateData.password = newPassword;

    try {
        const userRef = doc(db, "users", editingUserUsername);
        await updateDoc(userRef, updateData);

        showToast('✅ User updated successfully!', 'success');

        // Close Modal
        const modalEl = document.getElementById('userManagementModal');
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        if (modalInstance) modalInstance.hide();

        await loadUserList();

    } catch (error) {
        console.error("Update Error:", error);
        showToast('❌ Update failed: ' + error.message, 'error');
    }
}

window.deleteUser = async function () {
    if (!editingUserUsername) return;

    // Simple confirm
    if (!await window.showConfirm(`Are you sure you want to permanently delete user "${editingUserUsername}"? This cannot be undone.`)) {
        return;
    }

    // Prevent deleting self
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (currentUser.username === editingUserUsername) {
        alert("You cannot delete your own admin account.");
        return;
    }

    try {
        const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        await deleteDoc(doc(db, "users", editingUserUsername));

        showToast('🗑️ User deleted.', 'success');

        const modalEl = document.getElementById('userManagementModal');
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        if (modalInstance) modalInstance.hide();

        await loadUserList();
    } catch (error) {
        console.error("Delete Error:", error);
        showToast('❌ Delete failed: ' + error.message, 'error');
    }
}

window.generateRandomPass = function () {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let pass = "";
    for (let i = 0; i < 8; i++) {
        pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const passInput = document.getElementById('managePasswordInput');
    if (passInput) passInput.value = pass;
}

// ================= SYSTEM SETTINGS LOGIC =================

async function renderGeneralSettings() {
    const { loadNotices } = await import('./notice.js');
    if (typeof loadNotices === 'function') await loadNotices();
}


function renderWhatsAppSettings() {
    if (!currentSettings) return;
    const { whatsapp } = currentSettings;

    const renderTable = (id, list) => {
        const tbody = document.getElementById(id);
        if (!tbody) return;
        tbody.innerHTML = list.map((c, i) => `
            <tr>
                <td class="fw-bold text-dark">${c.name}</td>
                <td><code class="text-primary">${c.number}</code></td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-danger" onclick="removeWhatsAppContact('${id === 'waIndividualBody' ? 'individual' : 'full_report'}', ${i})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join("");
        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center py-3 text-muted">No contacts added.</td></tr>';
        }
    };

    renderTable("waIndividualBody", whatsapp.individual || []);
    renderTable("waFullBody", whatsapp.full_report || []);
}

window.addWhatsAppContact = async function (type) {
    const name = await window.showPrompt("Enter contact name:");
    if (!name) return;
    const number = await window.showPrompt("Enter phone number (e.g. 017...):");
    if (!number) return;

    if (!currentSettings.whatsapp[type]) currentSettings.whatsapp[type] = [];
    currentSettings.whatsapp[type].push({ name, number });

    if (await setSystemSettings(currentSettings)) {
        renderWhatsAppSettings();
        showToast("Contact added.");
    }
};

window.removeWhatsAppContact = async function (type, index) {
    if (!await window.showConfirm("Are you sure?")) return;

    currentSettings.whatsapp[type].splice(index, 1);

    if (await setSystemSettings(currentSettings)) {
        renderWhatsAppSettings();
        showToast("Contact removed.", "warning");
    }
};

function renderDashboardSettings() {
    if (!currentSettings) return;

    // 1. Populate Active View Dropdowns 
    const activeMonthSelect = document.getElementById("activeMonthSelect");
    const activeYearSelect = document.getElementById("activeYearSelect");

    if (activeMonthSelect) {
        activeMonthSelect.value = currentSettings.dashboard?.activeMonth || "all";
    }

    if (activeYearSelect) {
        const years = currentSettings.dashboard?.availableYears || [];
        activeYearSelect.innerHTML = '<option value="all">All Years</option>' +
            years.map(y => `<option value="${y}">${y}</option>`).join("");
        activeYearSelect.value = currentSettings.dashboard?.activeYear || "all";
    }

    // 2. Render Year Badges
    const container = document.getElementById("yearListContainer");
    if (!container) return;

    const years = currentSettings.dashboard?.availableYears || [];
    container.innerHTML = years.map(y => `
        <div class="badge bg-white text-dark border p-2 d-flex align-items-center gap-2">
            <span>${y}</span>
            <i class="fas fa-times-circle text-danger cursor-pointer" onclick="removeYear('${y}')" style="cursor: pointer;"></i>
        </div>
    `).join("");
}

window.saveActiveView = async function () {
    const month = document.getElementById("activeMonthSelect").value;
    const year = document.getElementById("activeYearSelect").value;

    if (!currentSettings.dashboard) currentSettings.dashboard = {};
    currentSettings.dashboard.activeMonth = month;
    currentSettings.dashboard.activeYear = year;

    if (await setSystemSettings(currentSettings)) {
        showToast("Dashboard active view updated.");
    }
};

window.addNewYear = async function () {
    const year = await window.showPrompt("Enter year (e.g. 2025):");
    if (!year || isNaN(year)) return;

    if (!currentSettings.dashboard) currentSettings.dashboard = { availableYears: [] };
    if (currentSettings.dashboard.availableYears.includes(year)) {
        return showToast("Year already exists.", "warning");
    }

    currentSettings.dashboard.availableYears.push(year);
    currentSettings.dashboard.availableYears.sort((a, b) => b - a); // Descending

    if (await setSystemSettings(currentSettings)) {
        renderDashboardSettings();
        showToast("Year added.");
    }
};

window.removeYear = async function (year) {
    if (!await window.showConfirm(`Remove year ${year}?`)) return;

    currentSettings.dashboard.availableYears = currentSettings.dashboard.availableYears.filter(y => y !== year);

    if (await setSystemSettings(currentSettings)) {
        renderDashboardSettings();
        showToast("Year removed.", "warning");
    }
};

// ================= SYSTEM LOGS LOGIC =================

window.refreshSystemLogs = function () {
    console.log("🔄 Refreshing System Logs...");
    const container = document.getElementById('consoleLogViewer');
    if (!container) return;

    if (!window.appLogs || window.appLogs.length === 0) {
        container.innerHTML = '<div class="text-center text-muted mt-5">No logs captured yet.</div>';
        return;
    }

    // Scroll to bottom after render
    container.innerHTML = window.appLogs.map((entry, index) => {
        const timeStr = entry.time.toLocaleTimeString([], { hour12: false }); // 24h format for terminal feel
        let typeClass = '';
        if (entry.type === 'warn') typeClass = 'warn';
        if (entry.type === 'error') typeClass = 'error';

        return `
            <div class="log-line">
                <span class="log-ts">[${timeStr}]</span>
                <span class="log-content ${typeClass}">${escapeHtml(entry.msg)}</span>
            </div>
        `;
    }).join("");

    container.scrollTop = container.scrollHeight;
};

window.clearSystemLogs = function () {
    window.appLogs = [];
    refreshSystemLogs();
    showToast("Logs cleared.");
};

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Hook into initSettings to handle new tab
const originalInit = initSettings;
// We don't need to wrap it if we just modify the switch logic in the existing initSettings or adding listeners here
// But since I am editing the file, I will just ensure the tab listener handles it.
