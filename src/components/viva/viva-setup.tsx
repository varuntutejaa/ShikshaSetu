"use client";

import { useState } from "react";
import { Mic, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CLASSES, SUBJECTS, TOPICS, LANGUAGES, STUDENTS } from "@/lib/mock-data";

export interface VivaConfig {
  studentClass: string;
  studentId: string;
  subject: string;
  topic: string;
  numQuestions: string;
  language: string;
}

export function VivaSetup({ onStart }: { onStart: (config: VivaConfig) => void }) {
  const [studentClass, setStudentClass] = useState("Class 2");
  const [studentId, setStudentId] = useState(STUDENTS[1].id);
  const [subject, setSubject] = useState("Mathematics");
  const [topic, setTopic] = useState("Addition 1–20");
  const [numQuestions, setNumQuestions] = useState("10");
  const [language, setLanguage] = useState("Santhali");

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
          <Select value={studentId} onValueChange={setStudentId}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STUDENTS.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
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
        onClick={() =>
          onStart({ studentClass, studentId, subject, topic, numQuestions, language })
        }
      >
        <Sparkles className="h-4 w-4" />
        Start AI Viva
      </Button>
    </div>
  );
}
