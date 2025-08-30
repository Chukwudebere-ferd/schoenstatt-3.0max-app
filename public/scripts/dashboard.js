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
  getDocs,
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
var currentUser = null;
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

  // make preview box visible and responsive
  previewBox.style.display = "flex";
  previewBox.style.flexWrap = "wrap";
  previewBox.style.gap = "8px";
  previewBox.style.width = "100%";
  previewBox.style.marginTop = "8px";
  previewBox.style.clear = "both"; // ensures it stays below input

  selectedFiles.forEach((file, idx) => {
    const thumbWrap = document.createElement("div");
    thumbWrap.style.position = "relative";
    thumbWrap.style.flexGrow = "1";
    thumbWrap.style.flexShrink = "1";

    // responsive flex-basis based on screen width
    const screenWidth = window.innerWidth;
    if (screenWidth < 480) {
      thumbWrap.style.flexBasis = "100%"; // 1 per row on mobile
    } else if (screenWidth < 768) {
      thumbWrap.style.flexBasis = "48%"; // 2 per row on tablets
    } else {
      thumbWrap.style.flexBasis = "31%"; // 3 per row on desktop
    }

    thumbWrap.style.maxWidth = "120px";
    thumbWrap.style.minWidth = "60px";

    const img = document.createElement("img");
    img.style.width = "100%";
    img.style.height = "auto";
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
  left.style.display = "flex";
  left.style.alignItems = "center";
  left.style.gap = "6px";

  // --- PROFILE IMAGE ---
  const profileImg = document.createElement("img");
  profileImg.src = "https://i.postimg.cc/3wrJzs72/File-Schoenstatt-logo-svg-Wikipedia.jpg"; // default
  profileImg.alt = "Profile Image";
  profileImg.style.width = "32px";
  profileImg.style.height = "32px";
  profileImg.style.borderRadius = "50%";
  profileImg.style.objectFit = "cover";

  // username + verified wrapper
  const nameWrap = document.createElement("div");
  nameWrap.style.display = "flex";
  nameWrap.style.alignItems = "center";
  nameWrap.style.gap = "4px";

  const nameEl = document.createElement("strong");
  nameEl.className = "username";
  nameEl.textContent = post.username || "Loading...";

  const verifiedHolder = document.createElement("span");
  verifiedHolder.className = "verified-holder";

  nameWrap.appendChild(nameEl);
  nameWrap.appendChild(verifiedHolder);

  // append profile image before username
  left.appendChild(profileImg);
  left.appendChild(nameWrap);

  const timeSpan = document.createElement("span");
  timeSpan.className = "post-time";
  timeSpan.style.marginLeft = "8px";
  timeSpan.style.fontSize = "12px";
  timeSpan.style.color = "#666";
  timeSpan.textContent = timeAgo(post.createdAt);

  left.appendChild(timeSpan);

  const right = document.createElement("div");
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
  imgs.forEach((src) => {
    const imgEl = document.createElement("img");
    imgEl.src = src;
    imgEl.alt = `post image`;
    imgEl.className = "post-img";
    imgEl.style.width = "100%";
    imgEl.style.borderRadius = "8px";
    imgEl.style.objectFit = "cover";
    imgEl.style.cursor = "pointer";
    imgEl.addEventListener("click", () => {
      const modal = document.getElementById("imageModal");
      const modalImg = document.getElementById("modalImage");
      const downloadLink = document.getElementById("downloadImage");
      if (modal && modalImg) {
        modal.style.display = "flex";
        modalImg.src = src;
        if (downloadLink) downloadLink.href = src;
      }
    });
    imagesWrap.appendChild(imgEl);
  });

  // ================= ACTIONS =================
  const actions = document.createElement("div");
  actions.className = "post-actions";

  const likeBtn = document.createElement("button");
  likeBtn.className = "like-btn";
  likeBtn.style.display = "flex";
  likeBtn.style.alignItems = "center";
  likeBtn.style.gap = "4px";

  const heart = document.createElement("i");
  const likedByArr = post.likedBy || [];
  const userHasLiked = auth.currentUser && likedByArr.includes(auth.currentUser.uid);
  heart.className = userHasLiked ? "fas fa-heart" : "far fa-heart";
  heart.style.color = userHasLiked ? "red" : "#333";
  heart.style.fontSize = "18px";

  const likeCount = document.createElement("span");
  likeCount.textContent = likedByArr.length || 0;
  likeCount.style.fontWeight = "bold";
  likeCount.style.cursor = "pointer";

  likeBtn.appendChild(heart);
  likeBtn.appendChild(likeCount);

  heart.addEventListener("click", async (e) => {
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

  // --- Likes modal with profile images ---
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

    for (const uid of cur) {
      const u = await fetchUserProfile(uid);
      const row = document.createElement("div");
      row.className = "like-user";
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "6px";

      const likerImg = document.createElement("img");
      likerImg.src = "https://i.postimg.cc/3wrJzs72/File-Schoenstatt-logo-svg-Wikipedia.jpg";
      likerImg.alt = "User Image";
      likerImg.style.width = "24px";
      likerImg.style.height = "24px";
      likerImg.style.borderRadius = "50%";
      likerImg.style.objectFit = "cover";
      if (u?.profileImage) likerImg.src = u.profileImage;

      const usernameSpan = document.createElement("span");
      usernameSpan.textContent = u?.username || "User";

      row.appendChild(likerImg);
      row.appendChild(usernameSpan);
      if (u?.verified) row.appendChild(blueCheckSVG());
      box.appendChild(row);
    }

    overlay.appendChild(box);
    document.body.appendChild(overlay);
    close.addEventListener("click", () => overlay.remove());
  });

  const commentBtn = document.createElement("button");
  commentBtn.className = "comment-btn";
  commentBtn.innerHTML = `<i class="far fa-comment"></i> ${(post.commentsCount || 0)}`;

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

  // --- live comments with profile images ---
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
      header.style.display = "flex";
      header.style.alignItems = "center";
      header.style.gap = "6px";

      const commenterImg = document.createElement("img");
      commenterImg.src = "https://i.postimg.cc/3wrJzs72/File-Schoenstatt-logo-svg-Wikipedia.jpg";
      commenterImg.alt = "Commenter Image";
      commenterImg.style.width = "24px";
      commenterImg.style.height = "24px";
      commenterImg.style.borderRadius = "50%";
      commenterImg.style.objectFit = "cover";

      fetchUserProfile(comment.uid).then((u) => {
        if (u?.profileImage) commenterImg.src = u.profileImage;
      });

      const name = document.createElement("strong");
      name.textContent = comment.displayName || "Anonymous";

      header.appendChild(commenterImg);
      header.appendChild(name);
      if (comment.verified) header.appendChild(blueCheckSVG());
      div.appendChild(header);

      const text = document.createElement("span");
      text.className = "comment-text";
      text.textContent = comment.text;
      div.appendChild(text);

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

  // patch username & profile image after fetch
  if (post.uid) {
    fetchUserProfile(post.uid).then((u) => {
      if (!u) return;
      nameEl.textContent = u.username || post.username || "User";
      verifiedHolder.innerHTML = "";
      if (u.verified) verifiedHolder.appendChild(blueCheckSVG());
      if (u.profileImage) profileImg.src = u.profileImage;
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
const searchIcon = document.querySelector(".search-icon");
const searchInput = document.querySelector(".search-input");

searchIcon.addEventListener("click", () => {
  searchInput.classList.toggle("active");
  if (searchInput.classList.contains("active")) {
    searchInput.focus();
  } else {
    searchInput.value = "";
    filterPosts(""); // reset search
  }
});

searchInput.addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase();
  filterPosts(query);
});

// Filter posts by username or post text
function filterPosts(query) {
  const posts = document.querySelectorAll(".post");
  posts.forEach((post) => {
    const username = post.querySelector(".username")?.textContent.toLowerCase() || "";
    const postText = post.querySelector(".post-text")?.textContent.toLowerCase() || "";
    
    if (username.includes(query) || postText.includes(query)) {
      post.style.display = "";
    } else {
      post.style.display = "none";
    }
  });
}


// events 

/* ========== MAIN TABS ========= */
const mainTabs = document.querySelectorAll("nav.tabs > button");
const sections = {
  Posts: document.getElementById("posts"),
  Events: document.getElementById("events"),
  Photos: document.getElementById("photos")
};

// Show the selected main tab, hide others
mainTabs.forEach(tab => {
  tab.addEventListener("click", () => {
    mainTabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");

    Object.values(sections).forEach(sec => sec.classList.add("hidden"));
    const sectionName = tab.textContent.trim();
    if (sections[sectionName]) sections[sectionName].classList.remove("hidden");
  });
});

/* ========== EVENTS / ANNOUNCEMENTS ========== */
/* ========== EVENTS / ANNOUNCEMENTS ========== */
const eventsContainer = document.getElementById("eventsContainer");
const createEventContainer = document.getElementById("createEventContainer"); 
const createEventBtn = createEventContainer?.querySelector(".submit-event");
let isAdmin = false;

/* === Check role after auth === */
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const profile = await fetchUserProfile(user.uid);
    isAdmin = profile?.role === "admin";
    if (createEventContainer) {
      createEventContainer.style.display = isAdmin ? "block" : "none";
    }
  } else {
    isAdmin = false;
    if (createEventContainer) createEventContainer.style.display = "none";
  }
});

