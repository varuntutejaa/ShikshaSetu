import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  Landmark,
  Mic,
  MessageSquareText,
  Radio,
  Sparkles,
  TrendingUp,
  Video,
} from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/logo";

export const metadata: Metadata = {
  title: "ShikshaSetu — Teach in Hindi, reach every mother tongue",
  description:
    "Live voice translation, video classrooms, and AI-generated lessons, quizzes and viva assessments — built for Hindi-medium teachers reaching Ho, Mundari and Santhali speaking students.",
};

const FEATURES = [
  {
    icon: Mic,
    title: "Live Voice Translation",
    description:
      "Speak Hindi into your microphone — students hear it translated into their mother tongue in real time, and their replies are translated back to you, over a live two-way voice connection.",
  },
  {
    icon: Video,
    title: "Live Video Classroom",
    description:
      "A real Meet/Zoom-style classroom: your camera, a live status bar, and floating call controls — running independently of the voice pipeline so one never blocks the other.",
  },
  {
    icon: BookOpenCheck,
    title: "AI Lesson Studio",
    description:
      "Generate a full lesson — objectives, a teaching script, a mother-tongue translation, and a hands-on activity using everyday local objects — in seconds.",
  },
  {
    icon: ClipboardList,
    title: "AI Quiz Generator",
    description:
      "Auto-generate quizzes across MCQ, true/false, picture-based, oral, and fill-in-the-blank formats, matched to your topic and difficulty level.",
  },
  {
    icon: MessageSquareText,
    title: "AI Viva Assessment",
    description:
      "The AI independently conducts a short spoken assessment with a student in their mother tongue, evaluates each answer, and produces a real score.",
  },
  {
    icon: TrendingUp,
    title: "Student Insights",
    description:
      "Every student's real reading, numeracy and vocabulary scores, attendance, and AI-detected learning gaps — with an AI-generated recommendation for what to teach next.",
  },
];

const STEPS = [
  {
    title: "Create a class",
    description: "Name it, pick the grade and subject, choose the student language — takes seconds.",
  },
  {
    title: "Go live instantly",
    description: "Your mic and camera turn on automatically. No separate \"start\" step.",
  },
  {
    title: "Speak naturally",
    description: "Talk in Hindi like you normally would — translation happens live, in the background.",
  },
  {
    title: "Students understand",
    description: "They hear it — and reply — in Ho, Mundari or Santhali, translated back to you live.",
  },
];

