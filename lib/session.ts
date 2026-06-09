import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebaseAdmin";
import { getUserProfile } from "@/lib/firestore";

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value;
  if (!session) return null;

  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);

    const profile = await getUserProfile(decoded.uid);

    return {
      ...decoded,
      role: profile?.role || "user",
    };
  } catch {
    return null;
  }
}