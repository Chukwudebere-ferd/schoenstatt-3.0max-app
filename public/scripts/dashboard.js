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
let currentUserProfile = null; // { username, verified } from users/{uid}
let selectedFiles = [];
let readyToPost = false;

/* ========== Inject minimal styles we need (non-invasive) ========== */
(function ensureGlobalStyles(){
  if (document.getElementById("dash-injected-styles")) return;
  const s = document.createElement("style");
  s.id = "dash-injected-styles";
  s.textContent = `
    .verified-badge {
      display:inline-flex; align-items:center; justify-content:center;
      width:16px; height:16px; margin-left:6px;
      vertical-align:middle;
    }
    .likers-overlay {
      position: fixed; inset: 0; z-index: 9999;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.5);
    }
    .likers-card {
      background: #fff; border-radius: 12px; padding: 12px 0 8px;
      width: min(92vw, 420px); max-height: 70vh; overflow: hidden; position: relative;
      box-shadow: 0 12px 40px rgba(0,0,0,0.25);
    }
    .likers-header {
      font-weight: 600; padding: 10px 16px 8px; border-bottom: 1px solid #eee;
    }
    .likers-list {
      list-style: none; margin: 0; padding: 8px 0; max-height: 56vh; overflow: auto;
    }
    .likers-item {
      padding: 8px 16px; display:flex; align-items:center; gap:8px;
      border-bottom: 1px solid #f5f5f5;
    }
    .likers-close {
      position: absolute; top: 8px; right: 8px; border: none; background: transparent;
      font-size: 18px; cursor: pointer; line-height: 1; padding: 6px; border-radius: 8px;
    }
    .likers-close:hover { background:#f2f2f2; }
    .post .post-actions button {
      background: transparent; border: none; cursor: pointer;
    }
    .inline-edit-wrap { margin-top: 8px; display: flex; gap: 8px; }
    .inline-edit-wrap textarea { width: 100%; min-height: 80px; resize: vertical; }
    .chip {
      display:inline-flex; align-items:center; gap:6px; padding: 6px 10px; margin: 6px 8px 0 0;
      border-radius: 999px; background:#f5f5f5; font-size: 14px;
    }
  `;
  document.head.appendChild(s);
})();

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

function blueCheckSVG() {
  // 16x16 blue circle + white check (Twitter-like)
  const span = document.createElement("span");
  span.className = "verified-badge";
  span.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="10" fill="#fdd835"></circle>
      <path d="M6.5 10.5l2.5 2.5 5-5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
  span.title = "Verified";
  return span;
}

async function fetchUserProfile(uid) {
  try {
    const ud = await getDoc(doc(db, "users", uid));
    if (!ud.exists()) return null;
    const u = ud.data();
    return {
      username: u.username || u.name || null,
      verified: !!u.verified
    };
  } catch {
    return null;
  }
}

function resolveDisplayNameForPost(userProfile, firebaseUser) {
  if (userProfile?.username) return userProfile.username;
  if (firebaseUser?.displayName) return firebaseUser.displayName;
  if (firebaseUser?.email) return firebaseUser.email.split("@")[0];
  return "User";
}

function showLikersOverlay(items) {
  // items: Array<{username: string, verified: boolean}>
  const overlay = document.createElement("div");
  overlay.className = "likers-overlay";

  const card = document.createElement("div");
  card.className = "likers-card";

  const header = document.createElement("div");
  header.className = "likers-header";
  header.textContent = "Liked by";

  const closeBtn = document.createElement("button");
  closeBtn.className = "likers-close";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.innerHTML = "✕";
  closeBtn.addEventListener("click", () => overlay.remove());

  const list = document.createElement("ul");
  list.className = "likers-list";

  if (!items.length) {
    const li = document.createElement("li");
    li.className = "likers-item";
    li.textContent = "No likes yet";
    list.appendChild(li);
  } else {
    items.forEach(({ username, verified }) => {
      const li = document.createElement("li");
      li.className = "likers-item";
      const chip = document.createElement("span");
      chip.className = "chip";
      const strong = document.createElement("strong");
      strong.textContent = username || "User";
      chip.appendChild(strong);
      if (verified) chip.appendChild(blueCheckSVG());
      li.appendChild(chip);
      list.appendChild(li);
    });
  }

  card.appendChild(header);
  card.appendChild(closeBtn);
  card.appendChild(list);
  overlay.appendChild(card);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
}

