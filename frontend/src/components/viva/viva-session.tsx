"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle, Mic, Loader2, Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { VIVA_QUESTIONS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import type { VivaConfig } from "@/components/viva/viva-setup";
import {
  startViva,
  answerVivaQuestion,
  completeViva,
  ApiError,
  LANGUAGE_NAME_TO_CODE,
  type VivaReport,
} from "@/lib/api";

type Phase = "asking" | "listening" | "evaluating" | "evaluated";

export interface VivaCompletion {
  correct: number;
  total: number;
  liveReport?: VivaReport;
}

interface ActiveQuestion {
  id: string;
  question: string;
}

/**
 * There's no real microphone/STT capture wired up yet, so the "student
 * answer" submitted to the backend is synthesized client-side by parsing the
 * arithmetic in the AI's question — every third question is deliberately
 * answered wrong so the demo still produces a realistic mixed report. Swap
 * this for real recorded audio + /api/speech/transcribe once mic capture is
 * built; everything downstream (evaluation, scoring, report) is already real.
 */
function synthesizeAnswer(question: string, index: number): string {
  const match = question.match(/(\d+)\s*\+\s*(\d+)/);
  if (!match) return "I'm not sure";
  const sum = Number(match[1]) + Number(match[2]);
  const value = index % 3 === 1 ? sum + 1 : sum;
  return String(value);
}

