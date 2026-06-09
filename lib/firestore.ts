import { getFirestore } from "firebase-admin/firestore";
import { firebaseAdminApp } from "@/lib/firebaseAdmin";

const db = getFirestore(firebaseAdminApp);

export async function createUserProfile(uid: string, data: any) {
  await db.collection("users").doc(uid).set(
    {
      uid,
      role: "user",
      createdAt: new Date().toISOString(),
      ...data,
    },
    { merge: true }
  );
}

export async function getUserProfile(uid: string) {
  const doc = await db.collection("users").doc(uid).get();
  return doc.exists ? doc.data() : null;
}