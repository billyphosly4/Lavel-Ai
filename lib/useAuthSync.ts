"use client";

import { useEffect } from "react";
import { auth } from "@/lib/firebase";

export function useAuthSync() {
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) return;

      const idToken = await user.getIdToken();

      await fetch("/api/auth/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ idToken }),
      });
    });

    return () => unsubscribe();
  }, []);
}