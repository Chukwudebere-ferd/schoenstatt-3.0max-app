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
const IMGBB_KEY = "5ef7cd278c7926f46592ee2d4bcb78fa";

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
let selectedFiles = [];
let readyToPost = false;

/* ========== Hidden file input ========== */
const fileInput = document.createElement("input");
fileInput.type = "file";
fileInput.accept = "image/*";
fileInput.multiple = true;
fileInput.style.display = "none";
document.body.appendChild(fileInput);

/* ========== Preview box ========== */
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

/* ========== Helpers ========== */
function setAddButtonState(isReady) {
  readyToPost = !!isReady;
  if (readyToPost) {
    addPostBtn.innerHTML = `<i class="fas fa-paper-plane"></i>`;
    addPostBtn.title = "Post";
  } else {
    addPostBtn.innerHTML = `<i class="fas fa-plus"></i>`;
    addPostBtn.title = "Add images / Post";
  }
}

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

    thumbWrap.appendChild(img);
    thumbWrap.appendChild(removeBtn);
    previewBox.appendChild(thumbWrap);
  });
}

/* ========== Auth state ========== */
onAuthStateChanged(auth, (user) => {
  currentUser = user;
});

/* ========== File picker handlers ========== */
fileInput.addEventListener("change", (e) => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;
  selectedFiles = files.slice(0, 7);
  renderPreviews();
  setAddButtonState(true);
});

textInput.addEventListener("input", () => {
  const hasText = (textInput.value || "").trim().length > 0;
  setAddButtonState(hasText || selectedFiles.length > 0);
});

addPostBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  if (readyToPost) {
    await submitPost();
  } else {
    fileInput.click();
  }
});

