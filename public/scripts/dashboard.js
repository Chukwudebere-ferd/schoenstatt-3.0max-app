// ./scripts/dashboard.js
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
  updateProfile
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
const IMGBB_KEY = "5ef7cd278c7926f46592ee2d4bcb78fa"; // your imgbb key

/* ========== INIT ========== */
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/* ========== DOM ========== */
const createPostContainer = document.querySelector(".create-post");
if (!createPostContainer) throw new Error("Missing .create-post element in DOM");
const textInput = createPostContainer.querySelector("input[type='text']");
const addPostBtn = createPostContainer.querySelector(".add-post");
const postsSection = document.getElementById("posts");
if (!postsSection) throw new Error("Missing #posts element in DOM");

/* ========== STATE ========== */
let currentUser = null;
let selectedFiles = []; // File objects (local)
let readyToPost = false;

/* ========== Hidden file input (used for picking images) ========== */
const fileInput = document.createElement("input");
fileInput.type = "file";
fileInput.accept = "image/*";
fileInput.multiple = true;
fileInput.style.display = "none";
document.body.appendChild(fileInput);

/* ========== UI: create preview area inside .create-post ========== */
let previewBox = createPostContainer.querySelector(".image-preview-box");
if (!previewBox) {
  previewBox = document.createElement("div");
  previewBox.className = "image-preview-box";
  previewBox.style.display = "flex";
  previewBox.style.gap = "8px";
  previewBox.style.marginTop = "8px";
  previewBox.style.flexWrap = "wrap";
  createPostContainer.appendChild(previewBox);
}

/* Helper: update add-post button UI */
function setAddButtonState(isReady) {
  readyToPost = !!isReady;
  if (readyToPost) {
    addPostBtn.innerHTML = `<i class="fas fa-paper-plane"></i>`; // Post icon
    addPostBtn.title = "Post";
  } else {
    addPostBtn.innerHTML = `<i class="fas fa-plus"></i>`; // Add image icon
    addPostBtn.title = "Add images / Post";
  }
}

/* Helper: render thumbnails for selectedFiles (File objects) */
function renderPreviews() {
  previewBox.innerHTML = "";
  if (!selectedFiles.length) {
    previewBox.style.display = "none";
    return;
  }
  previewBox.style.display = "flex";

  selectedFiles.forEach((file, idx) => {
    const thumbWrap = document.createElement("div");
    thumbWrap.style.position = "relative";

    const img = document.createElement("img");
    img.style.width = "84px";
    img.style.height = "84px";
    img.style.objectFit = "cover";
    img.style.borderRadius = "8px";
    img.alt = file.name;

    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; };
    reader.readAsDataURL(file);

    // Remove button (small x)
    const removeBtn = document.createElement("button");
    removeBtn.innerText = "×";
    removeBtn.style.position = "absolute";
    removeBtn.style.top = "4px";
    removeBtn.style.right = "4px";
    removeBtn.style.background = "rgba(0,0,0,0.6)";
    removeBtn.style.color = "#fff";
    removeBtn.style.border = "none";
    removeBtn.style.borderRadius = "50%";
    removeBtn.style.width = "22px";
    removeBtn.style.height = "22px";
    removeBtn.style.cursor = "pointer";
    removeBtn.title = "Remove image";
    removeBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      selectedFiles.splice(idx, 1);
      renderPreviews();
      setAddButtonState(selectedFiles.length > 0 || (textInput.value || "").trim().length > 0);
    });

    // If this is the first image, show indicator "1/N"
    if (idx === 0 && selectedFiles.length > 1) {
      const indicator = document.createElement("div");
      indicator.innerText = `1/${selectedFiles.length}`;
      indicator.style.position = "absolute";
      indicator.style.bottom = "6px";
      indicator.style.right = "6px";
      indicator.style.background = "rgba(0,0,0,0.6)";
      indicator.style.color = "#fff";
      indicator.style.padding = "2px 6px";
      indicator.style.borderRadius = "10px";
      indicator.style.fontSize = "12px";
      thumbWrap.appendChild(indicator);
    }

    thumbWrap.appendChild(img);
    thumbWrap.appendChild(removeBtn);
    previewBox.appendChild(thumbWrap);
  });
}

