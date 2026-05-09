import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getDatabase, ref, onValue, set, get, update, remove } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";

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

window.fbCreate = (key, id, data) => set(ref(db, `${key}/${id}`), data).catch(console.error);
window.fbUpdate = (key, id, data) => update(ref(db, `${key}/${id}`), data).catch(console.error);
window.fbDelete = (key, id) => remove(ref(db, `${key}/${id}`)).catch(console.error);

window.fbRestore = (key, array) => {
  const obj = {};
  array.forEach(item => {
    if (key === 'meal_enrollments') obj[`${item.projectId}_${item.userId}`] = item;
    else if (key === 'meal_records') obj[`${item.projectId}_${item.userId}_${item.date}`] = item;
    else obj[item.id] = item;
  });
  return set(ref(db, key), obj).catch(console.error);
};

// Disable UI while loading data
const loader = document.createElement('div');
loader.innerHTML = '<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:var(--bg-color);z-index:9999;display:flex;align-items:center;justify-content:center;color:var(--primary);font-size:1.5rem;font-weight:bold;"><i class="fas fa-spinner fa-spin" style="margin-right:10px;"></i> Syncing Data...</div>';
document.documentElement.appendChild(loader);

function normalizeArray(data) {
  if (typeof data === 'object' && data !== null) {
    if (!Array.isArray(data)) {
      data = Object.values(data);
    }
    return data.filter(item => item !== null && item !== undefined);
  }
  return Array.isArray(data) ? data.filter(item => item !== null && item !== undefined) : [];
}

Promise.all(SYNC_KEYS.map(key => get(ref(db, key)))).then(snapshots => {
  snapshots.forEach((snapshot, index) => {
    const key = SYNC_KEYS[index];
    if (snapshot.exists()) {
      const data = normalizeArray(snapshot.val());
      localStorage.setItem(key, JSON.stringify(data));
    } else {
      localStorage.setItem(key, '[]');
    }
  });

  // Real-time listeners
  SYNC_KEYS.forEach(key => {
    onValue(ref(db, key), (snapshot) => {
      let data = snapshot.exists() ? snapshot.val() : [];
      data = normalizeArray(data);
      const stringified = JSON.stringify(data);
      if (localStorage.getItem(key) !== stringified) {
        localStorage.setItem(key, stringified);
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
