"use client";

import { useCallback, useEffect, useState } from "react";

export interface StoredUser {
  name: string;
}

const STORAGE_KEY = "av_user";

function readUser(): StoredUser | null {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

export function useSession() {
  const [user, setUser] = useState<StoredUser | null>(null);

  useEffect(() => {
    // localStorage is only available client-side, so the real value is read post-mount
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUser(readUser());
  }, []);

  const signIn = useCallback((u: StoredUser) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    setUser(u);
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  return { user, signIn, signOut };
}