/* ========== Auth state ========== */
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (!user) {
    window.location.href = "index.html";
    return;
  }
});

/* ========== File picker handling ========== */
fileInput.addEventListener("change", (e) => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;

  // limit to 7 files, preserve the order user picked
  const allowed = files.slice(0, 7);
  selectedFiles = allowed;
  renderPreviews();
  setAddButtonState(true);
});

/* ========== text input change -> toggle button */ 
textInput.addEventListener("input", () => {
  const hasText = (textInput.value || "").trim().length > 0;
  setAddButtonState(hasText || selectedFiles.length > 0);
});

/* ========== add-post button behavior ==========
   - If readyToPost => submit post
   - else => open file picker
*/
addPostBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  // If we already have text or files, treat as "Post"
  if (readyToPost) {
    await submitPost();
  } else {
    // open file picker
    fileInput.click();
  }
});

/* ========== Submit post ========= */
async function submitPost() {
  if (!currentUser) {
    window.location.href = "index.html"; // not signed in, go back to login
    return;
  }

  // must have displayName (do NOT use email). If not, prompt to set it.
  if (!currentUser.displayName) {
    const name = prompt("Enter a display name (this will show publicly):");
    if (!name || !name.trim()) {
      alert("A display name is required to post.");
      return;
    }
    try {
      await updateProfile(auth.currentUser, { displayName: name.trim() });
      // refresh currentUser
      currentUser = auth.currentUser;
    } catch (err) {
      console.error("Failed to update display name:", err);
      alert("Failed to save display name. Try again.");
      return;
    }
  }

  const text = (textInput.value || "").trim();
  if (!text && selectedFiles.length === 0) {
    alert("Post must contain text or at least one image.");
    return;
  }

  // disable UI while posting
  addPostBtn.disabled = true;
  addPostBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
  addPostBtn.title = "Posting...";

  const uploadedUrls = [];
  try {
    // upload images sequentially (safer for rate limits)
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      // using imgbb: accept file in FormData
      const fd = new FormData();
      fd.append("image", file);
      // you could include name or other fields if needed
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: "POST", body: fd });
      const json = await res.json();
      if (!json || !json.success) {
        console.warn("imgbb upload failed for file:", file.name, json);
        throw new Error("Image upload failed");
      }
      uploadedUrls.push(json.data.url);
    }

    // Save post to Firestore
    const docRef = await addDoc(collection(db, "posts"), {
      uid: currentUser.uid,
      username: currentUser.displayName,
      text: text || "",
      images: uploadedUrls,
      likedBy: [],
      comments: [],
      createdAt: serverTimestamp()
    });

    // reset UI
    textInput.value = "";
    selectedFiles = [];
    fileInput.value = "";
    renderPreviews();
    setAddButtonState(false);

    // optional: scroll to top to show the new post when it appears
    // window.scrollTo({ top: 0, behavior: "smooth" });

  } catch (err) {
    console.error("Post failed:", err);
    alert("Failed to publish post. Try again.");
  } finally {
    addPostBtn.disabled = false;
    setAddButtonState(false);
  }
}

/* ========== Real-time feed rendering (onSnapshot) ========= */
const postsQuery = query(collection(db, "posts"), orderBy("createdAt", "desc"));
onSnapshot(postsQuery, (snapshot) => {
  postsSection.innerHTML = ""; // re-render full feed simply
  snapshot.forEach((docSnap) => {
    const id = docSnap.id;
    const data = docSnap.data();
    postsSection.appendChild(renderPostElement(id, data));
  });
});

