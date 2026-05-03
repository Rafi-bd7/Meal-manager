import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getDatabase, ref, onValue, set, get } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAs007T9qwgk3N-OYo7GoashXFw5DcNCz8",
  authDomain: "meal-manager-a01c2.firebaseapp.com",
  projectId: "meal-manager-a01c2",
  storageBucket: "meal-manager-a01c2.firebasestorage.app",
  messagingSenderId: "515131579537",
  appId: "1:515131579537:web:082fe18d7ce96c3bb8f330",
  measurementId: "G-RXEGSWDYBB"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const SYNC_KEYS = ['meal_users', 'meal_projects', 'meal_enrollments', 'meal_records', 'meal_comments'];
let isSyncingFromFirebase = false;
const originalSetItem = localStorage.setItem;

localStorage.setItem = function(key, value) {
  originalSetItem.apply(this, arguments);
  if (!isSyncingFromFirebase && SYNC_KEYS.includes(key)) {
    try {
      set(ref(db, key), JSON.parse(value)).catch(console.error);
    } catch(e) { console.error("Firebase Sync Error:", e); }
  }
};

// Disable UI while loading data
const loader = document.createElement('div');
loader.innerHTML = '<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:var(--bg-color);z-index:9999;display:flex;align-items:center;justify-content:center;color:var(--primary);font-size:1.5rem;font-weight:bold;"><i class="fas fa-spinner fa-spin" style="margin-right:10px;"></i> Syncing Data...</div>';
document.documentElement.appendChild(loader);

Promise.all(SYNC_KEYS.map(key => get(ref(db, key)))).then(snapshots => {
  isSyncingFromFirebase = true;
  snapshots.forEach((snapshot, index) => {
    const key = SYNC_KEYS[index];
    if (snapshot.exists()) {
      originalSetItem.call(localStorage, key, JSON.stringify(snapshot.val()));
    } else {
      // If it doesn't exist in Firebase, it means the array is empty. 
      // Do NOT migrate stale local data back to Firebase. Just clear local.
      originalSetItem.call(localStorage, key, '[]');
    }
  });
  isSyncingFromFirebase = false;

  // Real-time listeners
  SYNC_KEYS.forEach(key => {
    onValue(ref(db, key), (snapshot) => {
      const data = snapshot.exists() ? snapshot.val() : [];
      const stringified = JSON.stringify(data);
      if (localStorage.getItem(key) !== stringified) {
        isSyncingFromFirebase = true;
        originalSetItem.call(localStorage, key, stringified);
        isSyncingFromFirebase = false;
        // Trigger storage event so admin.js / user.js UI re-renders automatically
        const e = new Event('storage');
        e.key = key;
        window.dispatchEvent(e);
      }
    });
  });

  loader.remove();
  window.firebaseDataLoaded = true;
  window.dispatchEvent(new Event('firebaseDataLoaded'));
}).catch(err => {
  console.error("Firebase Init Error:", err);
  loader.innerHTML = '<div style="color:red;">Error connecting to database. Please refresh.</div>';
});
