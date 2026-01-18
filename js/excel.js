// excel.js
import { db } from './storage.js';
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { loadBookings } from './display.js';
import { showToast } from './toast.js';

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
        <i class="fas fa-spinner fa-spin" style="font-size: 40px; color: #2563eb;"></i>
        <p style="margin: 0; font-size: 15px; font-weight: 600; color: #1e293b;">Uploading Excel...</p>
        <p style="margin: 0; font-size: 13px; color: #64748b;">Please wait while we process your file</p>
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

function parseBookingDate(input) {
    if (!input) return new Date();

    if (input instanceof Date) return input;

    if (typeof input === 'number') {
        const date = XLSX.SSF.parse_date_code(input);
        return new Date(date.y, date.m - 1, date.d);
    }

    const parts = input.toString().split(/[-\/]/);
    if (parts[0].length === 4) {
        // "YYYY-MM-DD" format
        return new Date(parts[0], parts[1] - 1, parts[2]);
    } else {
        // "DD/MM/YYYY" format
        return new Date(parts[2], parts[1] - 1, parts[0]);
    }
}

// Firestore-এ save করার জন্য local date string
function formatDateForFirestore(input) {
    const dateObj = parseBookingDate(input);
    return `${dateObj.getFullYear()}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}-${dateObj.getDate().toString().padStart(2, '0')}`;
}

export async function importExcel() {
    const file = document.getElementById('excelFile').files[0];
    if (!file) {
        showToast('Please select an Excel file', 'error');
        return;
    }

    showSpinner();

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

            if (jsonData.length === 0) {
                showToast('Excel file is empty', 'error');
                hideSpinner();
                return;
            }

            let imported = 0, skipped = 0;
            for (const [index, row] of jsonData.entries()) {
                const bookingNo = String(row['BOOKING NO'] || '').trim();
                const customer = String(row['CUSTOMER'] || '').trim();
                const buyer = String(row['BUYER'] || '').trim();
                const item = String(row['ITEM'] || '').trim();
                const remarks = String(row['Remarks'] || '').trim();
                const checkStatus = String(row['Check Status'] || 'Unverified').trim();
                const bookingDate = formatDateForFirestore(row['Date']);

                // Check Date is optional
                let checkDate = '';
                if (row['Check Date']) {
                    checkDate = formatDateForFirestore(row['Check Date']);
                }

                if (bookingNo && customer) {
                    await addDoc(collection(db, 'bookings'), {
                        bookingNo,
                        customer,
                        buyer,
                        item,
                        bookingDate,
                        checkStatus,
                        checkDate,
                        remarks
                    });
                    imported++;
                } else {
                    skipped++;
                }
            }

            await loadBookings();
            hideSpinner();

            if (imported > 0) {
                showToast(`Successfully imported ${imported} booking${imported > 1 ? 's' : ''}!${skipped > 0 ? ` (Skipped ${skipped})` : ''}`, 'success');
            } else {
                showToast('No valid bookings found to import', 'error');
            }

            document.getElementById('excelFile').value = '';

        } catch (err) {
            console.error("Error importing Excel:", err);
            hideSpinner();
            showToast(`Error importing Excel: ${err.message}`, 'error');
        }
    };

    reader.onerror = function () {
        hideSpinner();
        showToast('Failed to read Excel file', 'error');
    };

    reader.readAsArrayBuffer(file);
}

window.importExcel = importExcel;

// Template download function
function downloadTemplate() {
    try {
        const template = [
            {
                "BOOKING NO": "BK001",
                "CUSTOMER": "Sample Customer",
                "BUYER": "Sample Buyer",
                "ITEM": "Sample Item",
                "Date": new Date().toISOString().split('T')[0],
                "Check Status": "Unverified",
                "Check Date": new Date().toISOString().split('T')[0],
                "Remarks": "Sample remarks"
            }
        ];

        // Create workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(template);

        // Set column widths
        ws['!cols'] = [
            { wch: 15 },
            { wch: 25 },
            { wch: 25 },
            { wch: 20 },
            { wch: 12 },
            { wch: 15 },
            { wch: 12 },
            { wch: 30 }
        ];

        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, "Booking_Template.xlsx");

        showToast('Template downloaded successfully!', 'success');
    } catch (err) {
        console.error("Error downloading template:", err);
        showToast('Failed to download template', 'error');
    }
}

// Make it globally accessible for HTML onclick
window.downloadTemplate = downloadTemplate;