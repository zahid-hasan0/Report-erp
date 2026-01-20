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
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const currentUsername = currentUser.username;

        bookings = [];
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            // STRICT DATA ISOLATION
            // 1. If data has an owner, and owner != me -> HIDE
            // 2. If data has NO owner (legacy), -> SHOW (or Hide? safer to show for now unless requested)
            // User requested: "suhdu tar tai dekhbe" (only see his own).
            // This implies strictness.
            // If I hide legacy, the table might become empty.
            // I will assume strict ownership for new data, and allow legacy usage if needed?
            // "no admin er database alada se sudu tar tai dekhbe onno karor ta dekhbe na"
            // Translation: "Admin DB is separate, he sees only his. User sees only user's."
            // This suggests Strictness is paramount.
            // However, to prevent "Where is my old data?" panic, I will show legacy data (no `createdBy`) 
            // BUT hide anything that EXPLICITLY belongs to someone else.

            if (data.createdBy && data.createdBy !== currentUsername) {
                return; // Skip this record
            }

            bookings.push({ id: docSnap.id, ...data });
        });

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

    if (filteredBookings.length === 0) {
        paginationContainer.innerHTML = '';
        return;
    }

    const totalPages = Math.ceil(filteredBookings.length / rowsPerPage);

    // Centered Elite Style
    paginationContainer.className = 'd-flex justify-content-center align-items-center mt-4 gap-3';

    paginationContainer.innerHTML = `
        <button class="btn btn-outline-secondary btn-sm px-3 rounded-pill" ${currentPage === 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})">
            <i class="fas fa-arrow-left me-1"></i> Prev
        </button>
        
        <span class="text-muted small fw-bold user-select-none">
            Page ${currentPage} of ${totalPages}
        </span>

        <button class="btn btn-outline-secondary btn-sm px-3 rounded-pill" ${currentPage >= totalPages ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})">
            Next <i class="fas fa-arrow-right ms-1"></i>
        </button>
    `;
}

window.goToPage = function (page) {
    if (page < 1 || page > Math.ceil(filteredBookings.length / rowsPerPage)) return;
    currentPage = page;
    displayBookings();

    // Smooth scroll to top of table
    const table = document.querySelector('.table-container');
    if (table) table.scrollIntoView({ behavior: 'smooth', block: 'start' });
};