"use client";

/**
 * App-wide real teacher identity. Replaces the old hardcoded
 * TEACHER_NAME/SCHOOL_NAME constants everywhere (header, sidebar,
 * dashboard, settings) with whichever teacher is actually signed in on
 * this device.
 *
 * If no session exists yet on this device, we start a real demo session
 * (the same `demoTeacherLogin` the /login page's "Continue as Demo" button
 * uses) rather than showing placeholder text — it's a genuine, persisted
 * backend teacher row and JWT-like session, not fabricated data. Anyone who
 * wants a named, persistent account can still sign up from /login.
 */

import { createContext, useContext, useEffect, useState } from "react";
import { demoTeacherLogin, type Teacher, type TeacherAuthResult } from "@/lib/api";

const TOKEN_KEY = "shikshasetu_teacher_token";
const TEACHER_KEY = "shikshasetu_teacher";

interface TeacherAuthState {
  teacher: Teacher | null;
  token: string | null;
  loading: boolean;
}

const TeacherAuthContext = createContext<TeacherAuthState>({
  teacher: null,
  token: null,
  loading: true,
});

function persistTeacherAuth(auth: TeacherAuthResult) {
  localStorage.setItem(TOKEN_KEY, auth.token);
  localStorage.setItem(TEACHER_KEY, JSON.stringify(auth.teacher));
}

export function TeacherAuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TeacherAuthState>({
    teacher: null,
    token: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedTeacher = localStorage.getItem(TEACHER_KEY);
      if (storedToken && storedTeacher) {
        try {
          const teacher = JSON.parse(storedTeacher) as Teacher;
          if (!cancelled) setState({ teacher, token: storedToken, loading: false });
          return;
        } catch {
          // Corrupt local cache — fall through and start a fresh session.
        }
      }

      try {
        const auth = await demoTeacherLogin();
        persistTeacherAuth(auth);
        if (!cancelled) setState({ teacher: auth.teacher, token: auth.token, loading: false });
      } catch {
        if (!cancelled) setState({ teacher: null, token: null, loading: false });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return <TeacherAuthContext.Provider value={state}>{children}</TeacherAuthContext.Provider>;
}

export function useTeacherAuth() {
  return useContext(TeacherAuthContext);
}