/* ========== Submit post ========= */
async function submitPost() {
  if (!currentUser) {
    window.location.href = "index.html";
    return;
  }

  if (!currentUser.displayName) {
    const name = prompt("Enter a display name (this will show publicly):");
    if (!name || !name.trim()) {
      alert("A display name is required to post.");
      return;
    }
    try {
      await updateProfile(auth.currentUser, { displayName: name.trim() });
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

  addPostBtn.disabled = true;
  addPostBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
  addPostBtn.title = "Posting...";

  try {
    const uploadedUrls = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: "POST", body: fd });
      const json = await res.json();
      if (!json || !json.success) throw new Error("Image upload failed");
      uploadedUrls.push(json.data.url);
    }

    await addDoc(collection(db, "posts"), {
      uid: currentUser.uid,
      username: currentUser.displayName || "",
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
  } catch (err) {
    console.error("Post failed:", err);
    alert("Failed to publish post. Try again.");
  } finally {
    addPostBtn.disabled = false;
    setAddButtonState(false);
  }
}

/* ========== Real-time feed (renders instantly) ========= */
const postsQuery = query(collection(db, "posts"), orderBy("createdAt", "desc"));
onSnapshot(postsQuery, (snapshot) => {
  postsSection.innerHTML = "";
  snapshot.forEach((docSnap) => {
    const id = docSnap.id;
    const data = docSnap.data();
    // render synchronously (returns element) and patch user info later
    postsSection.appendChild(renderPostElement(id, data));
  });
});

/* ========== Helper: timeAgo ========= */
function timeAgo(ts) {
  if (!ts) return "Just now";
  const d = ts && ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return d.toLocaleString();
}

/* ========== Render post element (sync) ========= */
function renderPostElement(id, post) {
  const article = document.createElement("article");
  article.className = "post";
  article.id = `post-${id}`;
  article.style.padding = "12px";
  article.style.borderBottom = "1px solid #eee";

  // header
  const header = document.createElement("div");
  header.className = "post-header";
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.gap = "8px";

  const nameEl = document.createElement("strong");
  nameEl.className = "username";
  // show saved username first (if any), else placeholder
  nameEl.textContent = post.username ? post.username : "Loading...";

  const timeSpan = document.createElement("span");
  timeSpan.style.marginLeft = "8px";
  timeSpan.style.color = "#666";
  timeSpan.style.fontSize = "12px";
  timeSpan.textContent = timeAgo(post.createdAt);

  header.appendChild(nameEl);
  header.appendChild(timeSpan);

  // patch username + verified asynchronously (non-blocking)
  if (post.uid) {
    getDoc(doc(db, "users", post.uid))
      .then((userDoc) => {
        if (userDoc.exists()) {
          const u = userDoc.data();
          nameEl.textContent = u.username || post.username || "Unknown";
          if (u.verified) {
            const badge = document.createElement("i");
            badge.className = "fas fa-certificate";
            badge.title = "Verified";
            badge.style.color = "gold";
            badge.style.marginLeft = "6px";
            nameEl.appendChild(badge);
          }
        }
      })
      .catch((err) => {
        console.warn("Failed to patch user info:", err);
      });
  }

  // text
  const textP = document.createElement("p");
  textP.textContent = post.text || "";
  textP.style.marginTop = "8px";
  textP.style.whiteSpace = "pre-wrap";

  // images
  const imgs = post.images || [];
  const imagesWrap = document.createElement("div");
  imagesWrap.className = "post-images";
  imagesWrap.style.display = "grid";
  imagesWrap.style.gap = "6px";
  imagesWrap.style.marginTop = "8px";
  imagesWrap.style.gridTemplateColumns = imgs.length > 1 ? "1fr 1fr" : "1fr";

  imgs.forEach((src, i) => {
    const imgWrap = document.createElement("div");
    imgWrap.style.position = "relative";

    const imgEl = document.createElement("img");
    imgEl.src = src;
    imgEl.alt = `post image ${i + 1}`;
    imgEl.style.width = "100%";
    imgEl.style.display = "block";
    imgEl.style.borderRadius = "8px";
    imgEl.style.objectFit = "cover";
    imgEl.style.maxHeight = "360px";
    imgEl.style.cursor = "pointer";

    // show modal if modal exists, else open in new tab
    imgEl.addEventListener("click", () => {
      const modal = document.getElementById("imageModal");
      const modalImg = document.getElementById("modalImage");
      const downloadLink = document.getElementById("downloadImage");
      if (modal && modalImg) {
        modal.style.display = "block";
        modalImg.src = src;
        if (downloadLink) downloadLink.href = src;
      } else {
        window.open(src, "_blank");
      }
    });

    imgWrap.appendChild(imgEl);
    // if multiple images, show small counter on first
    if (i === 0 && imgs.length > 1) {
      const indicator = document.createElement("div");
      indicator.textContent = `1/${imgs.length}`;
      indicator.style.position = "absolute";
      indicator.style.right = "8px";
      indicator.style.bottom = "8px";
      indicator.style.background = "rgba(0,0,0,0.6)";
      indicator.style.color = "#fff";
      indicator.style.padding = "4px 8px";
      indicator.style.borderRadius = "10px";
      indicator.style.fontSize = "12px";
      imgWrap.appendChild(indicator);
    }
    imagesWrap.appendChild(imgWrap);
  });

  // actions
  const actions = document.createElement("div");
  actions.className = "post-actions";
  actions.style.display = "flex";
  actions.style.gap = "12px";
  actions.style.marginTop = "10px";
  actions.style.alignItems = "center";

  // Like button
  const likeBtn = document.createElement("button");
  likeBtn.className = "like-btn";
  likeBtn.style.cursor = "pointer";
  likeBtn.style.display = "flex";
  likeBtn.style.alignItems = "center";
  likeBtn.style.gap = "6px";
  const heart = document.createElement("i");
  const likedBy = post.likedBy || [];
  const currentlyLiked = auth.currentUser && likedBy.includes(auth.currentUser.uid);
  heart.className = currentlyLiked ? "fas fa-heart" : "far fa-heart";
  heart.style.color = currentlyLiked ? "red" : "#333";
  likeBtn.appendChild(heart);

  const likeCount = document.createElement("span");
  likeCount.textContent = `${likedBy.length || 0}`;
  likeBtn.appendChild(likeCount);

  likeBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (!auth.currentUser) return alert("Sign in to like posts.");
    const postRef = doc(db, "posts", id);
    try {
      if ((post.likedBy || []).includes(auth.currentUser.uid)) {
        await updateDoc(postRef, { likedBy: arrayRemove(auth.currentUser.uid) });
      } else {
        await updateDoc(postRef, { likedBy: arrayUnion(auth.currentUser.uid) });
      }
    } catch (err) {
      console.error("Like update failed:", err);
    }
  });

  // show likers
  likeCount.style.cursor = "pointer";
  likeCount.title = "View likers";
  likeCount.addEventListener("click", async (e) => {
    e.stopPropagation();
    const liked = post.likedBy || [];
    if (!liked.length) return alert("No likes yet.");
    try {
      const names = [];
      for (const uid of liked) {
        const ud = await getDoc(doc(db, "users", uid));
        if (ud.exists()) {
          const u = ud.data();
          names.push(`${u.username || "User"}${u.verified ? " ✅" : ""}`);
        } else {
          names.push("Unknown");
        }
      }
      alert("Liked by:\n" + names.join("\n"));
    } catch (err) {
      console.error("Failed to fetch likers:", err);
    }
  });

  // Comments (toggle area)
  const commentBtn = document.createElement("button");
  commentBtn.className = "comment-btn";
  commentBtn.style.cursor = "pointer";
  commentBtn.innerHTML = `<i class="far fa-comment"></i> ${(post.comments || []).length || 0}`;

  // Share
  const shareBtn = document.createElement("button");
  shareBtn.className = "share-btn";
  shareBtn.style.cursor = "pointer";
  shareBtn.innerHTML = `<i class="fas fa-share"></i>`;
  shareBtn.addEventListener("click", async () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}#post-${id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: post.username || "Post", text: post.text || "", url: shareUrl });
      } catch { /* user cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        alert("Post link copied to clipboard!");
      } catch {
        prompt("Copy the post link:", shareUrl);
      }
    }
  });

  actions.appendChild(likeBtn);
  actions.appendChild(commentBtn);
  actions.appendChild(shareBtn);

  // only show delete/edit if owner (note: might appear after auth state resolves)
  if (post.uid && auth.currentUser && post.uid === auth.currentUser.uid) {
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.innerHTML = `<i class="fas fa-trash"></i>`;
    deleteBtn.style.cursor = "pointer";
    deleteBtn.addEventListener("click", async () => {
      if (!confirm("Delete this post?")) return;
      try {
        await deleteDoc(doc(db, "posts", id));
      } catch (err) {
        console.error("Delete failed:", err);
        alert("Delete failed.");
      }
    });
    actions.appendChild(deleteBtn);

    const editBtn = document.createElement("button");
    editBtn.className = "edit-btn";
    editBtn.innerHTML = `<i class="fas fa-edit"></i>`;
    editBtn.style.cursor = "pointer";
    editBtn.addEventListener("click", async () => {
      const newText = prompt("Edit your post:", post.text || "");
      if (newText === null) return;
      try {
        await updateDoc(doc(db, "posts", id), { text: newText });
      } catch (err) {
        console.error("Edit failed:", err);
      }
    });
    actions.appendChild(editBtn);
  }

  // append header/text/images/actions
  article.appendChild(header);
  article.appendChild(textP);
  if (imgs.length) article.appendChild(imagesWrap);
  article.appendChild(actions);

  // comment area
  const commentArea = document.createElement("div");
  commentArea.style.display = "none";
  commentArea.style.marginTop = "8px";

  const commentList = document.createElement("div");
  // show current comments (simple)
  (post.comments || []).forEach((c) => {
    const cEl = document.createElement("p");
    cEl.style.fontSize = "14px";
    cEl.style.margin = "6px 0";
    const who = c.username || "Anonymous";
    cEl.innerHTML = `<strong>${who}${c.verified ? " <i class='fas fa-certificate' style='color:gold;'></i>" : ""}:</strong> ${c.text}`;
    commentList.appendChild(cEl);
  });

  const commentInputWrap = document.createElement("div");
  commentInputWrap.style.display = "flex";
  commentInputWrap.style.gap = "8px";
  commentInputWrap.style.marginTop = "8px";

  const commentInput = document.createElement("input");
  commentInput.type = "text";
  commentInput.placeholder = "Write a comment...";
  commentInput.style.flex = "1";

  const commentSend = document.createElement("button");
  commentSend.innerText = "Send";
  commentSend.addEventListener("click", async () => {
    const txt = (commentInput.value || "").trim();
    if (!txt) return;
    if (!auth.currentUser) { alert("Sign in to comment."); return; }
    try {
      await updateDoc(doc(db, "posts", id), {
        comments: arrayUnion({
          uid: auth.currentUser.uid,
          username: auth.currentUser.displayName || "Anonymous",
          text: txt,
          createdAt: serverTimestamp()
        })
      });
      commentInput.value = "";
    } catch (err) {
      console.error("Failed to add comment:", err);
    }
  });

  commentInputWrap.appendChild(commentInput);
  commentInputWrap.appendChild(commentSend);

  commentArea.appendChild(commentList);
  commentArea.appendChild(commentInputWrap);
  article.appendChild(commentArea);

  commentBtn.addEventListener("click", () => {
    commentArea.style.display = commentArea.style.display === "none" ? "block" : "none";
  });

  return article;
}

/* ========== Image modal safe handlers (if in DOM) ========= */
const closeModalBtn = document.getElementById("closeModal");
const imageModal = document.getElementById("imageModal");
if (closeModalBtn && imageModal) {
  closeModalBtn.addEventListener("click", () => {
    imageModal.style.display = "none";
  });
  // close modal when clicking outside modal image
  imageModal.addEventListener("click", (e) => {
    if (e.target === imageModal) imageModal.style.display = "none";
  });
}

/* ========== initial UI state ========== */
setAddButtonState(false);
renderPreviews();

/* ========== NAV/SPA logic (unchanged) ========== */
document.addEventListener("DOMContentLoaded", () => {
  const topTabs = document.querySelectorAll("nav.tabs button");
  const bottomTabs = document.querySelectorAll("nav.bottom-nav i");
  const sections = document.querySelectorAll("main section, .page");

  function showSection(id) {
    sections.forEach(sec => sec.classList.add("hidden"));
    const activeSec = document.getElementById(id);
    if (activeSec) activeSec.classList.remove("hidden");
  }

  topTabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      topTabs.forEach(btn => btn.classList.remove("active"));
      tab.classList.add("active");
      if (index === 0) showSection("posts");
      if (index === 1) showSection("events");
      if (index === 2) showSection("photos");
    });
  });

  bottomTabs.forEach((icon, index) => {
    icon.addEventListener("click", () => {
      bottomTabs.forEach(ic => ic.classList.remove("active"));
      icon.classList.add("active");
      if (index === 0) showSection("home");
      if (index === 1) showSection("videos");
      if (index === 2) showSection("notifications");
      if (index === 3) showSection("profile");
    });
  });

  showSection("posts");
});