export function VivaSession({
  config,
  onComplete,
}: {
  config: VivaConfig;
  onComplete: (result: VivaCompletion) => void;
}) {
  const [phase, setPhase] = useState<Phase>("asking");
  const [index, setIndex] = useState(0);
  const [total, setTotal] = useState(Number(config.numQuestions) || VIVA_QUESTIONS.length);
  const [score, setScore] = useState(0);
  const [ready, setReady] = useState(false);
  const [current, setCurrent] = useState<ActiveQuestion>({
    id: VIVA_QUESTIONS[0].id,
    question: VIVA_QUESTIONS[0].question,
  });
  const [studentAnswerText, setStudentAnswerText] = useState(VIVA_QUESTIONS[0].studentAnswer);
  const [isCorrect, setIsCorrect] = useState(VIVA_QUESTIONS[0].isCorrect);

  const vivaIdRef = useRef<string | null>(null);
  const sourceRef = useRef<"live" | "offline">("offline");
  // Mirrors `current` state so the async timer callbacks below always read
  // the latest question, never a stale closure from before initialization
  // (startViva) resolved — that race previously sent the placeholder
  // question's id to the backend and got a 422 back.
  const currentRef = useRef(current);
  useEffect(() => {
    currentRef.current = current;
  }, [current]);
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  // One-time setup: try a real backend viva session, fall back to the local
  // canned question bank if unavailable. The timed phase machine below does
  // not start until this resolves either way (`ready`), so it never races.
  useEffect(() => {
    startViva({
      student_id: config.studentId,
      subject: config.subject,
      topic: config.topic,
      language: LANGUAGE_NAME_TO_CODE[config.language] ?? "sat",
      number_of_questions: Number(config.numQuestions) || 10,
    })
      .then((session) => {
        vivaIdRef.current = session.id;
        sourceRef.current = "live";
        setTotal(session.num_questions);
        setCurrent({ id: session.first_question.id, question: session.first_question.question });
      })
      .catch((err) => {
        if (err instanceof ApiError) {
          console.warn(`Viva API unavailable (${err.code}), using offline simulated viva.`);
        }
      })
      .finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    timeouts.current.forEach(clearTimeout);

    const t0 = setTimeout(() => setPhase("asking"), 0);
    const t1 = setTimeout(() => setPhase("listening"), 700);
    const t2 = setTimeout(() => setPhase("evaluating"), 700 + 1300);

    const t3 = setTimeout(async () => {
      const activeQuestion = currentRef.current;

      if (sourceRef.current === "live" && vivaIdRef.current) {
        const answerText = synthesizeAnswer(activeQuestion.question, index);
        setStudentAnswerText(answerText);
        try {
          const result = await answerVivaQuestion(vivaIdRef.current, activeQuestion.id, answerText);
          setIsCorrect(result.correct);
          if (result.correct) setScore((s) => s + 1);
          setPhase("evaluated");

          const t4 = setTimeout(async () => {
            if (result.is_last_question || !result.next_question) {
              try {
                const report = await completeViva(vivaIdRef.current!);
                onComplete({ correct: report.score, total: report.total, liveReport: report });
              } catch {
                onComplete({ correct: score + (result.correct ? 1 : 0), total });
              }
            } else {
              setCurrent({ id: result.next_question.id, question: result.next_question.question });
              setIndex((i) => i + 1);
            }
          }, 1800);
          timeouts.current.push(t4);
        } catch (err) {
          if (err instanceof ApiError) {
            console.warn(`Viva answer submission failed (${err.code}), ending session early.`);
          }
          onComplete({ correct: score, total: index || 1 });
        }
        return;
      }

      // Offline fallback: cycle through the local canned Q&A bank.
      const local = VIVA_QUESTIONS[index % VIVA_QUESTIONS.length];
      setStudentAnswerText(local.studentAnswer);
      setIsCorrect(local.isCorrect);
      setPhase("evaluated");
      if (local.isCorrect) setScore((s) => s + 1);

      const t4 = setTimeout(() => {
        if (index + 1 >= total) {
          onComplete({ correct: score + (local.isCorrect ? 1 : 0), total });
        } else {
          const next = VIVA_QUESTIONS[(index + 1) % VIVA_QUESTIONS.length];
          setCurrent({ id: next.id, question: next.question });
          setIndex((i) => i + 1);
        }
      }, 1800);
      timeouts.current.push(t4);
    }, 700 + 1300 + 700);

    timeouts.current = [t0, t1, t2, t3];
    return () => timeouts.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, ready]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">
            {config.studentName} · {config.subject}
          </p>
          <p className="text-xs text-muted-foreground">{config.topic} · {config.language}</p>
        </div>
        <Badge variant="secondary">
          Question {Math.min(index + 1, total)} of {total}
        </Badge>
      </div>

      <Progress value={((index + (phase === "evaluated" ? 1 : 0)) / total) * 100} />

      {!ready && (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <Loader2 className="h-6 w-6 text-primary mx-auto mb-2 animate-spin" />
          <p className="text-sm text-muted-foreground">Preparing the AI Viva…</p>
        </div>
      )}

      {ready && (
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-6">
        <div className="flex gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Bot className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">AI Question</p>
            <p className="text-lg font-medium text-foreground">&ldquo;{current.question}&rdquo;</p>
          </div>
        </div>

        <div
          className={cn(
            "flex gap-3 transition-opacity duration-300",
            phase === "asking" ? "opacity-0" : "opacity-100"
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            <Mic className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Student Answer</p>
            {phase === "listening" ? (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <span className="flex gap-0.5">
                  <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 rounded-full bg-primary animate-bounce" />
                </span>
                Listening…
              </p>
            ) : (
              <p className="text-base text-foreground">🎙️ &ldquo;{studentAnswerText}&rdquo;</p>
            )}
          </div>
        </div>

        <div
          className={cn(
            "flex items-center gap-3 pt-4 border-t border-border/70 transition-opacity duration-300",
            phase === "evaluating" || phase === "evaluated" ? "opacity-100" : "opacity-0"
          )}
        >
          {phase === "evaluating" ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> AI evaluating response…
            </p>
          ) : phase === "evaluated" ? (
            <>
              {isCorrect ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              <span className={cn("text-sm font-semibold", isCorrect ? "text-success" : "text-destructive")}>
                {isCorrect ? "Correct" : "Incorrect"}
              </span>
              <span className="ml-auto text-sm font-medium text-muted-foreground">
                Score: {score}/{index + 1}
              </span>
            </>
          ) : null}
        </div>
      </div>
      )}
    </div>
  );
}
