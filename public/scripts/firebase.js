import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  getDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

/* ========== CONFIG ========== */
const firebaseConfig = {
  apiKey: "AIzaSyD4QdOuBegYmRfyofIb3NXJMyFPVrHUuxI",
  authDomain: "fir-test-e4fda.firebaseapp.com",
  databaseURL: "https://fir-test-e4fda-default-rtdb.firebaseio.com",
  projectId: "fir-test-e4fda",
  storageBucket: "fir-test-e4fda.firebasestorage.com",
  messagingSenderId: "1089856463518",
  appId: "1:1089856463518:web:9cc53d056cb69ab673518f"
};
const IMGBB_KEY = "5ef7cd278c7926f46592ee2d4bcb78fa";

/* ========== INIT ========== */
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
export { db, auth }; // <-- export for shared use