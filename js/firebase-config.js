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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage, app };