/* ========== Auth state ========== */
onAuthStateChanged(auth, async (user) => {
  currentUser = user || null;
  currentUserProfile = null;
  if (currentUser) {
    currentUserProfile = await fetchUserProfile(currentUser.uid);
  }
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

    const usernameForPost = resolveDisplayNameForPost(currentUserProfile, currentUser);

    await addDoc(collection(db, "posts"), {
      uid: currentUser.uid,
      username: usernameForPost, // for immediate display; we still patch live from users/{uid}
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

  // ================= HEADER =================
  const header = document.createElement("div");
  header.className = "post-header";

  const left = document.createElement("div");
  const nameEl = document.createElement("strong");
  nameEl.className = "username";
  nameEl.textContent = post.username || "Loading...";
  const verifiedHolder = document.createElement("span");
  verifiedHolder.className = "verified-holder";
  const timeSpan = document.createElement("span");
  timeSpan.className = "post-time";
  timeSpan.textContent = timeAgo(post.createdAt);

  left.appendChild(nameEl);
  left.appendChild(verifiedHolder);
  left.appendChild(timeSpan);

  const right = document.createElement("div");
  // owner-only actions
  const isOwner = auth.currentUser && post.uid === auth.currentUser.uid;
  if (isOwner) {
    const editBtn = document.createElement("button");
    editBtn.className = "edit-btn";
    editBtn.innerHTML = `<i class="fas fa-edit"></i>`;
    const delBtn = document.createElement("button");
    delBtn.className = "delete-btn";
    delBtn.innerHTML = `<i class="fas fa-trash"></i>`;
    right.appendChild(editBtn);
    right.appendChild(delBtn);

    // inline edit
    editBtn.addEventListener("click", () => {
      if (article.querySelector(".inline-edit-wrap")) return;
      const contentEl = article.querySelector("p.post-text");
      const wrap = document.createElement("div");
      wrap.className = "inline-edit-wrap";
      const ta = document.createElement("textarea");
      ta.value = contentEl ? contentEl.textContent : (post.text || "");
      const save = document.createElement("button");
      save.textContent = "Save";
      const cancel = document.createElement("button");
      cancel.textContent = "Cancel";
      wrap.appendChild(ta);
      wrap.appendChild(save);
      wrap.appendChild(cancel);
      contentEl.style.display = "none";
      article.insertBefore(wrap, contentEl.nextSibling);

      save.addEventListener("click", async () => {
        const newText = ta.value.trim();
        try {
          await updateDoc(doc(db, "posts", id), { text: newText });
        } catch (err) {
          console.error("Edit failed:", err);
          alert("Failed to save changes.");
        } finally {
          contentEl.textContent = newText;
          contentEl.style.display = "";
          wrap.remove();
        }
      });

      cancel.addEventListener("click", () => {
        contentEl.style.display = "";
        wrap.remove();
      });
    });

    delBtn.addEventListener("click", async () => {
      if (!confirm("Delete this post?")) return;
      try {
        await deleteDoc(doc(db, "posts", id));
      } catch (err) {
        console.error("Delete failed:", err);
        alert("Delete failed.");
      }
    });
  }

  header.appendChild(left);
  header.appendChild(right);

  // ================= TEXT =================
  const textP = document.createElement("p");
  textP.className = "post-text";
  textP.textContent = post.text || "";

  // ================= IMAGES =================
  const imgs = post.images || [];
  const imagesWrap = document.createElement("div");
  imagesWrap.className = "post-images";
  if (imgs.length) {
    imagesWrap.style.display = "grid";
    imagesWrap.style.gap = "6px";
    imagesWrap.style.marginTop = "8px";
    imagesWrap.style.gridTemplateColumns = imgs.length > 1 ? "1fr 1fr" : "1fr";
  }
  imgs.forEach((src, i) => {
    const imgEl = document.createElement("img");
    imgEl.src = src;
    imgEl.alt = `post image ${i + 1}`;
    imgEl.className = "post-img";
    imgEl.addEventListener("click", () => {
      const modal = document.getElementById("imageModal");
      const modalImg = document.getElementById("modalImage");
      const downloadLink = document.getElementById("downloadImage");
      if (modal && modalImg) {
        modal.style.display = "block";
        modalImg.src = src;
        if (downloadLink) downloadLink.href = src;
      }
    });
    imagesWrap.appendChild(imgEl);
  });

  // ================= ACTIONS =================
  const actions = document.createElement("div");
  actions.className = "post-actions";

  // like button
  const likeBtn = document.createElement("button");
  likeBtn.className = "like-btn";
  const heart = document.createElement("i");
  const likedByArr = post.likedBy || [];
  const userHasLiked = auth.currentUser && likedByArr.includes(auth.currentUser.uid);
  heart.className = userHasLiked ? "fas fa-heart" : "far fa-heart";
  heart.style.color = userHasLiked ? "red" : "#333";
  const likeCount = document.createElement("span");
  likeCount.textContent = `${likedByArr.length || 0}`;
  likeBtn.appendChild(heart);
  likeBtn.appendChild(likeCount);

  // ✅ click to like/unlike
  likeBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (!auth.currentUser) return alert("Sign in to like posts.");
    const postRef = doc(db, "posts", id);
    try {
      const fresh = await getDoc(postRef);
      const cur = fresh.exists() ? (fresh.data().likedBy || []) : [];
      if (cur.includes(auth.currentUser.uid)) {
        await updateDoc(postRef, { likedBy: arrayRemove(auth.currentUser.uid) });
      } else {
        await updateDoc(postRef, { likedBy: arrayUnion(auth.currentUser.uid) });
      }
    } catch (err) {
      console.error("Like update failed:", err);
    }
  });

  // ✅ click on like count → show modal with users
  likeCount.style.cursor = "pointer";
  likeCount.addEventListener("click", async () => {
    const postRef = doc(db, "posts", id);
    const fresh = await getDoc(postRef);
    const cur = fresh.exists() ? (fresh.data().likedBy || []) : [];
    if (!cur.length) return alert("No likes yet.");
    const overlay = document.createElement("div");
    overlay.className = "likes-overlay";
    const box = document.createElement("div");
    box.className = "likes-box";
    const close = document.createElement("span");
    close.className = "close-btn";
    close.textContent = "×";
    box.appendChild(close);
    cur.forEach(async (uid) => {
      const u = await fetchUserProfile(uid);
      const row = document.createElement("div");
      row.className = "like-user";
      row.textContent = u?.username || "User";
      if (u?.verified) row.appendChild(blueCheckSVG());
      box.appendChild(row);
    });
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    close.addEventListener("click", () => overlay.remove());
  });

  // comment button
  const commentBtn = document.createElement("button");
  commentBtn.className = "comment-btn";
  commentBtn.innerHTML = `<i class="far fa-comment"></i> ${(post.commentsCount || 0)}`;

  // share button
  const shareBtn = document.createElement("button");
  shareBtn.className = "share-btn";
  shareBtn.innerHTML = `<i class="fas fa-share"></i>`;

  actions.appendChild(likeBtn);
  actions.appendChild(commentBtn);
  actions.appendChild(shareBtn);

  // ================= COMMENTS ==================
  const commentsSection = document.createElement("div");
  commentsSection.className = "comments";
  commentsSection.style.display = "none";

  const commentsList = document.createElement("div");
  commentsList.className = "comments-list";
  commentsSection.appendChild(commentsList);

  const commentForm = document.createElement("form");
  commentForm.className = "comment-form";
  commentForm.innerHTML = `
    <input type="text" class="comment-input" placeholder="Write a comment..." />
    <button type="submit" class="comment-submit">Post</button>
  `;
  commentsSection.appendChild(commentForm);

  commentBtn.addEventListener("click", () => {
    commentsSection.style.display =
      commentsSection.style.display === "none" ? "block" : "none";
  });

  // add comment
  commentForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const commentInput = commentForm.querySelector("input");
    const text = commentInput.value.trim();
    if (!text) return;
    if (!auth.currentUser) return alert("You must be logged in to comment.");
    try {
      const profile = await fetchUserProfile(auth.currentUser.uid);
      await addDoc(collection(db, "posts", id, "comments"), {
        uid: auth.currentUser.uid,
        displayName: profile?.username || auth.currentUser.displayName || "Anonymous",
        verified: !!profile?.verified,
        text,
        createdAt: serverTimestamp(),
      });
      commentInput.value = "";
    } catch (err) {
      console.error("Failed to add comment:", err);
      alert("Failed to add comment.");
    }
  });

  // live comments
  const commentsRef = collection(db, "posts", id, "comments");
  const commentsQuery = query(commentsRef, orderBy("createdAt", "asc"));
  onSnapshot(commentsQuery, (snapshot) => {
    commentsList.innerHTML = "";
    let count = 0;
    snapshot.forEach((c) => {
      const comment = c.data();
      const div = document.createElement("div");
      div.className = "comment";
      const header = document.createElement("div");
      header.className = "comment-header";
      const name = document.createElement("strong");
      name.textContent = comment.displayName || "Anonymous";
      header.appendChild(name);
      if (comment.verified) header.appendChild(blueCheckSVG());
      div.appendChild(header);
      const text = document.createElement("span");
      text.className = "comment-text";
      text.textContent = comment.text;
      div.appendChild(text);

      // delete own comment
      if (auth.currentUser && comment.uid === auth.currentUser.uid) {
        const delBtn = document.createElement("button");
        delBtn.className = "delete-comment-btn";
        delBtn.innerHTML = `<i class="fas fa-trash"></i>`;
        delBtn.addEventListener("click", async () => {
          if (!confirm("Delete this comment?")) return;
          try {
            await deleteDoc(doc(db, "posts", id, "comments", c.id));
          } catch (err) {
            console.error("Failed to delete comment:", err);
            alert("Failed to delete comment.");
          }
        });
        div.appendChild(delBtn);
      }
      commentsList.appendChild(div);
      count++;
    });
    commentBtn.innerHTML = `<i class="far fa-comment"></i> ${count}`;
  });

  // append in order
  article.appendChild(header);
  article.appendChild(textP);
  if (imgs.length) article.appendChild(imagesWrap);
  article.appendChild(actions);
  article.appendChild(commentsSection);

  // patch username
  if (post.uid) {
    fetchUserProfile(post.uid).then((u) => {
      if (!u) return;
      nameEl.textContent = u.username || post.username || "User";
      verifiedHolder.innerHTML = "";
      if (u.verified) verifiedHolder.appendChild(blueCheckSVG());
    });
  }

  return article;
}



/* ========== Image modal safe handlers (if in DOM) ========= */
const closeModalBtn = document.getElementById("closeModal");
const imageModal = document.getElementById("imageModal");
if (closeModalBtn && imageModal) {
  closeModalBtn.addEventListener("click", () => {
    imageModal.style.display = "none";
  });
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
      if (index === 0) window.location.href = "dashboard.html";
      if (index === 1) showSection("videos");
      if (index === 2) showSection("notifications");
      if (index === 3) showSection("profile");
    });
  });

  showSection("posts");
});
