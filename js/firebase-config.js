// This file configures the connection to your Firebase project.
// Replace the values with your project's specific configuration keys.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBC2lnXnnnzpeqYw70_w6q_p-EN7_tbC2o",
  authDomain: "actionpad-7eeb6.firebaseapp.com",
  projectId: "actionpad-7eeb6",
  storageBucket: "actionpad-7eeb6.appspot.com",
  messagingSenderId: "817253830942",
  appId: "1:817253830942:web:2148ff924d17044330f90f",
  measurementId: "G-VJ7P8K0LM0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize and export Firebase services to be used by other modules
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
