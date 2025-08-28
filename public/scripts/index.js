// ================== IMPORTS ==================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { 
  getFirestore, 
  setDoc, 
  doc 
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

// ================== FIREBASE CONFIG ==================
const firebaseConfig = {
  apiKey: "AIzaSyD4QdOuBegYmRfyofIb3NXJMyFPVrHUuxI",
  authDomain: "fir-test-e4fda.firebaseapp.com",
  databaseURL: "https://fir-test-e4fda-default-rtdb.firebaseio.com",
  projectId: "fir-test-e4fda",
  storageBucket: "fir-test-e4fda.firebasestorage.app",
  messagingSenderId: "1089856463518",
  appId: "1:1089856463518:web:9cc53d056cb69ab673518f"
};

// Init
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ================== DOM ==================
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const showRegister = document.getElementById("showRegister");
const showLogin = document.getElementById("showLogin");
const msgBox = document.getElementById("msgBox");

// ================== TOGGLE ==================
showRegister.addEventListener("click", (e) => {
  e.preventDefault();
  loginForm.classList.add("hidden");
  registerForm.classList.remove("hidden");
});

showLogin.addEventListener("click", (e) => {
  e.preventDefault();
  registerForm.classList.add("hidden");
  loginForm.classList.remove("hidden");
});

// ================== REGISTER ==================
registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const fullName = registerForm.querySelector("input[type='text']").value;
  const email = registerForm.querySelector("input[type='email']").value;
  const password = registerForm.querySelector("input[type='password']").value;

  try {
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCred.user;

    // Save extra info in Firestore
    await setDoc(doc(db, "users", user.uid), {
      name: fullName,
      email: email,
      createdAt: new Date()
    });

    msgBox.innerHTML = `<p style="color:green">✅ Registration successful! Please login.</p>`;

    window.location.href = "dashboard.html";

  } catch (err) {
    msgBox.innerHTML = `<p style="color:red">❌ ${err.message}</p>`;
  }
});

// ================== LOGIN ==================
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = loginForm.querySelector("input[type='email']").value;
  const password = loginForm.querySelector("input[type='password']").value;

  try {
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    msgBox.innerHTML = `<p style="color:green">✅ Welcome back, ${userCred.user.email}</p>`;
    window.location.href = "dashboard.html";
  } catch (err) {
    msgBox.innerHTML = `<p style="color:red">❌ ${err.message}</p>`;
  }
});
