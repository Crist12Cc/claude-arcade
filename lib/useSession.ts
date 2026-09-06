"use client";

import { useCallback, useEffect, useState } from "react";

export interface StoredUser {
  name: string;
}

const STORAGE_KEY = "av_user";
const CHANGE_EVENT = "av-user-change";

function readUser(): StoredUser | null {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

export function useSession() {
  const [user, setUser] = useState<StoredUser | null>(() => readUser());

  useEffect(() => {
    const sync = () => setUser(readUser());
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) sync();
    };

    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const signIn = useCallback((u: StoredUser | null) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    setUser(u);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { user, signIn, signOut };
}
