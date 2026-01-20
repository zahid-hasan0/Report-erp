// auth.js
import { db } from './storage.js';
import {
    doc,
    setDoc,
    getDoc,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- Register User ---
export async function registerUser(username, password, fullName) {
    const userRef = doc(db, "users", username);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
        throw new Error("Username already taken. Please choose another.");
    }

    try {
        await setDoc(userRef, {
            username: username,
            password: password,
            fullName: fullName,
            role: 'user',
            isApproved: false,
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString(),
            isOnline: true,
            allowedModules: [] // No access by default
        });
        window.location.href = '../index.html';
    } catch (error) {
        console.error("Registration Error:", error);
        throw new Error("Registration failed: " + error.message);
    }
}

// --- Login User ---
export async function loginUser(username, password) {
    try {
        const userRef = doc(db, "users", username);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const userData = userSnap.data();
            if (userData.password !== password) throw new Error("Invalid username or password.");

            const sessionUser = {
                username: userData.username,
                role: userData.role,
                fullName: userData.fullName,
                isApproved: userData.isApproved,
                allowedModules: userData.allowedModules || []
            };
            localStorage.setItem('currentUser', JSON.stringify(sessionUser));

            try {
                const { updateDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                await updateDoc(userRef, { lastLogin: new Date().toISOString(), isOnline: true });
            } catch (err) { console.error(err); }

            window.location.href = '../index.html';
        } else {
            throw new Error("Invalid username or password.");
        }
    } catch (error) {
        console.error("Login Error:", error);
        throw error;
    }
}

// --- Logout User ---
export async function logoutUser() {
    localStorage.removeItem('currentUser');
    const isInPages = window.location.pathname.includes('/pages/');
    window.location.href = isInPages ? 'login.html' : 'pages/login.html';
}

// --- Main Auth Check ---
export async function checkAuth() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user) {
        if (!window.location.pathname.includes('login.html')) {
            window.location.href = 'pages/login.html';
        }
        return;
    }

    updateSidebarVisibility(user);

    const sidebarName = document.getElementById('sidebarUserName');
    const sidebarRole = document.getElementById('sidebarUserRole');
    if (sidebarName) sidebarName.textContent = user.fullName || user.username;
    if (sidebarRole) sidebarRole.textContent = user.role === 'admin' ? 'Administrator' : 'User';

    // --- Strict Redirect Logic ---
    // If user is already on a page, check if they are allowed to be there.
    // If not, redirect them to their first allowed page.
    if (user.role !== 'admin') {
        const path = window.location.pathname;
        let currentPageId = null;

        if (path.includes('dashboard') || path.endsWith('index.html') || path === '/') currentPageId = 'dashboardPage';
        else if (path.includes('booking')) currentPageId = 'bookingPage';
        else if (path.includes('emb-entry')) currentPageId = 'embEntryPage';
        else if (path.includes('emb-report')) currentPageId = 'embReportPage';
        else if (path.includes('buyer-notes')) currentPageId = 'buyerNotesPage';
        else if (path.includes('buyers')) currentPageId = 'buyerManagementPage';
        else if (path.includes('reports')) currentPageId = 'reportPage';
        else if (path.includes('settings')) currentPageId = 'settingsPage';
        else if (path.includes('merchandising.html')) currentPageId = 'merchandisingPage';
        else if (path.includes('merchandising-buyers')) currentPageId = 'merchandisingBuyersPage';
        else if (path.includes('my-tasks')) currentPageId = 'myTasksPage';
        else if (path.includes('my-diary')) currentPageId = 'myDiaryPage';
        else if (path.includes('profile')) currentPageId = 'profilePage';

        if (currentPageId && !canAccessPage(currentPageId)) {
            console.warn(`⛔ checkAuth: User on restricted page '${currentPageId}'. Redirecting...`);
            const allowedPage = getFirstAllowedPage(user);
            if (allowedPage && allowedPage !== currentPageId) {
                // We can't easily jump pages if we rely on single-page 'showPage', 
                // but if this is a hard reload/initial visit, we might need to rely on main.js to handle the actual content load.
                // However, if strict mode is ON, we should probably force the logic here if possible, 
                // OR let main.js handle the content swap if it's SPA.
                // For safety: if we are on a separate HTML file (like pages/booking.html directly), specific logic applies.
                // But this app is SPA-like with index.html loading content.
                // So checkAuth is mostly for 'login' check.
                // We will let main.js handle the actual showPage redirection to avoid double-firing.
            }
        }
    }
}

// --- Refresh Session (Fix Race Conditions) ---
export async function refreshSession() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user) return null;

    try {
        const userRef = doc(db, "users", user.username);
        const docSnap = await getDoc(userRef);

        if (docSnap.exists()) {
            const newData = docSnap.data();
            user.role = newData.role;
            user.allowedModules = newData.allowedModules || [];
            user.fullName = newData.fullName;
            user.defaultPage = newData.defaultPage;
            user.zoomLevel = newData.zoomLevel;

            localStorage.setItem('currentUser', JSON.stringify(user));
            window.currentUserData = user;

            console.log("🔄 Session Refreshed from Firestore:", user.allowedModules);
            updateSidebarVisibility(user); // Update UI immediately
            return user;
        }
    } catch (error) {
        console.error("Session Refresh Failed:", error);
    }
    return user; // Return existing if fail
}

