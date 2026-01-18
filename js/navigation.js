// navigation.js
import { loadBookings } from './display.js';
import { loadBuyers } from './buyerManager.js';
import { updateDashboard } from './summary.js';
import { initSettings } from './adminSettings.js';
import { getSystemSettings } from './systemSettings.js';

// Cache for page content
const pageCache = {};

export async function showPage(pageId) {
    // 0. Security Check
    // (Ensure canAccessPage exists or is imported if used here, or handled globally)
    // For now, assuming Global Auth Guard handles redirects, but let's keep the check if canAccessPage is defined
    if (typeof canAccessPage === 'function' && !canAccessPage(pageId)) {
        console.warn(`⛔ Access denied to ${pageId}`);
        return;
    }

    const navMap = {
        'dashboardPage': 'nav-dashboard',
        'bookingPage': 'nav-booking',
        'embEntryPage': 'nav-emb-entry',
        'embReportPage': 'nav-emb-report',
        'buyerNotesPage': 'nav-buyer-notes',
        'buyerManagementPage': 'nav-buyers',
        'reportPage': 'nav-reports',
        'settingsPage': 'nav-settings',
        'merchandisingPage': 'nav-merchandising',
        'merchandisingBuyersPage': 'nav-merchandising-buyers',
        'myTasksPage': 'nav-my-tasks',
        'myDiaryPage': 'nav-my-diary'
    };

    const titleMap = {
        'dashboardPage': 'Dashboard Overview',
        'bookingPage': 'Booking Operations',
        'embEntryPage': 'Emb Entry',
        'embReportPage': 'Emb Reports',
        'buyerNotesPage': 'Buyer Notes',
        'buyerManagementPage': 'Buyer Library',
        'reportPage': 'Analytics & Reports',
        'settingsPage': 'System Settings',
        'merchandisingPage': 'Packing List',
        'merchandisingBuyersPage': 'Manage Buyers',
        'myTasksPage': 'My Task Planner',
        'myDiaryPage': 'Personal Diary'
    };

    // 1. Update Sidebar Active State
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    const activeNavId = navMap[pageId];
    if (activeNavId) {
        const activeLink = document.getElementById(activeNavId);
        if (activeLink) activeLink.classList.add('active');
    }

    // 2. Update Header Title
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) {
        pageTitle.innerText = titleMap[pageId] || 'Overview';
    }

    // 3. Load Content
    const appContent = document.getElementById('app-content');
    if (!appContent) return;

    // Map pageId to file path
    const fileMap = {
        'dashboardPage': 'pages/dashboard.html',
        'bookingPage': 'pages/booking.html',
        'embEntryPage': 'pages/emb-entry.html',
        'embReportPage': 'pages/emb-report.html',
        'buyerNotesPage': 'pages/buyer-notes.html',
        'buyerManagementPage': 'pages/buyers.html',
        'reportPage': 'pages/reports.html',
        'settingsPage': 'pages/settings.html',
        'merchandisingPage': 'pages/merchandising.html',
        'merchandisingBuyersPage': 'pages/merchandising-buyers.html',
        'myTasksPage': 'pages/my-tasks.html',
        'myDiaryPage': 'pages/my-diary.html'
    };

    let filePath = fileMap[pageId];

    // Special Logic: If User has NO modules, show 'home.html' instead of Dashboard
    if (pageId === 'dashboardPage') {
        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const isAdmin = user.role === 'admin';
        const hasModules = user.allowedModules && user.allowedModules.length > 0;

        if (!isAdmin && !hasModules) {
            filePath = 'pages/home.html';
            // Also update title
            if (pageTitle) pageTitle.innerText = "Welcome";
        }
    }

    if (!filePath) {
        console.error(`Page ID ${pageId} not found in fileMap.`);
        appContent.innerHTML = '<div class="p-4 text-danger">Page not found (Invalid ID)</div>';
        return;
    }

    try {
        let content = pageCache[pageId];
        // Don't cache dashboard if we might swap it
        if (!content || pageId === 'dashboardPage') {
            const response = await fetch(filePath);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            content = await response.text();
            if (pageId !== 'dashboardPage') pageCache[pageId] = content;
        }

        appContent.innerHTML = content;

        // 4. Initialize Page Scripts
        await initPageScripts(pageId);

    } catch (error) {
        console.error('Error loading page:', error);
        appContent.innerHTML = `<div class="p-4 text-danger">Error loading content: ${error.message}</div>`;
    }
}
window.showPage = showPage;

