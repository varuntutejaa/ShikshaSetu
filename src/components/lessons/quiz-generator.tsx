"use client";

import { useState } from "react";
import {
  Brain,
  Loader2,
  Pencil,
  RefreshCw,
  Trash2,
  Languages,
  Eye,
  Send,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  QUESTION_TYPES,
  DIFFICULTIES,
  LANGUAGES,
  QUIZ_QUESTIONS,
  mockTranslate,
} from "@/lib/mock-data";
import type { QuizQuestion } from "@/lib/types";
import { cn } from "@/lib/utils";
import { generateQuiz, ApiError, LANGUAGE_NAME_TO_CODE, type QuestionType, type Difficulty } from "@/lib/api";

const DIFFICULTY_STYLES: Record<string, string> = {
  Easy: "bg-success/15 text-success border-success/20",
  Medium: "bg-warning/25 text-warning-foreground border-warning/30",
  Hard: "bg-destructive/10 text-destructive border-destructive/20",
};

const TYPE_TO_BACKEND: Record<string, QuestionType> = {
  MCQ: "mcq",
  "True/False": "true_false",
  "Picture-based": "picture_based",
  "Oral/Voice": "oral",
  "Fill in the blank": "fill_in_blank",
};
const TYPE_FROM_BACKEND: Record<QuestionType, string> = {
  mcq: "MCQ",
  true_false: "True/False",
  picture_based: "Picture-based",
  oral: "Oral/Voice",
  fill_in_blank: "Fill in the blank",
};
const DIFFICULTY_FROM_BACKEND: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

interface EditableQuestion extends QuizQuestion {
  translatedTo?: string;
}

