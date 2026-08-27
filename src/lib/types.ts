export type Language = "Hindi" | "Ho" | "Mundari" | "Santhali";

export type RiskLevel = "Low" | "Medium" | "High";

export type StudentStatus = "On Track" | "Needs Support" | "At Risk";

export interface Student {
  id: string;
  name: string;
  avatarInitials: string;
  class: string;
  motherTongue: Language;
  attendance: number; // percentage
  reading: number; // percentage
  numeracy: number; // percentage
  vocabulary: number; // percentage
  overall: number; // percentage
  risk: RiskLevel;
  status: StudentStatus;
  weakConcepts: string[];
  aiRecommendation: string;
}

export interface AssessmentRecord {
  id: string;
  studentId: string;
  type: "Quiz" | "AI Viva";
  date: string;
  subject: string;
  topic: string;
  score: number;
  total: number;
}

export interface LearningGap {
  concept: string;
  studentsAffected: number;
  severity: "Low" | "Medium" | "High";
}

export interface TodayClass {
  class: string;
  subject: string;
  topic: string;
  teacherLanguage: Language;
  studentLanguage: Language;
  time: string;
}

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