async function initPageScripts(pageId) {
    console.log(`🚀 Initializing script for: ${pageId}`);

    if (pageId === 'dashboardPage') {
        if (window.bookings) await updateDashboard(window.bookings);
        // Charts will be auto-updated by updateDashboard calling updateCharts
    }
    else if (pageId === 'bookingPage') {
        // Re-attach listeners for booking form
        if (window.setupBookingFormListeners) window.setupBookingFormListeners();
        if (window.setupTableListeners) window.setupTableListeners();
        if (window.resetForm) window.resetForm();

        // Reload data to ensure table is fresh
        await loadBookings();
        await loadBuyers(); // For dropdowns
    }
    else if (pageId === 'buyerManagementPage') {
        if (window.setupBuyerPageListeners) window.setupBuyerPageListeners();
        await loadBuyers();
    }
    else if (pageId === 'reportPage') {
        if (window.setupReportListeners) window.setupReportListeners();

        // Force update of report tables if data exists
        if (window.bookings && window.bookings.length > 0) {
            await updateDashboard(window.bookings);
        } else {
            await loadBookings();
        }
    }
    else if (pageId === 'embEntryPage') {
        const { initEmbEntry } = await import('./embReport_integrated.js');
        await initEmbEntry();
    }
    else if (pageId === 'embReportPage') {
        const { initEmbReportView } = await import('./embReport_integrated.js');
        await initEmbReportView();
    }
    else if (pageId === 'buyerNotesPage') {
        const { initBuyerNotes } = await import('./buyerNotes_integrated.js');
        await initBuyerNotes();
    }
    else if (pageId === 'settingsPage') {
        await initSettings();
    }
    else if (pageId === 'merchandisingPage') {
        const { initMerchandising } = await import('./merchandising.js');
        initMerchandising();
    }
    else if (pageId === 'merchandisingBuyersPage') {
        const { initMerchandisingBuyers } = await import('./merchandising.js');
        initMerchandisingBuyers();
    }
    else if (pageId === 'myTasksPage') {
        const { initMyTasks } = await import('./myTasks.js');
        initMyTasks();
    }
    else if (pageId === 'myDiaryPage') {
        const { initMyDiary } = await import('./myDiary.js');
        initMyDiary();
    }
}


// Clock Modal Logic (Preserved)
window.openClockModal = function () {
    const modal = document.getElementById('clockModal');
    if (modal) {
        modal.style.display = 'block';
        updateBigClock();
        if (!window.clockInterval) {
            window.clockInterval = setInterval(updateBigClock, 1000);
        }
    }
}

document.querySelector('.close-clock')?.addEventListener('click', () => {
    document.getElementById('clockModal').style.display = 'none';
    clearInterval(window.clockInterval);
    window.clockInterval = null;
});

// Close when clicking outside
window.onclick = function (event) {
    const modal = document.getElementById('clockModal');
    if (event.target == modal) {
        modal.style.display = "none";
        clearInterval(window.clockInterval);
        window.clockInterval = null;
    }
}

function updateBigClock() {
    const now = new Date();
    const dateEl = document.getElementById('bigClockDate');
    const timeEl = document.getElementById('bigClockTime');

    if (dateEl) {
        dateEl.textContent = now.toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }
    if (timeEl) {
        timeEl.textContent = now.toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    }

    const headerDate = document.getElementById('currentDate');
    if (headerDate) {
        headerDate.textContent = now.toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }
}
window.updateBigClock = updateBigClock;

// Set current date
const currentDateEl = document.getElementById('currentDate');
if (currentDateEl) {
    currentDateEl.textContent = new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
}

// ==========================================
// ACCESS CONTROL & SIDEBAR LOGIC
// ==========================================

// 1. Check Page Access
export function canAccessPage(pageId) {
    const user = window.currentUserData || JSON.parse(localStorage.getItem('currentUser'));
    if (!user) return false;

    // Admin always has access
    if (user.role === 'admin') return true;

    // "Settings" is strictly for Admin, unless we allow "My Profile" for users later
    if (pageId === 'settingsPage') return user.role === 'admin';

    // "Home", "My Tasks", and "My Diary" are safe for everyone (Personal data)
    if (pageId === 'dashboardPage' || pageId === 'myTasksPage' || pageId === 'myDiaryPage') {
        return true;
    }

    // Check specific permissions
    const allowed = user.allowedModules || [];
    return allowed.includes(pageId);
}
window.canAccessPage = canAccessPage; // Expose globally for showPage check

