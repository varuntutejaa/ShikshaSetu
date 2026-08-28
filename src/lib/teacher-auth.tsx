"use client";

/**
 * App-wide real teacher identity + auth gate. Every (app) page reads the
 * signed-in teacher from here instead of a hardcoded name. Unlike an
 * earlier version of this file, it does NOT silently start a demo session
 * when no one is signed in — the app is meant to require going through
 * /login first (see AuthGate below); "Continue as Demo" on that page is
 * still a real, one-click way in, it's just an explicit choice now instead
 * of an invisible bypass.
 *
 * Reads localStorage through useSyncExternalStore rather than
 * useState+useEffect — the standard React-safe way to read a browser-only
 * store: server/first-hydration render both see "no session" consistently
 * (no hydration mismatch), and the real value takes over immediately after
 * mount without an explicit setState-in-effect.
 */

import { createContext, useContext, useSyncExternalStore } from "react";
import type { Teacher, TeacherAuthResult } from "@/lib/api";

const TOKEN_KEY = "shikshasetu_teacher_token";
const TEACHER_KEY = "shikshasetu_teacher";

interface StoredSession {
  teacher: Teacher | null;
  token: string | null;
}

const EMPTY_SESSION: StoredSession = { teacher: null, token: null };

let listeners: Array<() => void> = [];

function notifyListeners() {
  for (const listener of listeners) listener();
}

function subscribe(callback: () => void): () => void {
  listeners = [...listeners, callback];
  return () => {
    listeners = listeners.filter((l) => l !== callback);
  };
}

// useSyncExternalStore requires getSnapshot to return the SAME object
// reference across calls when nothing actually changed — otherwise React
// sees "a new value" every render and loops forever. localStorage.getItem
// is cheap enough to call each time, but we only build a new session object
// (and cache it) when the raw underlying strings actually differ from last
// time; unrelated re-renders keep getting the identical cached reference.
let cachedRawToken: string | null = null;
let cachedRawTeacherJson: string | null = null;
let cachedSession: StoredSession = EMPTY_SESSION;

function readSession(): StoredSession {
  const token = localStorage.getItem(TOKEN_KEY);
  const teacherJson = localStorage.getItem(TEACHER_KEY);
  if (token === cachedRawToken && teacherJson === cachedRawTeacherJson) {
    return cachedSession;
  }
  cachedRawToken = token;
  cachedRawTeacherJson = teacherJson;
  if (!token || !teacherJson) {
    cachedSession = EMPTY_SESSION;
    return cachedSession;
  }
  try {
    cachedSession = { teacher: JSON.parse(teacherJson) as Teacher, token };
  } catch {
    cachedSession = EMPTY_SESSION;
  }
  return cachedSession;
}

function getServerSnapshot(): StoredSession {
  return EMPTY_SESSION;
}

export function persistTeacherAuth(auth: TeacherAuthResult) {
  localStorage.setItem(TOKEN_KEY, auth.token);
  localStorage.setItem(TEACHER_KEY, JSON.stringify(auth.teacher));
  notifyListeners();
}

export function clearTeacherAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TEACHER_KEY);
  notifyListeners();
}

/** Hydration-safe read of whatever session (if any) already exists on this
 * device — usable standalone, without TeacherAuthProvider, e.g. from the
 * login page to bounce an already-signed-in teacher straight past itself. */
export function useStoredTeacherSession(): StoredSession {
  return useSyncExternalStore(subscribe, readSession, getServerSnapshot);
}

interface TeacherAuthContextValue extends StoredSession {
  /** Called by the login page right after a successful login/signup/demo
   * call so every page reflects it immediately. */
  setSession: (auth: TeacherAuthResult) => void;
  clearSession: () => void;
}

const TeacherAuthContext = createContext<TeacherAuthContextValue>({
  ...EMPTY_SESSION,
  setSession: () => {},
  clearSession: () => {},
});

export function TeacherAuthProvider({ children }: { children: React.ReactNode }) {
  const session = useStoredTeacherSession();

  const value: TeacherAuthContextValue = {
    ...session,
    setSession: persistTeacherAuth,
    clearSession: clearTeacherAuth,
  };

  return <TeacherAuthContext.Provider value={value}>{children}</TeacherAuthContext.Provider>;
}

export function useTeacherAuth() {
  return useContext(TeacherAuthContext);
}
