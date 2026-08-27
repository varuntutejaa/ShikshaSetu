"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LessonStudio } from "@/components/lessons/lesson-studio";
import { QuizGenerator } from "@/components/lessons/quiz-generator";

export default function LessonsPage() {
  const [tab, setTab] = useState("studio");
  const [lessonId, setLessonId] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <PageHeader
        eyebrow="AI Lesson Studio"
        title="Create bilingual lessons in minutes"
        subtitle="Describe your lesson once — ShikshaSetu generates a Hindi teaching script, a mother-tongue version, a classroom activity and a ready-to-send quiz."
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="studio">Lesson Studio</TabsTrigger>
          <TabsTrigger value="quiz">Quiz Generator</TabsTrigger>
        </TabsList>
        <TabsContent value="studio" className="mt-6">
          <LessonStudio
            onQuizRequested={() => setTab("quiz")}
            onLessonGenerated={setLessonId}
          />
        </TabsContent>
        <TabsContent value="quiz" className="mt-6">
          <QuizGenerator lessonId={lessonId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