// --- Init Auth Guard ---
export function initAuthGuard() {
    const sessionStr = localStorage.getItem('currentUser');
    let user = sessionStr ? JSON.parse(sessionStr) : null;
    if (user) window.currentUserData = user;

    if (!user) {
        if (!window.location.pathname.includes('login.html')) {
            const isInPages = window.location.pathname.includes('/pages/');
            window.location.href = isInPages ? 'login.html' : 'pages/login.html';
        }
    } else {
        updateSidebarVisibility(user);

        if (!window.userListenerSet) {
            const userRef = doc(db, "users", user.username);
            onSnapshot(userRef, (docSnap) => {
                if (docSnap.exists()) {
                    const newData = docSnap.data();
                    user.role = newData.role;
                    user.allowedModules = newData.allowedModules || [];
                    user.fullName = newData.fullName;
                    user.defaultPage = newData.defaultPage;
                    user.zoomLevel = newData.zoomLevel;

                    localStorage.setItem('currentUser', JSON.stringify(user));
                    window.currentUserData = user;

                    console.log("🔥 Auth Update: New Permissions Receive:", user.allowedModules);

                    updateSidebarVisibility(user);
                    if (window.updateSidebarAccess) window.updateSidebarAccess(user);

                    // Dynamically update notifications based on new permissions
                    import('./notifications.js').then(m => {
                        if (m.updateNotificationAccess) m.updateNotificationAccess(user);
                    });
                }
            });
            window.userListenerSet = true;
        }
    }
}

// --- Page Access Check (Open Access Update) ---
// --- Page Access Check (Strict) ---
export function canAccessPage(pageId) {
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (!user || !user.username) return false;

    // settingsPage is ONLY for Admins
    if (pageId === 'settingsPage') {
        return user.role === 'admin';
    }

    // Strict Check: Must be in allowedModules
    const allowed = user.allowedModules || [];
    return allowed.includes(pageId);
}

// --- Get First Allowed Page (Strict) ---
export function getFirstAllowedPage(user) {
    if (!user || !user.allowedModules || user.allowedModules.length === 0) return null;

    // Priority order for redirect
    const priority = [
        'dashboardPage', 'bookingPage', 'myTasksPage', 'profilePage'
    ];

    for (const p of priority) {
        if (user.allowedModules.includes(p)) return p;
    }
    return user.allowedModules[0];
}

// --- Sidebar Visibility (Strict) ---
export function updateSidebarVisibility(user) {
    if (!user) return;
    const allowed = user.allowedModules || [];
    const isAdmin = user.role === 'admin';

    const existingStyle = document.getElementById('sidebar-visibility-style');
    if (existingStyle) existingStyle.remove();

    // Map Page IDs to Sidebar IDs
    const map = {
        'dashboardPage': 'nav-dashboard',
        'bookingPage': 'nav-booking',
        'buyerManagementPage': 'nav-buyers', // Added
        'reportPage': 'nav-reports',         // Added
        'embEntryPage': 'nav-emb-entry',
        'embReportPage': 'nav-emb-report',
        'buyerNotesPage': 'nav-buyer-notes',
        'merchandisingPage': 'nav-merchandising',
        'merchandisingBuyersPage': 'nav-merchandising-buyers',
        'myTasksPage': 'nav-my-tasks',
        'myDiaryPage': 'nav-my-diary',
        'profilePage': 'nav-profile',
        'settingsPage': 'nav-settings'
    };

    // 1. Hide EVERYTHING by default using CSS
    // Include all parent dropdowns and specific links
    // NOTE: Submenus (e.g. #trimsSubmenu) are NOT hidden here to avoid breaking Bootstrap's toggle.
    // Security remains strict because the TRIGGER (#nav-trims-dropdown) and CHILDREN (#nav-reports) are hidden.
    let css = `
        #nav-dashboard, #nav-booking, 
        #nav-buyers, #nav-reports, #nav-trims-dropdown,
        #nav-emb-entry, #nav-emb-report, #nav-emb-dropdown,
        #nav-buyer-notes, 
        #nav-merchandising, #nav-merchandising-buyers, #nav-merchandising-dropdown,
        #nav-my-tasks, #nav-my-diary, #nav-personal-dropdown,
        #nav-profile, #nav-settings {
            display: none !important;
        }
    `;

    // 2. Un-hide allowed items
    allowed.forEach(pageId => {
        const navId = map[pageId];
        if (navId) {
            css += `#${navId} { display: flex !important; }\n`;

            // Handle Parent Dropdowns
            // Only show the TRIGGER. Do not force the submenu to block (let Bootstrap handle it).

            // Trims (Buyers & Reports)
            if (['buyerManagementPage', 'reportPage'].includes(pageId)) {
                css += `#nav-trims-dropdown { display: flex !important; }\n`;
            }
            // EMB
            if (['embEntryPage', 'embReportPage'].includes(pageId)) {
                css += `#nav-emb-dropdown { display: flex !important; }\n`;
            }
            // Merchandising
            if (['merchandisingPage', 'merchandisingBuyersPage'].includes(pageId)) {
                css += `#nav-merchandising-dropdown { display: flex !important; }\n`;
            }
            // My Tasks / Private
            if (['myTasksPage', 'myDiaryPage'].includes(pageId)) {
                css += `#nav-personal-dropdown { display: flex !important; }\n`;
            }
        }
    });

    // 3. Settings - Admin Only
    if (isAdmin) {
        css += `#nav-settings { display: flex !important; }\n`;
    }

    const style = document.createElement('style');
    style.id = 'sidebar-visibility-style';
    style.textContent = css;
    document.head.appendChild(style);
}

window.updateSidebarVisibility = updateSidebarVisibility;
