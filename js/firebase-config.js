import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBC2lnXnnnzpeqYw70_w6q_p-EN7_tbC2o",
  authDomain: "actionpad-7eeb6.firebaseapp.com",
  projectId: "actionpad-7eeb6",
  storageBucket: "actionpad-7eeb6.appspot.com",
  messagingSenderId: "817253830942",
  appId: "1:817253830942:web:2148ff924d17044330f90f",
  // IMPORTANT: Add your Realtime Database URL here for the presence system
  databaseURL: "https://actionpad-7eeb6-default-rtdb.europe-west1.firebasedatabase.app",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize and export Firebase services
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app); // Realtime Database for presence

export { auth, db, rtdb };
