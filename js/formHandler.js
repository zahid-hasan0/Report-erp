import { getActiveDb, getBookingsPath } from './storage.js';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { loadBookings } from './display.js';
import { showToast } from './toast.js';

//Spinner  start 
const spinner = document.createElement('div');
spinner.id = 'excelSpinner';
spinner.style = `
    display: none;
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 30px 40px;
    border-radius: 16px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
    z-index: 10000;
    text-align: center;
`;
spinner.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; gap: 16px;">
        <i class="fas fa-spinner fa-spin" style="font-size: 40px; color: #0c4ddaff;"></i>
        <p style="margin: 0; font-size: 15px; font-weight: 600; color: #00b318ff;">Booking Processing</p>
        <p style="margin: 0; font-size: 13px; color: #1704c2ff;">Please wait while we process your Booking</p>
    </div>
`;

// Add overlay
const overlay = document.createElement('div');
overlay.id = 'excelOverlay';
overlay.style = `
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 9999;
    backdrop-filter: blur(2px);
`;

document.body.appendChild(overlay);
document.body.appendChild(spinner);

function showSpinner() {
    overlay.style.display = 'block';
    spinner.style.display = 'block';
}

function hideSpinner() {
    overlay.style.display = 'none';
    spinner.style.display = 'none';
}

//Spinner  End

export async function saveBooking(e) {
    e.preventDefault();

    const path = getBookingsPath();
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');

    // ✅ BUYER VALIDATION - Check if buyer is selected
    const buyerValue = document.getElementById('buyer').value;
    if (!buyerValue) {
        showToast('Please select a buyer from the dropdown', 'error');
        document.getElementById('buyer').focus();
        return;
    }

    // ✅ Check if buyer exists in the buyer list
    const buyerExists = window.buyers && window.buyers.some(b => b.name === buyerValue);
    if (!buyerExists) {
        showToast('Invalid buyer selected. Please refresh the page or manage buyers first.', 'error');
        return;
    }

    const editId = document.getElementById('editId').value;

    // Get check status value
    const checkStatusValue = document.getElementById('checkStatus').value || 'Unverified';

    // Auto-set check date to today if status is Verified and no date is manually set
    let checkDateValue = document.getElementById('checkDate').value || '';
    if (checkStatusValue === 'Verified' && !checkDateValue) {
        const today = new Date().toISOString().split('T')[0];
        checkDateValue = today;
    }

    const booking = {
        bookingNo: document.getElementById('bookingNo').value,
        customer: document.getElementById('customer').value,
        buyer: buyerValue,
        item: document.getElementById('item').value,
        bookingDate: document.getElementById('bookingDate').value,
        checkStatus: checkStatusValue,
        checkDate: checkDateValue,
        remarks: document.getElementById('remarks').value,
        // Audit Info
        createdBy: user.username,
        creatorName: user.fullName || user.username,
        updatedAt: new Date().toISOString()
    };

    try {
        showSpinner();
        const dbInstance = getActiveDb();
        if (editId) {
            // Check if we have a specific source path from a notification click
            let finalDocRef;
            if (window._lastBookingSourcePath && window._lastBookingSourcePath.endsWith(editId)) {
                finalDocRef = doc(dbInstance, window._lastBookingSourcePath);
                console.log("📝 Updating via notification source path:", window._lastBookingSourcePath);
            } else {
                finalDocRef = doc(dbInstance, path, editId);
                console.log("📝 Updating via standard path:", path);
            }

            await updateDoc(finalDocRef, booking);
            window._lastBookingSourcePath = null; // Clear it
        } else {
            console.log(`📡 Adding new booking to ${dbInstance.app.options.projectId} / ${path}`);
            await addDoc(collection(dbInstance, path), {
                ...booking,
                createdAt: new Date().toISOString()
            });
        }
        resetForm();
        await loadBookings();
        hideSpinner();
        showToast('Booking saved successfully', 'success');
    } catch (err) {
        hideSpinner();
        console.error("Error saving booking:", err);
        showToast("Error saving booking: " + err.message, 'error');
    }
}

export function resetForm() {
    const form = document.getElementById('bookingForm');
    if (!form) return;

    form.reset();
    document.getElementById('editId').value = '';

    // Set default booking date to today
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('bookingDate');
    if (dateInput) dateInput.value = today;
}
window.resetForm = resetForm;

export async function editBooking(id) {
    const bookings = window.bookings || [];

    const booking = bookings.find(b => b.id === id);
    if (!booking) {
        console.log("❌ Booking not found for id:", id);
        showToast("❌ Booking not found for id:", id, 'error');
        return;
    }

    // 1. Switch to the booking page first
    await window.showPage('bookingPage');

    // 2. Wait a tiny bit for the DOM to be fully ready after injection
    setTimeout(() => {
        try {
            const editIdEl = document.getElementById('editId');
            if (!editIdEl) {
                console.error("❌ Edit form elements not found after page load");
                return;
            }

            editIdEl.value = booking.id;
            document.getElementById('bookingNo').value = booking.bookingNo || '';
            document.getElementById('customer').value = booking.customer || '';
            document.getElementById('buyer').value = booking.buyer || '';
            document.getElementById('item').value = booking.item || '';
            document.getElementById('bookingDate').value = booking.bookingDate || '';
            document.getElementById('checkStatus').value = booking.checkStatus || 'Unverified';
            document.getElementById('checkDate').value = booking.checkDate || '';
            document.getElementById('remarks').value = booking.remarks || '';

            window.scrollTo({ top: 0, behavior: 'smooth' });
            console.log("✅ Form populated for booking:", booking.bookingNo);
        } catch (err) {
            console.error("Error populating form:", err);
        }
    }, 100);
}

window.editBooking = editBooking;

export function deleteBooking(id) {
    const deleteModalEl = document.getElementById("deleteModal");
    const deleteModal = new bootstrap.Modal(deleteModalEl);
    const confirmBtn = document.getElementById("confirmDeleteBtn");
    const path = getBookingsPath();

    // Remove previous click listeners to avoid duplicates
    confirmBtn.replaceWith(confirmBtn.cloneNode(true));
    const newConfirmBtn = document.getElementById("confirmDeleteBtn");

    newConfirmBtn.addEventListener("click", async () => {
        deleteModal.hide();
        try {
            showSpinner();
            const dbInstance = getActiveDb();
            console.log(`📡 Deleting booking ${id} FROM ${dbInstance.app.options.projectId} / ${path}`);
            await deleteDoc(doc(dbInstance, path, id));
            await loadBookings();
            hideSpinner();
            showToast("Booking deleted successfully!", "success");
        } catch (err) {
            hideSpinner();
            console.error("Error deleting booking:", err);
            showToast("Error deleting booking: " + err.message, "error");
        }
    });

    deleteModal.show();
}
window.deleteBooking = deleteBooking;

// Attach form listener
export function setupBookingFormListeners() {
    const form = document.getElementById('bookingForm');
    if (form) {
        form.removeEventListener('submit', saveBooking);
        form.addEventListener('submit', saveBooking);
        console.log('✅ Booking form listener attached');
    }
}
window.setupBookingFormListeners = setupBookingFormListeners;