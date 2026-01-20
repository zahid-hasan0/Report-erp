import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- Database Configurations ---
// 1. User Database (report-erp) - Primary for Auth and Users
const userConfig = {
  apiKey: "AIzaSyCI7UwJR5eMIGy3xVSWObmQO-u_o2nIjC4",
  authDomain: "report-erp.firebaseapp.com",
  projectId: "report-erp",
  storageBucket: "report-erp.firebasestorage.app",
  messagingSenderId: "627302207146",
  appId: "1:627302207146:web:6cb6a0e80940f4e1adcad3"
};

// 2. Admin Database (booking-report-system) - 792 Bookings
const adminConfig = {
  apiKey: "AIzaSyCX8m0kfZYRquiPW1aVYLZXzHtLP5ID_no",
  authDomain: "booking-report-system.firebaseapp.com",
  projectId: "booking-report-system",
  storageBucket: "booking-report-system.firebasestorage.app",
  messagingSenderId: "577850694104",
  appId: "1:577850694104:web:4498d6edef1b5d4bad3aad",
  measurementId: "G-YCWNQ0Z7M7"
};

// 3. Embellishment Database (booking-management-syste-f6652)
const embConfig = {
  apiKey: "AIzaSyAYi7iZPhSWpZP9JFda8WREaLQ6mZHksjY",
  authDomain: "item-notes.firebaseapp.com",
  projectId: "item-notes",
  storageBucket: "item-notes.firebasestorage.app",
  messagingSenderId: "937625064892",
  appId: "1:937625064892:web:c73a10c2e747cf8fb847b9",
  measurementId: "G-QHHV6X5XE6"
};

// 4. Notes Database (item-notes)
const notesConfig = {
  apiKey: "AIzaSyAYi7iZPhSWpZP9JFda8WREaLQ6mZHksjY",
  authDomain: "item-notes.firebaseapp.com",
  projectId: "item-notes",
  storageBucket: "item-notes.firebasestorage.app",
  messagingSenderId: "937625064892",
  appId: "1:937625064892:web:c73a10c2e747cf8fb847b9",
  measurementId: "G-QHHV6X5XE6"
};

// --- Initialization ---
// Primary (report-erp)
export const app = initializeApp(userConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Admin (booking-report-system)
export const app_admin = initializeApp(adminConfig, "adminApp");
export const db_admin = getFirestore(app_admin);

// Emb (booking-management-syste-f6652)
export const app_emb = initializeApp(embConfig, "embApp");
export const db_emb = getFirestore(app_emb);

// Notes (item-notes)
export const app_notes = initializeApp(notesConfig, "notesApp");
export const db_notes = getFirestore(app_notes);

/**
 * Returns the correct Firestore instance based on user role.
 * Admin -> booking-report-system (db_admin)
 * User  -> report-erp (db)
 */
export function getActiveDb() {
  const sessionStr = localStorage.getItem('currentUser');
  if (!sessionStr) {
    console.log("⚠️ No currentUser in localStorage, defaulting to User DB");
    return db;
  }
  const user = JSON.parse(sessionStr);
  const targetDb = user.role === 'admin' ? db_admin : db;
  console.log(`👤 User: ${user.username} | Role: ${user.role} | Target Project: ${targetDb.app.options.projectId}`);
  return targetDb;
}

// --- Multi-Tenant Path Resolver ---
export function getBookingsPath() {
  return getModulePath('bookings');
}

export function getModulePath(moduleName = 'bookings') {
  // Use original collection names if requested
  const nameMap = {
    'emb_reports': 'emb job storage',
    'buyer_notes': 'merchandise_items',
    'merch_buyers': 'merchandise_buyers',
    'merch_packing_list': 'merchandise_packing_list',
    'my_tasks': 'personal_tasks',
    'my_diary': 'personal_diary'
  };
  const actualName = nameMap[moduleName] || moduleName;

  const sessionStr = localStorage.getItem('currentUser');
  if (!sessionStr) return actualName;

  const user = JSON.parse(sessionStr);

  // Shared root collections (No isolation for system-wide modules)
  const isPersonalModule = moduleName === 'my_tasks' || moduleName === 'my_diary';

  if (!isPersonalModule && (moduleName === 'buyers' || moduleName === 'bookings' || moduleName === 'emb_reports' || moduleName === 'buyer_notes' || user.role === 'admin')) {
    return actualName;
  }

  // Personal modules and user-specific data are strictly isolated by username
  return `users/${user.username}/${actualName}`;
}
