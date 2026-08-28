"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  BookOpenCheck,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LogIn,
  Mail,
  Mic,
  Phone,
  School,
  Sparkles,
  User,
  UserPlus,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ApiError,
  demoTeacherLogin,
  loginTeacher,
  signupTeacher,
  type TeacherAuthResult,
} from "@/lib/api";
import { persistTeacherAuth, useStoredTeacherSession } from "@/lib/teacher-auth";

type Mode = "login" | "signup";

const FEATURES = [
  { icon: Mic, label: "Live voice translation, Hindi ↔ mother tongue" },
  { icon: Video, label: "Real classroom video, side by side with audio" },
  { icon: Sparkles, label: "AI lesson plans, quizzes and viva, generated for you" },
];

export default function TeacherLoginPage() {
  const router = useRouter();
  // Outside the (app) layout, so no TeacherAuthProvider wraps this page —
  // read/write the stored session directly instead of through context.
  const { teacher: alreadySignedIn } = useStoredTeacherSession();

  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in on this device? Skip straight past the login screen
  // instead of asking again. useStoredTeacherSession is hydration-safe (see
  // teacher-auth.tsx), so this resolves to the real value before this
  // effect even runs — no visible flash of the login form first.
  useEffect(() => {
    if (alreadySignedIn) router.replace("/dashboard");
  }, [alreadySignedIn, router]);

  function isValidEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value === "demo";
  }

  async function completeAuth(action: () => Promise<TeacherAuthResult>, busy: (v: boolean) => void) {
    busy(true);
    setError(null);
    try {
      const auth = await action();
      persistTeacherAuth(auth);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in. Please try again.");
    } finally {
      busy(false);
    }
  }

  function handleLoginSubmit(event: FormEvent) {
    event.preventDefault();
    if (loading || !email || !password) return;
    if (!isValidEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }
    completeAuth(() => loginTeacher(email, password), setLoading);
  }

  function handleSignupSubmit(event: FormEvent) {
    event.preventDefault();
    if (loading || !name || !email || !password) return;
    if (!isValidEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }
    completeAuth(
      () =>
        signupTeacher({
          name,
          email,
          password,
          phone: phone || undefined,
          school_name: schoolName || undefined,
        }),
      setLoading
    );
  }

  // Already signed in — the effect above is about to redirect; render
  // nothing but a spinner instead of flashing the login form first.
  if (alreadySignedIn) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background flex">
      {/* Left: branding + auth form */}
      <div className="flex w-full flex-col justify-center px-4 py-10 sm:px-8 lg:w-1/2 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-sm">
          <div className="flex items-center gap-2.5 mb-8">
            <Image src="/brand/shikshasetu-mark.png" alt="" width={44} height={44} priority className="shrink-0" />
            <div>
              <p className="font-semibold text-foreground leading-tight">ShikshaSetu</p>
              <p className="text-xs text-muted-foreground leading-tight">Smart Education, Jharkhand</p>
            </div>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {mode === "login" ? "Welcome back" : "Set up your workspace"}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {mode === "login"
              ? "Sign in to your classroom workspace."
              : "Create your teacher account to get started."}
          </p>

          <Tabs value={mode} onValueChange={(v) => { setMode(v as Mode); setError(null); }} className="mt-7">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login" className="gap-1.5">
                <LogIn className="h-3.5 w-3.5" />
                Login
              </TabsTrigger>
              <TabsTrigger value="signup" className="gap-1.5">
                <UserPlus className="h-3.5 w-3.5" />
                Signup
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-6">
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@school.edu.in"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="pl-9"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="pl-9 pr-9"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={loading || !email || !password}
                  className="w-full gap-2 h-11"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                  {loading ? "Signing in…" : "Login"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <form onSubmit={handleSignupSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="name"
                      autoComplete="name"
                      placeholder="Anita Kumari"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className="pl-9"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@school.edu.in"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="pl-9"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="At least 4 characters"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="pl-9 pr-9"
                      required
                      minLength={4}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="school">School</Label>
                    <div className="relative">
                      <School className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="school"
                        autoComplete="organization"
                        placeholder="Optional"
                        value={schoolName}
                        onChange={(event) => setSchoolName(event.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Phone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        type="tel"
                        autoComplete="tel"
                        placeholder="Optional"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={loading || !name || !email || !password}
                  className="w-full gap-2 h-11"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  {loading ? "Creating account…" : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-background px-2.5 text-muted-foreground">or</span>
            </div>
          </div>

          <Button
            onClick={() => completeAuth(demoTeacherLogin, setDemoLoading)}
            disabled={demoLoading || loading}
            variant="outline"
            className="w-full gap-2 h-11"
          >
            {demoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {demoLoading ? "Setting up demo…" : "Continue as Demo"}
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Creates a real, working teacher account instantly — no signup needed to try it out.
          </p>

          {error && (
            <div className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Government of Jharkhand · Smart Education Programme
          </p>
        </div>
      </div>

      {/* Right: wallpaper */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/80">
        <div aria-hidden className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div aria-hidden className="absolute -left-16 top-1/3 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div aria-hidden className="absolute bottom-0 right-1/4 h-80 w-80 rounded-full bg-white/5 blur-3xl" />
        <Image
          aria-hidden
          src="/brand/shikshasetu-mark.png"
          alt=""
          width={620}
          height={610}
          className="absolute -right-28 -bottom-28 opacity-[0.08] pointer-events-none select-none"
        />

        <div className="relative flex flex-1 flex-col justify-center px-14 xl:px-20 text-primary-foreground">
          <div className="inline-flex items-center gap-1.5 self-start rounded-full bg-white/10 px-3 py-1 text-xs font-medium mb-6">
            <BookOpenCheck className="h-3.5 w-3.5" />
            Teacher Workspace
          </div>
          <h2 className="text-3xl xl:text-4xl font-semibold leading-tight max-w-md">
            Speak Hindi. They hear Ho, Mundari, Santhali — live.
          </h2>
          <p className="mt-4 text-primary-foreground/80 max-w-sm text-[15px] leading-relaxed">
            One classroom, every mother tongue. Real-time voice translation, live video,
            and AI-generated lessons — built for multilingual government classrooms.
          </p>

          <div className="mt-10 space-y-3.5">
            {FEATURES.map((f) => (
              <div key={f.label} className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <f.icon className="h-4 w-4" />
                </div>
                <p className="text-sm text-primary-foreground/90">{f.label}</p>
              </div>
            ))}
          </div>

          {/* Illustrative product preview — not live data, just showing what
              the Live Class translation exchange looks like. */}
          <div className="mt-10 rounded-2xl border border-white/15 bg-white/10 backdrop-blur-sm p-4 max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-primary-foreground/70">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                Live Class Preview
              </span>
              <span className="text-[11px] text-primary-foreground/60">Class 2 · Mathematics</span>
            </div>
            <div className="rounded-xl bg-white/10 px-3 py-2 mb-2">
              <p className="text-[11px] text-primary-foreground/60 mb-0.5">Teacher · Hindi</p>
              <p className="text-sm text-primary-foreground">नमस्ते बच्चों! आज हम जोड़ना सीखेंगे।</p>
            </div>
            <div className="rounded-xl bg-white text-foreground px-3 py-2">
              <p className="text-[11px] text-primary/70 mb-0.5">Student · Santhali</p>
              <p className="text-sm">Nomoskar Gidra&apos;ko! Tehen&apos;ge abo add koa seko lekhaye.</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
