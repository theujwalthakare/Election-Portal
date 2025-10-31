// Import the Firebase SDKs (Direct from Google CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  set,
  onValue,
  update,
  remove,
  get,
  child
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";

// ✅ Your Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCrWt9R3kCgLzNc22D8phQByHCrNm5eCgQ",
  authDomain: "election-portal-37900.firebaseapp.com",
  databaseURL: "https://election-portal-37900-default-rtdb.firebaseio.com",
  projectId: "election-portal-37900",
  storageBucket: "election-portal-37900.firebasestorage.app",
  messagingSenderId: "600128189161",
  appId: "1:600128189161:web:bd2239907d9d5440e07678",
  measurementId: "G-YD0F0EDNM4"
};

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);

// ✅ Initialize Realtime Database
const db = getDatabase(app);

// ✅ Export for use in other files
export { db, ref, push, set, onValue, update, remove, get, child };
