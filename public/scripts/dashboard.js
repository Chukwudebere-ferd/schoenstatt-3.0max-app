import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, orderBy, query } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

/* ========== FIREBASE CONFIG ========== */
const firebaseConfig = {
  apiKey: "AIzaSyDdn8ZIsSmpaXx8F9MIK6KwTTMVGCZPcd8",
  authDomain: "schoenstatt3max.firebaseapp.com",
  projectId: "schoenstatt3max",
  storageBucket: "schoenstatt3max.firebasestorage.app",
  messagingSenderId: "709706612184",
  appId: "1:709706612184:web:67d7ef78727be152bd86ad"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ========== ELEMENTS ========== */
const uploadBtn = document.getElementById("uploadBtn");
const postText = document.getElementById("postText");
const postImages = document.getElementById("postImages");
const feed = document.getElementById("feed");
const errorMsg = document.getElementById("errorMsg");

/* ========== IMGUR UPLOAD ========== */
async function uploadToImgur(file) {
  let formData = new FormData();
  formData.append("image", file);

  const res = await fetch("https://api.imgbb.com/1/upload?key=5ef7cd278c7926f46592ee2d4bcb78fa", {
    method: "POST",
    body: formData
  });
  const data = await res.json();
  return data.data.url;
}

/* ========== CREATE POST ========== */
uploadBtn.addEventListener("click", async () => {
  errorMsg.textContent = "";

  const text = postText.value.trim();
  const files = postImages.files;

  if (!text && files.length === 0) {
    errorMsg.textContent = "Please enter text or upload at least one image.";
    return;
  }

  try {
    let imageUrls = [];
    for (let file of files) {
      const url = await uploadToImgur(file);
      imageUrls.push(url);
    }

    await addDoc(collection(db, "posts"), {
      text,
      images: imageUrls,
      createdAt: new Date()
    });

    postText.value = "";
    postImages.value = "";
    loadPosts();
  } catch (err) {
    errorMsg.textContent = "Error creating post.";
    console.error(err);
  }
});

/* ========== LOAD POSTS ========== */
async function loadPosts() {
  feed.innerHTML = "";
  const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);

  snapshot.forEach(doc => {
    const data = doc.data();

    let postDiv = document.createElement("div");
    postDiv.classList.add("post");

    let imagesHtml = "";
    let dotsHtml = "";
    if (data.images && data.images.length > 0) {
      data.images.forEach((url, idx) => {
        imagesHtml += `<img src="${url}" alt="post image"/>`;
        dotsHtml += `<span class="dot ${idx === 0 ? "active" : ""}"></span>`;
      });
    }

    postDiv.innerHTML = `
      <div class="post-header">Schoenstatt User</div>
      <div class="post-images">${imagesHtml}</div>
      <div class="dots">${dotsHtml}</div>
      <div class="post-footer">
        <i class="fa-regular fa-heart"></i>
        <i class="fa-regular fa-comment"></i>
        <i class="fa-regular fa-bookmark"></i>
      </div>
      <p style="padding:10px;">${data.text || ""}</p>
    `;

    feed.appendChild(postDiv);
  });
}

loadPosts();


// Smooth Tab Navigation
const tabButtons = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");
const messageBox = document.getElementById("messageBox");

tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    // Reset active states
    tabButtons.forEach(b => b.classList.remove("active"));
    tabContents.forEach(c => c.classList.remove("active"));

    // Set active
    btn.classList.add("active");
    const tabId = btn.getAttribute("data-tab");
    document.getElementById(tabId).classList.add("active");
  });
});

// Display messages inside UI instead of alerts
function showMessage(type, text) {
  messageBox.innerHTML = `<div class="msg ${type}">${text}</div>`;
  setTimeout(() => { messageBox.innerHTML = ""; }, 3000);
}

// Example usage
// showMessage("error", "Something went wrong");
// showMessage("success", "Welcome back!");
