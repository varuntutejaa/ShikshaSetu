"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpenCheck, Loader2, LogIn, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError, demoTeacherLogin, loginTeacher, signupTeacher, type TeacherAuthResult } from "@/lib/api";

function persistTeacherAuth(auth: TeacherAuthResult) {
  localStorage.setItem("shikshasetu_teacher_token", auth.token);
  localStorage.setItem("shikshasetu_teacher", JSON.stringify(auth.teacher));
}

export default function TeacherLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("demo");
  const [password, setPassword] = useState("demo");
  const [schoolName, setSchoolName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function completeAuth(action: () => Promise<TeacherAuthResult>) {
    setLoading(true);
    setError(null);
    try {
      const auth = await action();
      persistTeacherAuth(auth);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 flex items-center justify-center">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <BookOpenCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">ShikshaSetu Teacher</h1>
            <p className="text-sm text-muted-foreground">Sign in to your classroom workspace</p>
          </div>
        </div>

        <Button
          onClick={() => completeAuth(demoTeacherLogin)}
          disabled={loading}
          className="w-full gap-2 mb-4"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Continue as Demo
        </Button>

        <Tabs value={mode} onValueChange={setMode}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="signup">Signup</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="space-y-4 mt-5">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <Button
              onClick={() => completeAuth(() => loginTeacher(email, password))}
              disabled={loading || !email || !password}
              className="w-full gap-2"
            >
              <LogIn className="h-4 w-4" />
              Login
            </Button>
          </TabsContent>

          <TabsContent value="signup" className="space-y-4 mt-5">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="signup-email">Email</Label>
              <Input id="signup-email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="signup-password">Password</Label>
              <Input
                id="signup-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="school">School</Label>
              <Input id="school" value={schoolName} onChange={(event) => setSchoolName(event.target.value)} />
            </div>
            <Button
              onClick={() => completeAuth(() => signupTeacher({ name, email, password, school_name: schoolName }))}
              disabled={loading || !name || !email || !password}
              className="w-full gap-2"
            >
              Signup
            </Button>
          </TabsContent>
        </Tabs>

        {error && (
          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
