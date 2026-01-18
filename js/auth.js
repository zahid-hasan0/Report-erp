// auth.js
import { db } from './storage.js';
import {
    doc,
    setDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- Register User (Manual) ---
export async function registerUser(username, password, fullName) {
    // 1. Check if user already exists
    const userRef = doc(db, "users", username);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
        throw new Error("Username already taken. Please choose another.");
    }

    try {
        // 2. Save User to Firestore (Manual Auth)
        await setDoc(userRef, {
            username: username,
            password: password, // Storing plain/simple as requested
            fullName: fullName,
            role: 'user', // Default role
            isApproved: false, // Default: Pending approval
            createdAt: new Date().toISOString(),
            allowedModules: []
        });

        console.log('User registered manually:', username);
        // Redirect to Main App directly (No approval needed)
        window.location.href = '../index.html';

    } catch (error) {
        console.error("Registration Error:", error);
        throw new Error("Registration failed: " + error.message);
    }
}

// --- Login User (Manual) ---
export async function loginUser(username, password) {
    try {
        const userRef = doc(db, "users", username);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const userData = userSnap.data();

            // 1. Validate Password
            if (userData.password !== password) {
                throw new Error("Invalid username or password.");
            }

            // 2. Set Session (LocalStorage)
            const sessionUser = {
                username: userData.username,
                role: userData.role,
                fullName: userData.fullName,
                isApproved: userData.isApproved,
                allowedModules: userData.allowedModules || []
            };
            localStorage.setItem('currentUser', JSON.stringify(sessionUser));

            // 3. Redirect to App (Access control happens inside via navigation.js)
            window.location.href = '../index.html';

        } else {
            throw new Error("Invalid username or password.");
        }

    } catch (error) {
        console.error("Login Error:", error);
        throw error; // Propagate error to UI
    }
}

// --- Logout User ---
export async function logoutUser() {
    localStorage.removeItem('currentUser');
    // Determine path based on current location
    const isInPages = window.location.pathname.includes('/pages/');
    window.location.href = isInPages ? 'login.html' : 'pages/login.html';
}

import { onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- Monitor Auth State (Protects pages via LocalStorage) ---
export function initAuthGuard() {
    const sessionStr = localStorage.getItem('currentUser');
    let user = sessionStr ? JSON.parse(sessionStr) : null;

    // Make user data globally available
    if (user) window.currentUserData = user;

    const currentPath = window.location.pathname;
    const isAuthPage = currentPath.includes('login.html') || currentPath.includes('register.html');

    if (!user) {
        if (!isAuthPage) {
            const loginPath = currentPath.includes('/pages/') ? 'login.html' : 'pages/login.html';
            window.location.href = loginPath;
        }
    } else {
        // --- REAL-TIME PERMISSION & PROFILE SYNC ---
        if (!window.userListenerSet) {
            const userRef = doc(db, "users", user.username);
            onSnapshot(userRef, (docSnap) => {
                if (docSnap.exists()) {
                    const newData = docSnap.data();

                    // Update current user object and localStorage
                    user.role = newData.role;
                    user.isApproved = newData.isApproved;
                    user.allowedModules = newData.allowedModules || [];
                    user.fullName = newData.fullName;
                    user.username = newData.username;
                    user.defaultPage = newData.defaultPage; // Sync default page preference
                    user.zoomLevel = newData.zoomLevel || '100'; // Sync zoom level

                    localStorage.setItem('currentUser', JSON.stringify(user));
                    window.currentUserData = user;

                    console.log("🔄 User data synced from Cloud:", user.username);

                    // Trigger dynamic UI updates
                    if (window.updateSidebarAccess) {
                        window.updateSidebarAccess(user);
                    }

                    // Update Sidebar and Header Names
                    const sidebarName = document.getElementById('sidebarUserName');
                    const navName = document.getElementById('username'); // In case header name exists elsewhere
                    const displayName = user.fullName || user.username;

                    if (sidebarName) sidebarName.textContent = displayName;
                    if (navName) navName.textContent = displayName;
                }
            });
            window.userListenerSet = true;
        }

        if (isAuthPage) {
            window.location.href = '../index.html';
        } else {
            // Initial UI setup before listener fires
            if (window.updateSidebarAccess) {
                window.updateSidebarAccess(user);
            }
            const sidebarName = document.getElementById('sidebarUserName');
            if (sidebarName) sidebarName.textContent = user.fullName || user.username;
        }
    }
}