/* === Submit Event (admin only) === */
if (createEventBtn) {
  createEventBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    if (!isAdmin) return alert("Only admins can create events.");
    const titleInput = createEventContainer.querySelector("input[name='title']");
    const descInput = createEventContainer.querySelector("textarea[name='description']");
    const title = titleInput.value.trim();
    const desc = descInput.value.trim();
    if (!title) return alert("Event needs a title.");
    try {
      await addDoc(collection(db, "events"), {
        title,
        description: desc,
        createdAt: serverTimestamp(),
        uid: auth.currentUser.uid
      });
      titleInput.value = "";
      descInput.value = "";
    } catch (err) {
      console.error("Event creation failed:", err);
    }
  });
}

/* === Render Events in real-time === */
const eventsQuery = query(collection(db, "events"), orderBy("createdAt", "desc"));
onSnapshot(eventsQuery, (snapshot) => {
  eventsContainer.innerHTML = "";
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const id = docSnap.id;
    eventsContainer.appendChild(renderEventElement(id, data));
  });
});

/* === Render single Event === */
function renderEventElement(id, event) {
  const div = document.createElement("div");
  div.className = "event";
  div.innerHTML = `
    <h3>${event.title}</h3>
    <p>${event.description || ""}</p>
    <small>${timeAgo(event.createdAt)}</small>
  `;

  if (isAdmin && event.uid === auth.currentUser?.uid) {
    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", async () => {
      if (!confirm("Delete this event?")) return;
      try {
        await deleteDoc(doc(db, "events", id));
      } catch (err) {
        console.error("Delete event failed:", err);
      }
    });
    div.appendChild(delBtn);
  }

  return div;
}

