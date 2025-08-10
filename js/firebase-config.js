// FILE: js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBC2lnXnnnzpeqYw70_w6q_p-EN7_tbC2o",
  authDomain: "actionpad-7eeb6.firebaseapp.com",
  projectId: "actionpad-7eeb6",
  storageBucket: "actionpad-7eeb6.appspot.com",
  messagingSenderId: "817253830942",
  appId: "1:817253830942:web:2148ff924d17044330f90f",
};

console.log("Initializing Firebase...");
const app = initializeApp(firebaseConfig);
console.log("Firebase app initialized:", app);

const auth = getAuth(app);
console.log("Firebase auth initialized:", auth);

const db = getFirestore(app);
console.log("Firebase firestore initialized:", db);

const storage = getStorage(app);
console.log("Firebase storage initialized:", storage);

export { auth, db, storage, app };
