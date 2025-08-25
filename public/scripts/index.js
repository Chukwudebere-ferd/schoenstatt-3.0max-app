
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut 
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

// ====================== FIREBASE CONFIG ======================
const firebaseConfig = {
  apiKey: "AIzaSyDdn8ZIsSmpaXx8F9MIK6KwTTMVGCZPcd8",
  authDomain: "schoenstatt3max.firebaseapp.com",
  projectId: "schoenstatt3max",
  storageBucket: "schoenstatt3max.firebasestorage.app",
  messagingSenderId: "709706612184",
  appId: "1:709706612184:web:67d7ef78727be152bd86ad"
};

// ====================== INIT ======================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ====================== DOM ELEMENTS ======================
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

// ====================== REGISTER ======================
registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = registerForm.querySelector('input[type="email"]').value;
  const password = registerForm.querySelector('input[type="password"]').value;

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    alert("✅ Registration successful! Logged in as " + userCredential.user.email);
    window.location.href = "dashboard.html"; // redirect after login
  } catch (error) {
    alert("❌ Error: " + error.message);
  }
});

// ====================== LOGIN ======================
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = loginForm.querySelector('input[type="email"]').value;
  const password = loginForm.querySelector('input[type="password"]').value;

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    alert("✅ Login successful! Welcome " + userCredential.user.email);
    window.location.href = "dashboard.html"; // redirect after login
  } catch (error) {
    alert("❌ Error: " + error.message);
  }
});

// ====================== TOGGLE FORMS ======================
document.getElementById("showRegister").addEventListener("click", function(e) {
  e.preventDefault();
  loginForm.classList.add("hidden");
  registerForm.classList.remove("hidden");
});

document.getElementById("showLogin").addEventListener("click", function(e) {
  e.preventDefault();
  registerForm.classList.add("hidden");
  loginForm.classList.remove("hidden");
});
