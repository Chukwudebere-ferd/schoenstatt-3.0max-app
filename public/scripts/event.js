// ./scripts/events.js
import { db, auth } from './firebaseConfig.js'; 
import { collection, getDocs, query, orderBy, doc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// DOM elements
const eventsContainer = document.getElementById("eventsContainer");
const createEventBtn = document.getElementById("createEventBtn");

// Admin check
async function checkAdmin() {
  if (!auth.currentUser) return;
  const docRef = doc(db, "users", auth.currentUser.uid);
  const userSnap = await getDoc(docRef);
  const userData = userSnap.data();
  if (userData?.role === "admin") {
    createEventBtn.classList.remove("hidden");
  }
}
checkAdmin();

// Event tabs
const tabBtns = document.querySelectorAll(".tab-btn");
tabBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    tabBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    loadEvents(btn.dataset.tab);
  });
});

// Load events
async function loadEvents(type = "upcoming") {
  eventsContainer.innerHTML = "Loading...";
  const eventsRef = collection(db, "events");
  const q = query(eventsRef, orderBy("date", "asc"));
  const snapshot = await getDocs(q);
  eventsContainer.innerHTML = "";

  snapshot.forEach(docSnap => {
    const event = docSnap.data();
    const eventDate = new Date(event.date.toDate());
    const now = new Date();
    if ((type === "upcoming" && eventDate >= now) || (type === "past" && eventDate < now)) {
      const card = document.createElement("div");
      card.className = "event-card";
      card.innerHTML = `
        <img src="${event.image || 'https://i.postimg.cc/3wrJzs72/File-Schoenstatt-logo-svg-Wikipedia.jpg'}" alt="${event.title}">
        <div class="event-info">
          <h3>${event.title}</h3>
          <p>${eventDate.toLocaleDateString()} at ${eventDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
          <button class="like-btn">Like (${event.likes?.length || 0})</button>
        </div>
      `;

      const likeBtn = card.querySelector(".like-btn");
      likeBtn.addEventListener("click", async () => {
        if (!auth.currentUser) return alert("Sign in to like events.");
        const eventRef = doc(db, "events", docSnap.id);
        const curLikes = event.likes || [];
        if (curLikes.includes(auth.currentUser.uid)) {
          await updateDoc(eventRef, { likes: arrayRemove(auth.currentUser.uid) });
        } else {
          await updateDoc(eventRef, { likes: arrayUnion(auth.currentUser.uid) });
        }
        loadEvents(type); // refresh likes
      });

      eventsContainer.appendChild(card);
    }
  });
}

// Initial load
loadEvents();

export { loadEvents, checkAdmin };
