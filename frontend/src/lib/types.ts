export type Language = "Hindi" | "Ho" | "Mundari" | "Santhali";

export type RiskLevel = "Low" | "Medium" | "High";

export type StudentStatus = "On Track" | "Needs Support" | "At Risk";

export interface QuizQuestion {
  id: string;
  question: string;
  type: "MCQ" | "True/False" | "Picture-based" | "Oral/Voice" | "Fill in the blank";
  options?: string[];
  correctAnswer: string;
  difficulty: "Easy" | "Medium" | "Hard";
  competency: string;
}

export interface VivaQuestion {
  id: string;
  question: string;
  studentAnswer: string;
  isCorrect: boolean;
  competency: string;
}