setInterval(() => {
  loadEvents(currentEventTab);
}, 60000);




// ==================== PHOTO ALBUMS (robust) ====================
async function renderPhotoAlbums() {
  const photoFolders = document.getElementById("photoFolders");
  const folderModal = document.getElementById("photoFolderModal");
  const closeFolderModal = document.getElementById("closeFolderModal");
  const folderTitle = document.getElementById("folderModalTitle");
  const folderImages = document.getElementById("folderImages");

  // existing image viewer modal in your HTML
  const imageModalEl = document.getElementById("imageModal");
  const modalImage = document.getElementById("modalImage");
  const downloadLink = document.getElementById("downloadImage");

  if (!photoFolders) {
    console.error("renderPhotoAlbums: #photoFolders not found");
    return;
  }

  photoFolders.innerHTML = "<p>Loading photos...</p>";
  if (folderImages) folderImages.innerHTML = "";

  // helper: normalize various timestamp shapes -> JS Date
  function toDate(val) {
    if (!val) return null;
    if (typeof val === "object" && typeof val.toDate === "function") return val.toDate(); // Firestore Timestamp
    if (typeof val === "number") return new Date(val < 1e12 ? val * 1000 : val); // seconds -> ms
    if (typeof val === "string") {
      const parsed = Date.parse(val);
      if (!isNaN(parsed)) return new Date(parsed);
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }

  try {
    // Query posts (uses createdAt)
    const postsRef = collection(db, "posts");
    let q;
    try {
      q = query(postsRef, orderBy("createdAt", "desc"));
    } catch (err) {
      console.warn("renderPhotoAlbums: orderBy(createdAt) failed, falling back to un-ordered getDocs()", err);
      q = postsRef;
    }
    const snapshot = await getDocs(q);
    console.log("renderPhotoAlbums: posts snapshot.size =", snapshot.size);

    // collect image items: { url, caption, dateObj }
    const imagesList = [];

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      console.log("renderPhotoAlbums: post doc:", docSnap.id, data);

      // prefer images array (your posts use `images`), fallback to single-image fields
      let urls = [];
      if (Array.isArray(data.images)) {
        urls = data.images.filter(u => typeof u === "string" && u.trim());
      } else {
        const candidates = [
          data.url, data.imageUrl, data.photoURL, data.downloadURL, data.image, data.fileUrl
        ];
        candidates.forEach(c => { if (typeof c === "string" && c.trim()) urls.push(c); });
      }

      if (!urls.length) return; // nothing to add from this post

      // get post time (createdAt is typical)
      const dateObj = toDate(data.createdAt || data.timestamp || data.time || data.date) || new Date();

      // push all images from this post
      urls.forEach(u => {
        imagesList.push({
          url: u,
          caption: (data.text || data.caption || "").toString(),
          dateObj,
          postId: docSnap.id
        });
      });
    });

    if (!imagesList.length) {
      photoFolders.innerHTML = "<p>No photos uploaded yet.</p>";
      return;
    }

    // group by date string (daily albums)
    const albums = {};
    imagesList.forEach(img => {
      const key = img.dateObj ? img.dateObj.toDateString() : "Unknown date";
      if (!albums[key]) albums[key] = [];
      albums[key].push(img);
    });

    // sort album keys by date desc (Unknown date last)
    const albumKeys = Object.keys(albums).sort((a, b) => {
      if (a === "Unknown date") return 1;
      if (b === "Unknown date") return -1;
      return new Date(b).getTime() - new Date(a).getTime();
    });

    // render folders
    photoFolders.innerHTML = "";
    albumKeys.forEach(dateKey => {
      const imgs = albums[dateKey];

      // sort images in the album newest -> oldest
      imgs.sort((x, y) => (y.dateObj?.getTime() || 0) - (x.dateObj?.getTime() || 0));

      const folderDiv = document.createElement("div");
      folderDiv.className = "photo-folder";
      folderDiv.innerHTML = `
        <img src="${imgs[0].url}" alt="cover" class="folder-cover">
        <div class="folder-info">
          <h3>${dateKey}</h3>
          <p>${imgs.length} photo(s)</p>
        </div>
      `;

      // open album modal
      folderDiv.addEventListener("click", () => {
        folderTitle.textContent = `Photos from ${dateKey}`;
        folderImages.innerHTML = "";

        imgs.forEach(i => {
          const wrap = document.createElement("div");
          wrap.className = "folder-image";
          wrap.innerHTML = `
            <img src="${i.url}" alt="photo">
            <p>${i.caption || "No caption"}</p>
          `;
          // clicking an image in album opens the main image modal (reuse existing imageModal)
          const imgEl = wrap.querySelector("img");
          imgEl.style.cursor = "pointer";
          imgEl.addEventListener("click", (ev) => {
            ev.stopPropagation(); // prevent closing album or other side effects
            if (imageModalEl && modalImage) {
              imageModalEl.style.display = "flex";
              modalImage.src = i.url;
              if (downloadLink) downloadLink.href = i.url;
            }
          });

          folderImages.appendChild(wrap);
        });

        folderModal.classList.remove("hidden");
      });

      photoFolders.appendChild(folderDiv);
    });

    // close album modal (use onclick to avoid multiple listeners)
    if (closeFolderModal) closeFolderModal.onclick = () => folderModal.classList.add("hidden");

    // small UX: clicking outside imageModal closes it (you already had this handler earlier; keep or override)
    if (imageModalEl) {
      imageModalEl.onclick = (e) => { if (e.target === imageModalEl) imageModalEl.style.display = "none"; };
    }

    console.log("renderPhotoAlbums: rendered", albumKeys.length, "albums with", imagesList.length, "total images");

  } catch (err) {
    console.error("renderPhotoAlbums: unexpected error", err);
    photoFolders.innerHTML = "<p>Error loading photos.</p>";
  }
}





// When Photos tab is clicked
document.querySelector("button:nth-child(3)").addEventListener("click", () => {
  renderPhotoAlbums();
});


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
