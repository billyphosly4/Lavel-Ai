import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { createUserProfile, getUserProfile } from "@/lib/firestore";

export async function POST(req: Request) {
  try {
    const { idToken, isGoogle } = await req.json();

    if (!idToken) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const decoded = await adminAuth.verifyIdToken(idToken);

    // ensure user profile exists
    let profile = await getUserProfile(decoded.uid);

    if (!profile) {
      await createUserProfile(decoded.uid, {
        email: decoded.email || null,
        provider: isGoogle ? "google" : "password",
      });

      profile = await getUserProfile(decoded.uid);
    }

    const expiresIn = 60 * 60 * 24 * 5 * 1000;

    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn,
    });

    const res = NextResponse.json({
      success: true,
      user: {
        uid: decoded.uid,
        email: decoded.email,
        role: profile?.role || "user",
      },
    });

    res.cookies.set("session", sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: expiresIn / 1000,
    });

    return res;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}