// Đọc/ghi dữ liệu người chơi trên Firestore
//   users/{uid}                 → hồ sơ + chỉ số
//   users/{uid}/prayers/{id}    → các lời nguyện
import {
  doc, getDoc, setDoc, updateDoc, onSnapshot,
  collection, addDoc, query, orderBy, limit,
  increment, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase.js";

const userRef = (uid) => doc(db, "users", uid);

function profileFrom(user) {
  const google = user.providerData.find((p) => p.providerId === "google.com");
  return {
    displayName: google?.displayName || user.displayName || "Khách thập phương",
    photoURL: google?.photoURL || user.photoURL || null,
    isGuest: user.isAnonymous,
  };
}

/** Tạo hồ sơ nếu chưa có, cập nhật lastVisit nếu đã có. */
export async function ensureUserDoc(user) {
  const ref = userRef(user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      ...profileFrom(user),
      congDuc: 0,
      soLanThapHuong: 0,
      soLanGoChuong: 0,
      createdAt: serverTimestamp(),
      lastVisit: serverTimestamp(),
    });
  } else {
    await updateDoc(ref, { ...profileFrom(user), lastVisit: serverTimestamp() });
  }
}

export function watchUser(uid, cb) {
  return onSnapshot(userRef(uid), (s) => cb(s.data()));
}

export function thapHuong(uid) {
  return updateDoc(userRef(uid), { congDuc: increment(3), soLanThapHuong: increment(1) });
}

export function goChuong(uid) {
  return updateDoc(userRef(uid), { congDuc: increment(1), soLanGoChuong: increment(1) });
}

export async function guiLoiNguyen(uid, text) {
  await addDoc(collection(db, "users", uid, "prayers"), { text, createdAt: serverTimestamp() });
  await updateDoc(userRef(uid), { congDuc: increment(5) });
}

export function watchPrayers(uid, cb) {
  const q = query(collection(db, "users", uid, "prayers"), orderBy("createdAt", "desc"), limit(10));
  return onSnapshot(q, (s) => cb(s.docs.map((d) => d.data())));
}
