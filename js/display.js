import { getActiveDb, getBookingsPath } from './storage.js';
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { updateDashboard } from './summary.js';

export let bookings = [];
export let filteredBookings = [];

let currentPage = 1;
const rowsPerPage = 50;

// Apply Table Filters
window.applyTableFilters = function () {
    const start = document.getElementById("fromDate").value;
    const end = document.getElementById("toDate").value;
    const buyerFilter = document.getElementById("tableBuyerFilter")?.value || 'all';

    filteredBookings = bookings.filter(b => {
        const date = new Date(b.bookingDate);
        let match = true;
        if (start) match = date >= new Date(start);
        if (end) match = match && date <= new Date(end);
        if (buyerFilter !== 'all') match = match && b.buyer === buyerFilter;
        return match;
    });

    currentPage = 1;
    displayBookings();
};

export function setupTableListeners() {
    const filterBtn = document.getElementById("filterBtn");
    if (filterBtn) {
        filterBtn.removeEventListener("click", window.applyTableFilters);
        filterBtn.addEventListener("click", window.applyTableFilters);
    }

    const buyerFilter = document.getElementById("tableBuyerFilter");
    if (buyerFilter) {
        buyerFilter.removeEventListener("change", window.applyTableFilters);
        buyerFilter.addEventListener("change", window.applyTableFilters);
    }

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') performSearch(e.target.value);
        });
    }

    const clearBtn = document.getElementById('clearSearchBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearSearch);
    }
}
window.setupTableListeners = setupTableListeners;

// Load bookings from Firebase
export async function loadBookings() {
    try {
        const path = getBookingsPath();
        const dbInstance = getActiveDb();
        console.log(`📡 Fetching data from: ${path} ON ${dbInstance.app.options.projectId}`);

        const q = query(collection(dbInstance, path), orderBy('bookingDate', 'desc'));
        const snapshot = await getDocs(q);
        console.log(`📊 Snapshot size for ${path}:`, snapshot.size);
        bookings = [];
        snapshot.forEach(docSnap => bookings.push({ id: docSnap.id, ...docSnap.data() }));

        window.bookings = bookings;
        filteredBookings = [...bookings];
        displayBookings();
        if (window.updateBuyerDropdown) window.updateBuyerDropdown();
        updateDashboard(bookings);
    } catch (err) {
        console.error("Error loading bookings:", err);
    }
}
window.loadBookings = loadBookings;

function performSearch(keyword) {
    if (!keyword) return;
    keyword = keyword.toLowerCase();
    filteredBookings = bookings.filter(b =>
        b.bookingNo?.toString().toLowerCase().includes(keyword) ||
        b.customer?.toLowerCase().includes(keyword) ||
        b.buyer?.toLowerCase().includes(keyword) ||
        b.item?.toLowerCase().includes(keyword)
    );
    currentPage = 1;
    displayBookings();
}

function clearSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    filteredBookings = [...bookings];
    currentPage = 1;
    displayBookings();
}

window.clearSearch = clearSearch;

export function displayBookings() {
    const tbody = document.getElementById('bookingsTable');
    if (!tbody) return;

    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const paginatedBookings = filteredBookings.slice(start, end);

    if (!paginatedBookings.length) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4">No bookings found</td></tr>`;
        displayPagination();
        return;
    }

    tbody.innerHTML = paginatedBookings.map(b => {
        const status = b.checkStatus || 'Unverified';
        const badgeClass = status === 'Verified' ? 'bg-success' : 'bg-danger';
        return `
    <tr>
            <td><span class="booking-badge">${b.bookingNo}</span></td>
            <td><div class="fw-semibold">${b.customer}</div></td>
            <td>${b.buyer}</td>
            <td>${b.item}</td>
            <td>${new Date(b.bookingDate).toLocaleDateString()}</td>
            <td><span class="badge ${badgeClass}">${status}</span></td>
            <td>${b.checkDate ? new Date(b.checkDate).toLocaleDateString() : '-'}</td>
            <td>${b.remarks || '-'}</td>
            <td class="text-center">
                <button class="action-btn btn-edit" onclick="editBooking('${b.id}')"><i class="fas fa-edit"></i></button>
                <button class="action-btn btn-delete" onclick="deleteBooking('${b.id}')"><i class="fas fa-trash-alt"></i></button>
            </td>
        </tr>`;
    }).join('');

    displayPagination();
}

function displayPagination() {
    const paginationContainer = document.getElementById('pagination');
    if (!paginationContainer) return;
    const pageCount = Math.ceil(filteredBookings.length / rowsPerPage);
    if (pageCount <= 1) { paginationContainer.innerHTML = ''; return; }
    let buttons = '';
    for (let i = 1; i <= pageCount; i++) {
        buttons += `<button class="btn btn-sm ${i === currentPage ? 'btn-primary' : 'btn-outline-primary'} me-1" onclick="goToPage(${i})">${i}</button>`;
    }
    paginationContainer.innerHTML = buttons;
}

window.goToPage = function (page) {
    currentPage = page;
    displayBookings();
};