// 2. Update Sidebar Visibility
window.updateSidebarAccess = function (user) {
    if (!user) return;

    const settingsNav = document.getElementById('nav-settings');
    const trimsDropdown = document.querySelector('[href="#trimsSubmenu"]');
    const trimsMenu = document.getElementById('trimsSubmenu');
    const embDropdown = document.querySelector('[href="#embSubmenu"]');
    const embMenu = document.getElementById('embSubmenu');

    // All data modules
    const moduleIds = ['nav-dashboard', 'nav-booking', 'nav-emb-entry', 'nav-emb-report', 'nav-buyer-notes', 'nav-my-tasks', 'nav-my-diary', 'nav-buyers', 'nav-reports', 'nav-merchandising', 'nav-merchandising-buyers'];

    // Default: Hide all
    moduleIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.setProperty('display', 'none', 'important');
    });
    if (settingsNav) settingsNav.style.setProperty('display', 'none', 'important');
    if (trimsDropdown) trimsDropdown.style.setProperty('display', 'none', 'important');
    if (embDropdown) embDropdown.style.setProperty('display', 'none', 'important');
    const merchDropdown = document.getElementById('nav-merchandising-dropdown');
    if (merchDropdown) merchDropdown.style.setProperty('display', 'none', 'important');

    // Admin: Show Everything
    if (user.role === 'admin') {
        moduleIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.setProperty('display', 'flex', 'important');
        });
        if (settingsNav) settingsNav.style.setProperty('display', 'flex', 'important');
        if (trimsDropdown) trimsDropdown.style.setProperty('display', 'flex', 'important');
        if (embDropdown) embDropdown.style.setProperty('display', 'flex', 'important');
        const merchDropdown = document.getElementById('nav-merchandising-dropdown');
        if (merchDropdown) merchDropdown.style.setProperty('display', 'flex', 'important');
        return;
    }

    // User: Show only allowed
    const allowed = user.allowedModules || [];
    const navMap = {
        'dashboardPage': 'nav-dashboard',
        'bookingPage': 'nav-booking',
        'embEntryPage': 'nav-emb-entry',
        'embReportPage': 'nav-emb-report',
        'buyerNotesPage': 'nav-buyer-notes',
        'buyerManagementPage': 'nav-buyers',
        'reportPage': 'nav-reports',
        'merchandisingPage': 'nav-merchandising',
        'merchandisingBuyersPage': 'nav-merchandising-buyers'
    };

    let hasTrimsAccess = false;
    let hasEmbAccess = false;
    allowed.forEach(pageId => {
        const navId = navMap[pageId];
        if (navId) {
            const el = document.getElementById(navId);
            if (el) el.style.setProperty('display', 'flex', 'important');
            if (['bookingPage', 'buyerManagementPage', 'reportPage'].includes(pageId)) {
                hasTrimsAccess = true;
            }
            if (['embEntryPage', 'embReportPage'].includes(pageId)) {
                hasEmbAccess = true;
            }
            if (pageId === 'merchandisingPage' || pageId === 'merchandisingBuyersPage') {
                const merchDropdown = document.getElementById('nav-merchandising-dropdown');
                if (merchDropdown) merchDropdown.style.setProperty('display', 'flex', 'important');
            }
        }
    });

    // Dashboard and My Tasks are always shown for navigation
    const dashNav = document.getElementById('nav-dashboard');
    if (dashNav) dashNav.style.setProperty('display', 'flex', 'important');

    const tasksNav = document.getElementById('nav-my-tasks');
    if (tasksNav) tasksNav.style.setProperty('display', 'flex', 'important');

    const diaryNav = document.getElementById('nav-my-diary');
    if (diaryNav) diaryNav.style.setProperty('display', 'flex', 'important');

    const personalDropdown = document.getElementById('nav-personal-dropdown');
    if (personalDropdown) personalDropdown.style.setProperty('display', 'flex', 'important');

    if (hasTrimsAccess && trimsDropdown) {
        trimsDropdown.style.setProperty('display', 'flex', 'important');
    }
    if (hasEmbAccess && embDropdown) {
        embDropdown.style.setProperty('display', 'flex', 'important');
    }
}
