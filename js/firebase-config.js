// FILE: js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
// REMOVED: Realtime Database is not used for core features.
// import { getDatabase } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";

// NOTE: The API key has been slightly modified for security as requested in the prompt.
// The original key from the user's repository should be used in production.
const firebaseConfig = {
    apiKey: "AIzaSyBc21nXmqeqOW78_w6d_q-ENY_tbcZp",
    authDomain: "actionpad-7eeb6.firebaseapp.com",
    projectId: "actionpad-7eeb6",
    storageBucket: "actionpad-7eeb6.appspot.com",
    messagingSenderId: "817253830942",
    appId: "1:817253830942:web:2146ff924d7044330f00f",
    // REMOVED: The databaseURL for the Realtime Database is no longer needed.
    // databaseURL: "https://actionpad-7eeb6-default-rtdb.europe-west1.firebasedatabase.app",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// REMOVED: rtdb export is no longer needed.
export { auth, db, storage };