const LANGUAGES = ["Ho", "Mundari", "Santhali"];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Public nav */}
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size={32} />
            <span className="font-semibold text-foreground">ShikshaSetu</span>
          </div>
          <nav className="hidden sm:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#languages" className="hover:text-foreground transition-colors">Languages</a>
          </nav>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="absolute -top-24 -right-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div aria-hidden className="absolute top-40 -left-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-16 sm:pt-20 pb-16 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground mb-6">
              <Landmark className="h-3.5 w-3.5 text-primary" />
              Government of Jharkhand · Smart Education Programme
            </div>

            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-foreground leading-[1.1]">
              Teach in Hindi.
              <br />
              Every child understands.
            </h1>
            <p className="mt-5 text-lg text-muted-foreground max-w-lg leading-relaxed">
              ShikshaSetu bridges the classroom in real time — live voice translation, video, and
              AI-generated lessons, quizzes and assessments — so Hindi-medium teachers can reach
              Ho, Mundari and Santhali speaking students in their own mother tongue.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground px-6 h-12 text-base font-semibold hover:bg-primary/90 transition-colors"
              >
                Sign In to your classroom
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#features"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-6 h-12 text-base font-semibold text-foreground hover:bg-muted transition-colors"
              >
                See what it can do
              </a>
            </div>

            <div className="mt-8 flex items-center gap-5 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-success" /> Free demo login
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-success" /> No setup required
              </span>
            </div>
          </div>

          {/* Hero visual — live translation preview */}
          <div className="relative">
            <div className="rounded-2xl border border-border bg-card shadow-xl p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <Radio className="h-3 w-3 text-destructive animate-pulse" />
                  Live Class Preview
                </span>
                <span className="text-[11px] text-muted-foreground">Class 2 · Mathematics</span>
              </div>

              <div className="rounded-xl bg-muted/50 px-3.5 py-3 mb-2.5">
                <p className="text-[11px] text-muted-foreground mb-1">Teacher · Hindi</p>
                <p className="text-sm text-foreground">नमस्ते बच्चों! आज हम जोड़ना सीखेंगे।</p>
              </div>
              <div className="rounded-xl bg-primary/[0.06] border border-primary/15 px-3.5 py-3">
                <p className="text-[11px] text-primary/70 mb-1">Student · Santhali</p>
                <p className="text-sm text-primary">
                  Nomoskar Gidra&apos;ko! Tehen&apos;ge abo add koa seko lekhaye.
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-border/70 grid grid-cols-3 gap-2">
                {[
                  { icon: Mic, label: "Voice" },
                  { icon: Video, label: "Video" },
                  { icon: Sparkles, label: "AI" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex flex-col items-center gap-1 rounded-lg bg-success/10 text-success py-2"
                  >
                    <item.icon className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-medium">{item.label} Live</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="absolute -bottom-16 right-6 rounded-xl border border-border bg-card shadow-lg px-3.5 py-2.5 hidden sm:flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                <TrendingUp className="h-3.5 w-3.5" />
              </div>
              <div className="leading-tight">
                <p className="text-xs font-semibold text-foreground">AI Recommendation</p>
                <p className="text-[11px] text-muted-foreground">Detected in real time</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 sm:px-6 py-20 scroll-mt-16">
        <div className="text-center max-w-xl mx-auto mb-12">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">
            Everything a multilingual classroom needs
          </h2>
          <p className="mt-3 text-muted-foreground">
            One workspace for live translation, video, AI-generated content, and real student
            progress — no separate tools to juggle.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-border bg-card p-6 hover:border-primary/30 hover:shadow-sm transition-all"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-foreground mb-1.5">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works — connected steps */}
      <section id="how-it-works" className="border-y border-border bg-card/50 scroll-mt-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20">
          <div className="text-center max-w-xl mx-auto mb-14">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">How it works</h2>
            <p className="mt-3 text-muted-foreground">From opening the app to a translated conversation, in four steps.</p>
          </div>

          <div className="relative grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-6">
            <div
              aria-hidden
              className="hidden md:block absolute top-6 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-primary/10 via-primary/40 to-primary/10"
            />
            {STEPS.map((step, i) => (
              <div key={step.title} className="relative flex flex-col items-center text-center gap-3">
                <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold shadow-md ring-4 ring-card">
                  {i + 1}
                </div>
                <h3 className="font-semibold text-foreground">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-[220px]">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Language showcase */}
      <section id="languages" className="mx-auto max-w-6xl px-4 sm:px-6 py-20 scroll-mt-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium mb-5">
              <GraduationCap className="h-3.5 w-3.5" />
              Built for Jharkhand&apos;s classrooms
            </div>
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">
              One teacher, three mother tongues, zero language barrier
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Most classrooms in the region have Hindi-speaking teachers and students who think
              and learn best in Ho, Mundari, or Santhali. ShikshaSetu translates every spoken
              word live in both directions, so the language your student speaks at home is the
              language they learn in.
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              {LANGUAGES.map((lang) => (
                <span
                  key={lang}
                  className="rounded-full border border-primary/20 bg-primary/[0.05] px-4 py-1.5 text-sm font-medium text-primary"
                >
                  {lang}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-2 shadow-sm">
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-6">
              <LogoMark size={140} className="absolute -right-6 -bottom-8 text-white/10 pointer-events-none" />
              <div className="relative space-y-3">
                <div className="rounded-lg bg-white/10 px-3.5 py-2.5">
                  <p className="text-[11px] text-primary-foreground/70 mb-0.5">Teacher speaks (Hindi)</p>
                  <p className="text-sm">&ldquo;छह और चार जोड़ने पर कितना होगा?&rdquo;</p>
                </div>
                <div className="flex justify-center">
                  <ArrowRight className="h-4 w-4 text-primary-foreground/50 rotate-90" />
                </div>
                <div className="rounded-lg bg-white text-foreground px-3.5 py-2.5">
                  <p className="text-[11px] text-primary/70 mb-0.5">Student hears (Santhali)</p>
                  <p className="text-sm">&ldquo;Turuy ar punyea add koa lekhaye ontok kotenag kanae?&rdquo;</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-primary/85 text-primary-foreground px-6 sm:px-12 py-14 text-center">
          <div aria-hidden className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div aria-hidden className="absolute -left-10 bottom-0 h-48 w-48 rounded-full bg-white/5 blur-3xl" />
          <div className="relative">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              Ready to bridge your classroom?
            </h2>
            <p className="mt-3 text-primary-foreground/80 max-w-md mx-auto">
              Sign in with a real demo account in one click — no setup, nothing to install.
            </p>
            <Link
              href="/login"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-white text-primary px-7 h-12 text-base font-semibold hover:bg-white/90 transition-colors"
            >
              Sign In to your classroom
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Logo size={26} />
            <span className="text-sm font-medium text-foreground">ShikshaSetu</span>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Government of Jharkhand · Smart Education Programme
          </p>
          <Link href="/login" className="text-xs font-medium text-primary hover:underline">
            Teacher Sign In →
          </Link>
        </div>
      </footer>
    </div>
  );
}
