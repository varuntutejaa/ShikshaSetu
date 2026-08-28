"use client";

import { useState } from "react";
import {
  Sparkles,
  Volume2,
  FileText,
  Brain,
  Pencil,
  Send,
  Loader2,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CLASSES,
  SUBJECTS,
  DURATIONS,
  LANGUAGES,
  TOPICS,
  generateMockLesson,
  type GeneratedLesson,
} from "@/lib/mock-data";
import {
  ApiError,
  generateLesson,
  generateLessonAudio,
  generateLessonFlashcards,
  generateLessonWorksheet,
  generateTeachingPack,
  LANGUAGE_NAME_TO_CODE,
  setLessonDownloadable,
} from "@/lib/api";

export function LessonStudio({
  onQuizRequested,
  onLessonGenerated,
}: {
  onQuizRequested: () => void;
  onLessonGenerated?: (lessonId: string | null) => void;
}) {
  const [studentClass, setStudentClass] = useState("Class 2");
  const [subject, setSubject] = useState("Mathematics");
  const [topic, setTopic] = useState("Addition 1–20");
  const [duration, setDuration] = useState("30 minutes");
  const [teacherLanguage, setTeacherLanguage] = useState("Hindi");
  const [studentLanguage, setStudentLanguage] = useState("Santhali");
  const [description, setDescription] = useState(
    "Teach Class 2 students addition from 1 to 20 using simple real-world examples."
  );
  const [loading, setLoading] = useState(false);
  const [lesson, setLesson] = useState<GeneratedLesson | null>(null);
  const [source, setSource] = useState<"live" | "offline" | null>(null);
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [assetStatus, setAssetStatus] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setLesson(null);
    onLessonGenerated?.(null);

    try {
      const grade = Number(studentClass.replace(/\D/g, "")) || 2;
      const result = await generateLesson({
        grade,
        subject,
        topic,
        teacher_language: LANGUAGE_NAME_TO_CODE[teacherLanguage] ?? "hi",
        student_language: LANGUAGE_NAME_TO_CODE[studentLanguage] ?? "sat",
        description,
      });
      setLesson({
        objectives: result.learning_objectives,
        teacherScript: result.teacher_script,
        motherTongueScript: result.mother_tongue_script,
        activity: result.activity,
      });
      setSource("live");
      setLessonId(result.id);
      onLessonGenerated?.(result.id);
    } catch (err) {
      // Backend unreachable or erroring — fall back to the local mock
      // generator so the studio still works standalone.
      if (err instanceof ApiError) {
        console.warn(`Lesson API unavailable (${err.code}), using offline mock lesson.`);
      }
      setLesson(generateMockLesson(studentLanguage, topic));
      setSource("offline");
      setLessonId(null);
      onLessonGenerated?.(null);
    } finally {
      setLoading(false);
    }
  }

  async function runAssetAction(action: "audio" | "worksheet" | "flashcards" | "pack" | "downloadable") {
    if (!lessonId) return;
    setAssetStatus("Generating assets…");
    try {
      const language = LANGUAGE_NAME_TO_CODE[studentLanguage] ?? "sat";
      if (action === "audio") await generateLessonAudio(lessonId, "mother_tongue", language);
      if (action === "worksheet") await generateLessonWorksheet(lessonId, language);
      if (action === "flashcards") await generateLessonFlashcards(lessonId, language);
      if (action === "pack") await generateTeachingPack(lessonId);
      if (action === "downloadable") await setLessonDownloadable(lessonId, true);
      setAssetStatus("Saved to lesson pack.");
    } catch (err) {
      setAssetStatus(err instanceof ApiError ? err.message : "Could not generate lesson asset.");
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">
      {/* Input panel */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4 lg:sticky lg:top-6">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Class</Label>
            <Select value={studentClass} onValueChange={setStudentClass}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CLASSES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SUBJECTS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Topic</Label>
          <Select value={topic} onValueChange={setTopic}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TOPICS.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Lesson Duration</Label>
          <Select value={duration} onValueChange={setDuration}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DURATIONS.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Teacher Language</Label>
            <Select value={teacherLanguage} onValueChange={setTeacherLanguage}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Student Language</Label>
            <Select value={studentLanguage} onValueChange={setStudentLanguage}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGUAGES.filter((l) => l !== "Hindi").map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Paste or describe your lesson</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Teach Class 2 students addition from 1 to 20 using simple real-world examples."
          />
        </div>

        <Button
          onClick={handleGenerate}
          disabled={loading}
          size="lg"
          className="w-full h-11 gap-2 text-base font-semibold"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {loading ? "Generating…" : "Generate Lesson"}
        </Button>
      </div>

      {/* Output panel */}
      <div className="space-y-4">
        {!lesson && !loading && (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-12 text-center">
            <Sparkles className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">
              Your generated lesson will appear here
            </p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              Fill in the class details and describe your lesson, then click
              Generate Lesson to create a bilingual teaching script.
            </p>
          </div>
        )}

        {loading && (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <Loader2 className="h-8 w-8 text-primary mx-auto mb-3 animate-spin" />
            <p className="text-sm font-medium text-foreground">
              Generating your lesson with AI…
            </p>
          </div>
        )}

        {lesson && (
          <>
            {source === "offline" && (
              <div className="rounded-lg border border-warning/30 bg-warning/10 px-3.5 py-2 text-xs text-warning-foreground">
                Backend unreachable — showing an offline sample lesson. Start the ShikshaSetu backend to generate real AI content.
              </div>
            )}
            {assetStatus && (
              <div className="rounded-lg border border-info/30 bg-info/10 px-3.5 py-2 text-xs text-info">
                {assetStatus}
              </div>
            )}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Target className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-foreground">Learning Objectives</h3>
              </div>
              <ul className="space-y-1.5">
                {lesson.objectives.map((o) => (
                  <li key={o} className="flex items-start gap-2 text-sm text-foreground/90">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    {o}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-foreground">Teacher Script</h3>
                <Badge variant="secondary">{teacherLanguage}</Badge>
              </div>
              <p className="text-sm leading-relaxed text-foreground/90">
                {lesson.teacherScript}
              </p>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-foreground">Mother-Tongue Version</h3>
                <Badge className="bg-primary text-primary-foreground">{studentLanguage}</Badge>
              </div>
              <p className="text-sm leading-relaxed text-foreground/90">
                {lesson.motherTongueScript}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-semibold text-foreground mb-3">Classroom Activity</h3>
              <p className="text-sm leading-relaxed text-foreground/90">
                {lesson.activity}
              </p>
            </div>

            <Separator />

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="gap-2" disabled={!lessonId} onClick={() => runAssetAction("audio")}>
                <Volume2 className="h-4 w-4" /> Generate Audio
              </Button>
              <Button variant="outline" className="gap-2" disabled={!lessonId} onClick={() => runAssetAction("worksheet")}>
                <FileText className="h-4 w-4" /> Generate Worksheet
              </Button>
              <Button variant="outline" className="gap-2" onClick={onQuizRequested}>
                <Brain className="h-4 w-4" /> Generate Quiz
              </Button>
              <Button variant="outline" className="gap-2" disabled={!lessonId} onClick={() => runAssetAction("flashcards")}>
                <Pencil className="h-4 w-4" /> Flashcards
              </Button>
              <Button variant="outline" className="gap-2" disabled={!lessonId} onClick={() => runAssetAction("pack")}>
                <Pencil className="h-4 w-4" /> Teaching Pack
              </Button>
              <Button className="gap-2 ml-auto" disabled={!lessonId} onClick={() => runAssetAction("downloadable")}>
                <Send className="h-4 w-4" /> Send to Students
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