export function QuizGenerator({ lessonId }: { lessonId?: string | null }) {
  const [selectedTypes, setSelectedTypes] = useState<string[]>([...QUESTION_TYPES]);
  const [difficulty, setDifficulty] = useState("Medium");
  const [language, setLanguage] = useState("Hindi");
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<EditableQuestion[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [previewQ, setPreviewQ] = useState<EditableQuestion | null>(null);
  const [sent, setSent] = useState(false);
  const [source, setSource] = useState<"live" | "offline" | null>(null);

  function toggleType(type: string) {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  async function handleGenerate() {
    setLoading(true);
    setSent(false);

    if (lessonId) {
      try {
        const result = await generateQuiz({
          lesson_id: lessonId,
          number_of_questions: 10,
          language: LANGUAGE_NAME_TO_CODE[language] ?? "hi",
          types: selectedTypes.map((t) => TYPE_TO_BACKEND[t]).filter(Boolean),
          difficulty: (difficulty.toLowerCase() as Difficulty) ?? "medium",
        });
        setQuestions(
          result.questions.map((q) => ({
            id: q.id,
            question: q.question,
            type: TYPE_FROM_BACKEND[q.question_type] as QuizQuestion["type"],
            options: q.options ?? undefined,
            correctAnswer: q.correct_answer,
            difficulty: DIFFICULTY_FROM_BACKEND[q.difficulty] as QuizQuestion["difficulty"],
            competency: q.competency,
          }))
        );
        setSource("live");
        setLoading(false);
        return;
      } catch (err) {
        if (err instanceof ApiError) {
          console.warn(`Quiz API unavailable (${err.code}), using offline sample quiz.`);
        }
      }
    }

    setTimeout(() => {
      setQuestions(QUIZ_QUESTIONS.map((q) => ({ ...q })));
      setSource("offline");
      setLoading(false);
    }, 1100);
  }

  function handleDelete(id: string) {
    setQuestions((qs) => qs?.filter((q) => q.id !== id) ?? null);
  }

  function handleRegenerate(id: string) {
    setQuestions(
      (qs) =>
        qs?.map((q) =>
          q.id === id
            ? {
                ...q,
                options: q.options ? [...q.options].reverse() : q.options,
                question: q.question.endsWith(" (regenerated)")
                  ? q.question
                  : `${q.question} (regenerated)`,
              }
            : q
        ) ?? null
    );
  }

  function handleTranslate(id: string) {
    setQuestions(
      (qs) =>
        qs?.map((q) =>
          q.id === id
            ? {
                ...q,
                translatedTo: language,
                question: mockTranslate(q.question, language),
              }
            : q
        ) ?? null
    );
  }

  function startEdit(q: EditableQuestion) {
    setEditingId(q.id);
    setDraftText(q.question);
  }

  function saveEdit(id: string) {
    setQuestions(
      (qs) => qs?.map((q) => (q.id === id ? { ...q, question: draftText } : q)) ?? null
    );
    setEditingId(null);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5 space-y-5">
        <h3 className="font-semibold text-foreground">Generate Assessment</h3>

        <div>
          <Label className="mb-2 block">Question Types</Label>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {QUESTION_TYPES.map((type) => (
              <label
                key={type}
                className="flex items-center gap-2 text-sm text-foreground/90 cursor-pointer"
              >
                <Checkbox
                  checked={selectedTypes.includes(type)}
                  onCheckedChange={() => toggleType(type)}
                />
                {type}
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
          <div className="space-y-1.5">
            <Label>Difficulty</Label>
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DIFFICULTIES.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Language</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={handleGenerate} disabled={loading} size="lg" className="gap-2 font-semibold">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Brain className="h-4 w-4" />
          )}
          {loading ? "Generating…" : "Generate 10 Questions"}
        </Button>
        {!lessonId && (
          <p className="text-xs text-muted-foreground mt-2">
            Generate a lesson in Lesson Studio first to create a quiz from real AI content — showing an offline sample otherwise.
          </p>
        )}
      </div>

      {source === "offline" && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-3.5 py-2 text-xs text-warning-foreground">
          Backend unreachable or no lesson selected — showing an offline sample quiz.
        </div>
      )}

      {sent && (
        <Alert className="border-success/30 bg-success/10 text-success">
          <Check className="h-4 w-4" />
          <AlertTitle>Assessment sent</AlertTitle>
          <AlertDescription className="text-success/90">
            All {questions?.length ?? 0} questions were sent to Class 2 students.
          </AlertDescription>
        </Alert>
      )}

      {questions && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {questions.length} question{questions.length !== 1 ? "s" : ""} generated
            </p>
            <Button onClick={() => setSent(true)} className="gap-2">
              <Send className="h-4 w-4" /> Send to Students
            </Button>
          </div>

          {questions.map((q, i) => (
            <div key={q.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-xs font-semibold text-muted-foreground">
                      Q{i + 1}
                    </span>
                    <Badge variant="secondary" className="font-normal">{q.type}</Badge>
                    <Badge variant="outline" className={cn("font-medium", DIFFICULTY_STYLES[q.difficulty])}>
                      {q.difficulty}
                    </Badge>
                    <Badge variant="outline" className="font-normal text-muted-foreground">
                      {q.competency}
                    </Badge>
                    {q.translatedTo && (
                      <Badge className="bg-primary/10 text-primary font-normal gap-1">
                        <Languages className="h-3 w-3" /> {q.translatedTo}
                      </Badge>
                    )}
                  </div>

                  {editingId === q.id ? (
                    <div className="flex items-center gap-2 mb-3">
                      <Input
                        value={draftText}
                        onChange={(e) => setDraftText(e.target.value)}
                        className="text-sm"
                        autoFocus
                      />
                      <Button size="icon" variant="ghost" onClick={() => saveEdit(q.id)}>
                        <Check className="h-4 w-4 text-success" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                        <X className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-foreground mb-3">{q.question}</p>
                  )}

                  {q.options && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {q.options.map((opt) => (
                        <span
                          key={opt}
                          className={cn(
                            "text-xs px-2.5 py-1 rounded-md border",
                            opt === q.correctAnswer
                              ? "border-success/30 bg-success/10 text-success font-medium"
                              : "border-border bg-muted/40 text-muted-foreground"
                          )}
                        >
                          {opt}
                        </span>
                      ))}
                    </div>
                  )}
                  {!q.options && (
                    <p className="text-xs text-muted-foreground">
                      Correct answer:{" "}
                      <span className="font-medium text-success">{q.correctAnswer}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-border/70">
                <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground" onClick={() => startEdit(q)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground" onClick={() => handleRegenerate(q.id)}>
                  <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                </Button>
                <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground" onClick={() => handleTranslate(q.id)}>
                  <Languages className="h-3.5 w-3.5" /> Translate
                </Button>
                <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground" onClick={() => setPreviewQ(q)}>
                  <Eye className="h-3.5 w-3.5" /> Preview
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-destructive hover:text-destructive ml-auto"
                  onClick={() => handleDelete(q.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!previewQ} onOpenChange={(open) => !open && setPreviewQ(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Student Preview</DialogTitle>
          </DialogHeader>
          {previewQ && (
            <div className="space-y-4">
              <p className="text-base font-medium text-foreground">{previewQ.question}</p>
              {previewQ.options && (
                <div className="space-y-2">
                  {previewQ.options.map((opt) => (
                    <div
                      key={opt}
                      className="rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/90"
                    >
                      {opt}
                    </div>
                  ))}
                </div>
              )}
              {!previewQ.options && (
                <div className="rounded-lg border border-dashed border-border px-3.5 py-6 text-center text-sm text-muted-foreground">
                  Student responds via {previewQ.type === "Oral/Voice" ? "voice" : "text"} input
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