/* ========== Helper: readable time ========= */
function timeAgo(ts) {
  if (!ts) return "Just now";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return d.toLocaleString();
}

async function renderPostElement(id, post) {
  const article = document.createElement("article");
  article.className = "post";
  article.id = `post-${id}`;

  // header
  const header = document.createElement("div");
  header.className = "post-header";

  // fetch user info (username + verified)
  let username = post.username || "Unknown";
  let verified = false;
  if (post.uid) {
    try {
      const userDoc = await getDoc(doc(db, "users", post.uid));
      if (userDoc.exists()) {
        const u = userDoc.data();
        username = u.username || username;
        verified = !!u.verified;
      }
    } catch (err) {
      console.warn("Failed to fetch user info:", err);
    }
  }

  const name = document.createElement("strong");
  name.textContent = username;

  if (verified) {
    const badge = document.createElement("i");
    badge.className = "fas fa-certificate";
    badge.style.color = "gold";
    badge.style.marginLeft = "4px";
    name.appendChild(badge);
  }

  const timeSpan = document.createElement("span");
  timeSpan.style.marginLeft = "8px";
  timeSpan.style.color = "#666";
  timeSpan.style.fontSize = "12px";
  timeSpan.textContent = timeAgo(post.createdAt);

  header.appendChild(name);
  header.appendChild(timeSpan);

  // delete button (only if owner)
  if (auth.currentUser && post.uid === auth.currentUser.uid) {
    const delBtn = document.createElement("button");
    delBtn.innerHTML = `<i class="fas fa-trash"></i>`;
    delBtn.style.marginLeft = "auto";
    delBtn.style.cursor = "pointer";
    delBtn.addEventListener("click", async () => {
      if (confirm("Delete this post?")) {
        try {
          await deleteDoc(doc(db, "posts", id));
          article.remove();
        } catch (err) {
          console.error("Delete failed", err);
        }
      }
    });
    header.appendChild(delBtn);
  }

  // text
  const textP = document.createElement("p");
  textP.textContent = post.text || "";

  // images
  const imagesWrap = document.createElement("div");
  imagesWrap.className = "post-images";
  (post.images || []).forEach((src, i) => {
    const imgEl = document.createElement("img");
    imgEl.src = src;
    imgEl.alt = `post image ${i + 1}`;
    imgEl.style.width = "100%";
    imgEl.style.borderRadius = "8px";
    imgEl.style.cursor = "pointer";

    imgEl.addEventListener("click", () => {
      document.getElementById("imageModal").style.display = "block";
      document.getElementById("modalImage").src = src;
      document.getElementById("downloadImage").href = src;
    });

    imagesWrap.appendChild(imgEl);
  });

  // actions
  const actions = document.createElement("div");
  actions.className = "post-actions";

  // Like button
  const likeBtn = document.createElement("button");
  likeBtn.style.display = "flex";
  likeBtn.style.alignItems = "center";
  likeBtn.style.gap = "4px";

  const heart = document.createElement("i");
  const likedBy = post.likedBy || [];
  const isLiked = auth.currentUser && likedBy.includes(auth.currentUser.uid);
  heart.className = isLiked ? "fas fa-heart" : "far fa-heart";
  heart.style.color = isLiked ? "red" : "#333";

  const likeCount = document.createElement("span");
  likeCount.textContent = likedBy.length;

  likeBtn.appendChild(heart);
  likeBtn.appendChild(likeCount);

  likeBtn.addEventListener("click", async () => {
    if (!auth.currentUser) return alert("Sign in to like posts.");
    const postRef = doc(db, "posts", id);
    if (isLiked) {
      await updateDoc(postRef, { likedBy: arrayRemove(auth.currentUser.uid) });
    } else {
      await updateDoc(postRef, { likedBy: arrayUnion(auth.currentUser.uid) });
    }
  });

  // show likers
  likeCount.style.cursor = "pointer";
  likeCount.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (!likedBy.length) return alert("No likes yet.");
    let usersList = [];
    for (const uid of likedBy) {
      const userDoc = await getDoc(doc(db, "users", uid));
      if (userDoc.exists()) {
        const u = userDoc.data();
        usersList.push(`${u.username}${u.verified ? " ✅" : ""}`);
      }
    }
    alert("Liked by:\n" + usersList.join("\n"));
  });

  // Comments
  const commentBtn = document.createElement("button");
  commentBtn.innerHTML = `<i class="far fa-comment"></i> ${(post.comments || []).length}`;

  const commentArea = document.createElement("div");
  commentArea.style.display = "none";
  commentArea.style.marginTop = "8px";

  const commentList = document.createElement("div");
  (post.comments || []).forEach(c => {
    const cEl = document.createElement("p");
    cEl.style.fontSize = "14px";
    cEl.innerHTML = `<strong>${c.username}${c.verified ? " <i class='fas fa-certificate' style='color:gold;'></i>" : ""}:</strong> ${c.text}`;
    commentList.appendChild(cEl);
  });

  const commentInput = document.createElement("input");
  commentInput.type = "text";
  commentInput.placeholder = "Write a comment...";

  const sendBtn = document.createElement("button");
  sendBtn.textContent = "Send";
  sendBtn.addEventListener("click", async () => {
    const txt = commentInput.value.trim();
    if (!txt) return;
    if (!auth.currentUser) return alert("Sign in to comment.");

    const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
    const verified = userDoc.exists() ? !!userDoc.data().verified : false;

    await updateDoc(doc(db, "posts", id), {
      comments: arrayUnion({
        uid: auth.currentUser.uid,
        username: auth.currentUser.displayName || "Anonymous",
        verified,
        text: txt,
        createdAt: serverTimestamp()
      })
    });
    commentInput.value = "";
  });

  commentArea.appendChild(commentList);
  commentArea.appendChild(commentInput);
  commentArea.appendChild(sendBtn);

  commentBtn.addEventListener("click", () => {
    commentArea.style.display = commentArea.style.display === "none" ? "block" : "none";
  });

  actions.appendChild(likeBtn);
  actions.appendChild(commentBtn);

  // assemble
  article.appendChild(header);
  article.appendChild(textP);
  article.appendChild(imagesWrap);
  article.appendChild(actions);
  article.appendChild(commentArea);

  return article;
}

