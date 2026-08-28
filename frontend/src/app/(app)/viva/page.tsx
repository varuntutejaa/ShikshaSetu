"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { VivaSetup, type VivaConfig } from "@/components/viva/viva-setup";
import { VivaSession, type VivaCompletion } from "@/components/viva/viva-session";
import { VivaReport } from "@/components/viva/viva-report";

type Stage =
  | { step: "setup" }
  | { step: "running"; config: VivaConfig }
  | { step: "report"; config: VivaConfig; result: VivaCompletion };

export default function VivaPage() {
  const [stage, setStage] = useState<Stage>({ step: "setup" });

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <PageHeader
        eyebrow="AI Viva"
        title="AI-conducted spoken assessment"
        subtitle="Different from Live Classroom Translation — here the AI independently asks questions, listens to the student's spoken answers, and evaluates them without teacher involvement."
      />

      {stage.step === "setup" && (
        <VivaSetup onStart={(config) => setStage({ step: "running", config })} />
      )}

      {stage.step === "running" && (
        <VivaSession
          config={stage.config}
          onComplete={(result) => setStage({ step: "report", config: stage.config, result })}
        />
      )}

      {stage.step === "report" && (
        <VivaReport
          config={stage.config}
          correct={stage.result.correct}
          total={stage.result.total}
          liveReport={stage.result.liveReport}
          onRestart={() => setStage({ step: "setup" })}
        />
      )}
    </div>
  );
}
