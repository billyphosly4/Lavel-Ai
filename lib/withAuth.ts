import { adminAuth } from "@/lib/firebaseAdmin";
import { NextResponse } from "next/server";

export async function withAuth(req: Request, handler: Function) {
  try {
    const cookie = req.headers.get("cookie") || "";
    const session = cookie
      .split(";")
      .find(c => c.trim().startsWith("session="))
      ?.split("=")[1];

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await adminAuth.verifySessionCookie(session, true);

    return handler(decoded);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}