import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signInAnonymously,
  signOut,
} from "firebase/auth";

import { auth } from "@/lib/firebase";

const googleProvider = new GoogleAuthProvider();

async function sendSession(user: any, isGoogle = false) {
  const idToken = await user.user.getIdToken();

  await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken, isGoogle }),
  });
}

export async function login(email: string, password: string) {
  const user = await signInWithEmailAndPassword(auth, email, password);
  await sendSession(user);
  return user;
}

export async function loginWithGoogle() {
  const user = await signInWithPopup(auth, googleProvider);
  await sendSession(user, true);
  return user;
}

export async function loginAsGuest() {
  const user = await signInAnonymously(auth);
  await sendSession(user);
  return user;
}

export async function logout() {
  await signOut(auth);

  await fetch("/api/auth/logout", {
    method: "POST",
  });
}
