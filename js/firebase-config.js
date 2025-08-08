// FILE: js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";
const firebaseConfig = {
  apiKey: "AIzaSyBC2lnXnnnzpeqYw70_w6q_p-EN7_tbC2o",
  authDomain: "actionpad-7eeb6.firebaseapp.com",
  projectId: "actionpad-7eeb6",
  storageBucket: "actionpad-7eeb6.appspot.com",
  messagingSenderId: "817253830942",
  appId: "1:817253830942:web:2148ff924d17044330f90f",
  databaseURL: "https://actionpad-7eeb6-default-rtdb.europe-west1.firebasedatabase.app",
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);
const storage = getStorage(app);
export { auth, db, rtdb, storage };