// close modal handler
document.getElementById("closeModal").addEventListener("click", () => {
  document.getElementById("imageModal").style.display = "none";
});


/* ========== initial button state ========== */
setAddButtonState(false);
renderPreviews();


// nav

document.addEventListener("DOMContentLoaded", () => {
  // Selectors
  const topTabs = document.querySelectorAll("nav.tabs button");
  const bottomTabs = document.querySelectorAll("nav.bottom-nav i");
  const sections = document.querySelectorAll("main section, .page"); // all SPA sections

  // Function to show section
  function showSection(id) {
    sections.forEach(sec => sec.classList.add("hidden"));
    const activeSec = document.getElementById(id);
    if (activeSec) activeSec.classList.remove("hidden");
  }

  // Top nav toggle
  topTabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      // reset active state
      topTabs.forEach(btn => btn.classList.remove("active"));
      tab.classList.add("active");

      // Decide which section to show
      if (index === 0) showSection("posts");
      if (index === 1) showSection("events");
      if (index === 2) showSection("photos");
    });
  });

  // Bottom nav toggle
  bottomTabs.forEach((icon, index) => {
    icon.addEventListener("click", () => {
      // reset active state
      bottomTabs.forEach(ic => ic.classList.remove("active"));
      icon.classList.add("active");

      // Decide which section to show
      if (index === 0) showSection("posts");
      if (index === 1) showSection("videos");
      if (index === 2) showSection("notifications");
      if (index === 3) showSection("profile");
    });
  });

  // Default page
  showSection("posts");
});
