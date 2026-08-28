"use client";

import { useEffect, useState } from "react";
import { Mic, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CLASSES, SUBJECTS, TOPICS, LANGUAGES } from "@/lib/mock-data";
import { listStudents, type Student } from "@/lib/api";

export interface VivaConfig {
  studentClass: string;
  studentId: string;
  studentName: string;
  subject: string;
  topic: string;
  numQuestions: string;
  language: string;
}

export function VivaSetup({ onStart }: { onStart: (config: VivaConfig) => void }) {
  const [students, setStudents] = useState<Student[] | null>(null);
  const [studentClass, setStudentClass] = useState("Class 2");
  const [studentId, setStudentId] = useState("");
  const [subject, setSubject] = useState("Mathematics");
  const [topic, setTopic] = useState("Addition 1–20");
  const [numQuestions, setNumQuestions] = useState("10");
  const [language, setLanguage] = useState("Santhali");

  useEffect(() => {
    let cancelled = false;
    listStudents()
      .then((s) => {
        if (cancelled) return;
        setStudents(s);
        if (s.length > 0) setStudentId(s[0].id);
      })
      .catch(() => {
        if (!cancelled) setStudents([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedStudent = students?.find((s) => s.id === studentId);
  const canStart = !!selectedStudent;

  return (
    <div className="rounded-xl border border-border bg-card p-6 sm:p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Mic className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground">Configure AI Viva</h2>
          <p className="text-xs text-muted-foreground">
            The AI will independently conduct a spoken assessment with the student.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
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
          <Label>Student</Label>
          {students === null ? (
            <div className="flex items-center gap-2 h-9 px-3 text-sm text-muted-foreground border border-border rounded-md">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading students…
            </div>
          ) : students.length === 0 ? (
            <p className="text-xs text-muted-foreground h-9 flex items-center">
              No students yet — register one from the Android app first.
            </p>
          ) : (
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
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
          <Label>Number of Questions</Label>
          <Select value={numQuestions} onValueChange={setNumQuestions}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["5", "10", "15"].map((n) => (
                <SelectItem key={n} value={n}>{n} questions</SelectItem>
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

      <Button
        size="lg"
        className="w-full h-12 mt-7 gap-2 text-base font-semibold"
        disabled={!canStart}
        onClick={() =>
          selectedStudent &&
          onStart({
            studentClass,
            studentId: selectedStudent.id,
            studentName: selectedStudent.name,
            subject,
            topic,
            numQuestions,
            language,
          })
        }
      >
        <Sparkles className="h-4 w-4" />
        Start AI Viva
      </Button>
    </div>
  );
}
