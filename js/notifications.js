import { getActiveDb, getBookingsPath } from './storage.js';
import { collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let unsubscribe = null;
let currentUnverified = [];

export function initNotifications() {
    const userString = localStorage.getItem('currentUser');
    if (!userString) return;
    const user = JSON.parse(userString);

    const bellBtn = document.getElementById('notif-bell-btn');
    const drawer = document.getElementById('notif-drawer');
    const closeBtn = document.getElementById('close-notif-drawer');

    if (bellBtn) {
        bellBtn.onclick = (e) => {
            e.stopPropagation();
            drawer.classList.toggle('open');
        };
    }
    if (closeBtn) closeBtn.onclick = () => drawer.classList.remove('open');
    document.addEventListener('click', (e) => {
        if (drawer && drawer.classList.contains('open') && !drawer.contains(e.target) && !bellBtn.contains(e.target)) {
            drawer.classList.remove('open');
        }
    });

    // Strategy: Admin and User both listen on their respective paths from getBookingsPath()
    // Admin = 'bookings' root, User = 'users/{name}/bookings'
    const path = getBookingsPath();
    const dbInstance = getActiveDb();
    console.log(`📡 Notifications: Monitoring path [${path}] ON ${dbInstance.app.options.projectId}`);
    const q = query(collection(dbInstance, path), where("checkStatus", "==", "Unverified"));

    startListener(q, user.role);
}

function startListener(q, role) {
    if (unsubscribe) unsubscribe();
    unsubscribe = onSnapshot(q, (snapshot) => {
        currentUnverified = [];
        snapshot.forEach((docSnap) => {
            currentUnverified.push({
                id: docSnap.id,
                ...docSnap.data(),
                _sourcePath: docSnap.ref.path
            });
        });
        renderNotifications(currentUnverified, role);
    }, (error) => console.error("❌ Notification Error:", error));
}

function renderNotifications(bookings, role) {
    const badge = document.getElementById('notif-badge');
    const list = document.getElementById('notif-list');
    if (!badge || !list) return;

    if (bookings.length > 0) {
        badge.classList.remove('d-none');
        badge.textContent = bookings.length;
        badge.classList.add('notif-pulse');
    } else {
        badge.classList.add('d-none');
    }

    if (bookings.length === 0) {
        list.innerHTML = `<div class="text-center p-5 text-muted small">No unverified bookings</div>`;
        return;
    }

    const isAdmin = role === 'admin';
    list.innerHTML = bookings.map(b => `
        <div class="notif-card ${isAdmin ? 'notif-card-readonly' : ''}" 
             ${isAdmin ? '' : `onclick="handleNotifClick('${b.id}')"`}>
            <div class="notif-title">Unverified: ${b.bookingNo || 'N/A'}</div>
            <div class="notif-meta">
                <span><i class="fas fa-user-tie"></i> ${b.customer || 'N/A'}</span>
                <span><i class="fas fa-edit"></i> ${b.creatorName || b.createdBy || 'Unknown'}</span>
            </div>
            ${isAdmin ? '' : '<div class="mt-2 small text-primary fw-bold">Click to verify <i class="fas fa-arrow-right ms-1"></i></div>'}
        </div>
    `).join('');
}

window.handleNotifClick = async (id) => {
    const drawer = document.getElementById('notif-drawer');
    if (drawer) drawer.classList.remove('open');
    const booking = currentUnverified.find(b => b.id === id);
    if (!booking) return;

    if (!window.bookings) window.bookings = [];
    const existsIdx = window.bookings.findIndex(b => b.id === id);
    if (existsIdx !== -1) window.bookings[existsIdx] = booking;
    else window.bookings.push(booking);

    window._lastBookingSourcePath = booking._sourcePath;
    if (typeof window.editBooking === 'function') window.editBooking(id);
};

export function stopNotifications() {
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
}
