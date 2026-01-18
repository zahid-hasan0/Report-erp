// js/main.js
import { loadBookings } from './display.js';
import { showPage } from './navigation.js';
import { loadBuyers } from './buyerManager.js';
import { addNotice } from './notice.js';
import { showToast } from "./toast.js";
import { initProfile } from "./profile.js";
import { initAuthGuard, logoutUser } from "./auth.js";
import { setupReportListeners } from "./summary.js";
import { initNotifications } from "./notifications.js";
import { loadUserProfile, initProfileDropdown } from "./profileManagement.js";
import { initAnnouncements } from "./announcements.js";
import { initMerchandisingGlobal } from "./merchandising.js";

// 1. Initialize Auth Guard immediately (for redirects)
initAuthGuard();

// 2. Global window exports (for HTML onclicks)
window.logoutUser = logoutUser;
window.showPage = showPage;
window.addNotice = addNotice;

// --- Application Startup ---
window.addEventListener('load', async () => {
    console.log('🚀 Application initializing...');

    // Attach listeners and load notifications after DOM is ready
    setupReportListeners();
    initNotifications();
    initProfile();
    loadUserProfile();
    initProfileDropdown();
    initAnnouncements();

    // Initialize Merchandising Global with error safety
    try {
        initMerchandisingGlobal();
    } catch (e) {
        console.warn('⚠️ Merchandising initialization failed, but continuing...', e);
    }

    try {
        console.log('📦 Loading initial data...');
        // Load both bookings and buyers on startup
        await Promise.all([
            loadBookings(),
            loadBuyers()
        ]);
        console.log('✅ All data loaded successfully');

        // Check for User Default Page
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const defaultPage = currentUser.defaultPage || 'dashboardPage';

        console.log(`➡️ Redirecting to default page: ${defaultPage}`);
        showPage(defaultPage);
    } catch (error) {
        console.error('❌ Error loading data:', error);
        showToast('Error loading data. Please refresh.', 'error');
        showPage('dashboardPage');
    }
});

console.log('✅ main.js loaded successfully');