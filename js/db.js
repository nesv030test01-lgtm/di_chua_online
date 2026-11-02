// Đọc/ghi dữ liệu trên Firestore
//
//   users/{uid}               → hồ sơ công khai: name, photoURL, congDuc, các bộ đếm, lastSeen
//   users/{uid}/prayers/{id}  → lời cầu (riêng tư, chỉ chủ nhân đọc được)
//   stats/global              → tổng hương / công đức / mõ của cả chùa
//   events/{id}               → dòng hoạt động ("A dâng 1 nén hương +5 CĐ")
import {
  doc, getDoc, getDocs, setDoc, updateDoc, onSnapshot, writeBatch,
  collection, query, where, orderBy, limit,
  increment, serverTimestamp, Timestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase.js";

export const ACTIONS = {
  dangHuong: { field: "huong",   points: 5, icon: "🔥", label: "Dâng 1 nén hương" },
  cauPhuc:   { field: "cauPhuc", points: 5, icon: "🏮", label: "Cầu phúc" },
  hoaSen:    { field: "hoaSen",  points: 3, icon: "🪷", label: "Dâng hoa sen" },
  chuong:    { field: "chuong",  points: 1, icon: "🔔", label: "Thỉnh chuông" },
  goMo:      { field: "goMo",    points: 1, icon: "🪵", label: "Gõ mõ" },
  xinXam:    { field: "xinXam",  points: 0, icon: "🎋", label: "Xin xăm" },
};

const ONLINE_WINDOW_MS = 150_000; // coi là "đang viếng" nếu hoạt động trong 2,5 phút
const NAME_MAX = 24;

const users = collection(db, "users");
const userRef = (uid) => doc(db, "users", uid);
const statsRef = doc(db, "stats", "global");

let onError = (e) => console.warn(e);
export function setErrorHandler(fn) { onError = fn; }

export const cleanName = (s) => (s || "").replace(/\s+/g, " ").trim().slice(0, NAME_MAX);

function googleOf(user) {
  return user.providerData.find((p) => p.providerId === "google.com");
}

/** Tạo hồ sơ nếu chưa có; trả về dữ liệu hồ sơ. */
export async function ensureUserDoc(user) {
  const ref = userRef(user.uid);
  const snap = await getDoc(ref);
  const g = googleOf(user);
  const base = { photoURL: g?.photoURL || null, isGuest: user.isAnonymous, lastSeen: serverTimestamp() };

  if (!snap.exists()) {
    const name = g?.displayName ? cleanName(g.displayName) : null;
    const data = {
      ...base, name,
      congDuc: 0, huong: 0, cauPhuc: 0, hoaSen: 0, chuong: 0, goMo: 0, xinXam: 0,
      createdAt: serverTimestamp(),
    };
    await setDoc(ref, data);
    return { ...data, congDuc: 0 };
  }

  const data = snap.data();
  const patch = { ...base };
  if (!data.name && g?.displayName) patch.name = cleanName(g.displayName);
  await updateDoc(ref, patch);
  return { ...data, ...patch };
}

export function setName(uid, name) {
  return updateDoc(userRef(uid), { name: cleanName(name) });
}

export function heartbeat(uid) {
  return updateDoc(userRef(uid), { lastSeen: serverTimestamp() });
}

/** Thực hiện 1 hành động: cộng công đức cá nhân + tổng chùa + ghi dòng hoạt động (1 batch). */
export function act(uid, name, key, prayerText) {
  const a = ACTIONS[key];
  const b = writeBatch(db);
  b.update(userRef(uid), {
    congDuc: increment(a.points),
    [a.field]: increment(1),
    lastSeen: serverTimestamp(),
  });
  b.set(statsRef, { congDuc: increment(a.points), [a.field]: increment(1) }, { merge: true });
  b.set(doc(collection(db, "events")), {
    uid, name: cleanName(name) || "Thí chủ", action: key, points: a.points, createdAt: serverTimestamp(),
  });
  if (prayerText) {
    b.set(doc(collection(db, "users", uid, "prayers")), { text: prayerText, createdAt: serverTimestamp() });
  }
  return b.commit();
}

const withId = (d) => ({ uid: d.id, ...d.data({ serverTimestamps: "estimate" }) });

export function watchUser(uid, cb) {
  return onSnapshot(userRef(uid), (s) => cb(s.data({ serverTimestamps: "estimate" })), onError);
}

/** Người đang viếng: hoạt động trong 2,5 phút gần nhất. Tự đăng ký lại mỗi phút. */
export function watchOnline(cb) {
  let unsub = null;
  const sub = () => {
    unsub?.();
    const since = Timestamp.fromMillis(Date.now() - ONLINE_WINDOW_MS);
    const q = query(users, where("lastSeen", ">=", since), orderBy("lastSeen", "desc"), limit(20));
    unsub = onSnapshot(q, (s) => cb(s.docs.map(withId)), onError);
  };
  sub();
  const t = setInterval(sub, 60_000);
  return () => { clearInterval(t); unsub?.(); };
}

/** Bảng "Tấm lòng thành": top 5 công đức. */
export function watchTop(cb) {
  const q = query(users, orderBy("congDuc", "desc"), limit(5));
  return onSnapshot(q, (s) => cb(s.docs.map(withId)), onError);
}

export function watchStats(cb) {
  return onSnapshot(statsRef, (s) => cb(s.data() || {}), onError);
}

/** Gọi cb(evt) cho mỗi hoạt động MỚI (bỏ qua hoạt động cũ hơn 20 giây). */
export function watchEvents(cb) {
  const q = query(collection(db, "events"), orderBy("createdAt", "desc"), limit(5));
  return onSnapshot(q, (s) => {
    const fresh = s.docChanges()
      .filter((c) => c.type === "added")
      .map((c) => c.doc.data({ serverTimestamps: "estimate" }))
      .filter((e) => e.createdAt && Date.now() - e.createdAt.toMillis() < 20_000)
      .reverse();
    fresh.forEach(cb);
  }, onError);
}

export async function getMyPrayers(uid) {
  const q = query(collection(db, "users", uid, "prayers"), orderBy("createdAt", "desc"), limit(10));
  const s = await getDocs(q);
  return s.docs.map((d) => d.data());
}
