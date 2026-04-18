import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  serverTimestamp,
  doc,
  setDoc,
  addDoc,
  collection
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { firebaseConfig, hasFirebaseConfig } from "./firebaseConfig.js";

class FirebaseService {
  constructor() {
    this.enabled = false;
    this.db = null;
    this.userKey = null;
  }

  async init(email) {
    if (!hasFirebaseConfig()) {
      this.enabled = false;
      return false;
    }

    const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    this.db = getFirestore(app);
    this.userKey = this.makeUserKey(email);
    this.enabled = true;

    await setDoc(
      doc(this.db, "users", this.userKey),
      {
        email,
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    return true;
  }

  makeUserKey(email) {
    return btoa(unescape(encodeURIComponent(email))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  }

  async logEvent(type, meta = {}) {
    if (!this.enabled || !this.db || !this.userKey) return;
    await addDoc(collection(this.db, "users", this.userKey, "events"), {
      type,
      meta,
      createdAt: serverTimestamp()
    });
  }

  async saveJobStart(jobId, payload) {
    if (!this.enabled || !this.db || !this.userKey) return;
    await setDoc(
      doc(this.db, "users", this.userKey, "jobs", jobId),
      {
        jobId,
        status: "submitted",
        input: payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  }

  async saveJobResult(jobId, result) {
    if (!this.enabled || !this.db || !this.userKey) return;
    await setDoc(
      doc(this.db, "users", this.userKey, "jobs", jobId),
      {
        status: "done",
        output: result,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  }
}

export const firebaseService = new FirebaseService();
