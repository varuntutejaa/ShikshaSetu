import type {
  Student,
  AssessmentRecord,
  LearningGap,
  TodayClass,
  QuizQuestion,
  VivaQuestion,
} from "./types";

export const SCHOOL_NAME = "Government Primary School, West Singhbhum";
export const TEACHER_NAME = "Anita Kumari";
export const TEACHER_CLASS = "Class 2";

/**
 * Maps each mock student's short display id (s1..s8) to the fixed UUID the
 * same student exists under in the real backend — see
 * backend/scripts/seed_demo_data.py, which must stay in sync with this map.
 * Run that script once against your backend DB so features like AI Viva can
 * call the real API using these ids instead of falling back to a simulation.
 */
export const STUDENT_BACKEND_IDS: Record<string, string> = {
  s1: "1971e296-1289-4a1a-ba2c-2f76c5db5435",
  s2: "4dda0719-553c-4f9e-9c7b-1346d914035a",
  s3: "735178f3-f6cc-4176-889b-facef7c00636",
  s4: "431377a2-48f1-44a7-9fca-a36cc156e915",
  s5: "98bf2b27-fb12-44a6-b437-c46d785539a0",
  s6: "661ee643-ec6d-44e4-bba5-ae5e4f345150",
  s7: "a22ba81c-0a1b-4c08-b8e9-dcb531cd2134",
  s8: "c1506c73-7a7b-409d-8a92-072a402e7ca3",
};

export const TODAY_CLASS: TodayClass = {
  class: "Class 2",
  subject: "Mathematics",
  topic: "Addition 1–20",
  teacherLanguage: "Hindi",
  studentLanguage: "Santhali",
  time: "10:30 AM – 11:15 AM",
};

export const STATS = {
  totalStudents: 32,
  lessonsCompleted: 18,
  assessments: 27,
  classAverage: 78,
};

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const rawStudents: Omit<Student, "avatarInitials" | "status"> [] = [
  {
    id: "s1",
    name: "Sunita Munda",
    class: "Class 2",
    motherTongue: "Santhali",
    attendance: 94,
    reading: 82,
    numeracy: 75,
    vocabulary: 80,
    overall: 79,
    risk: "Low",
    weakConcepts: ["Number sequencing"],
    aiRecommendation: "Give a visual counting activity before introducing larger numbers.",
  },
  {
    id: "s2",
    name: "Ravi Hansda",
    class: "Class 2",
    motherTongue: "Santhali",
    attendance: 88,
    reading: 60,
    numeracy: 48,
    vocabulary: 55,
    overall: 54,
    risk: "High",
    weakConcepts: ["Addition above 10", "Reading fluency"],
    aiRecommendation: "Practice addition using physical objects and visual counting before written drills.",
  },
  {
    id: "s3",
    name: "Priya Kumari",
    class: "Class 2",
    motherTongue: "Hindi",
    attendance: 97,
    reading: 90,
    numeracy: 88,
    vocabulary: 92,
    overall: 90,
    risk: "Low",
    weakConcepts: [],
    aiRecommendation: "Ready for advanced enrichment activities in mental mathematics.",
  },
  {
    id: "s4",
    name: "Birsa Murmu",
    class: "Class 2",
    motherTongue: "Santhali",
    attendance: 79,
    reading: 55,
    numeracy: 62,
    vocabulary: 50,
    overall: 56,
    risk: "High",
    weakConcepts: ["Vocabulary", "Reading fluency"],
    aiRecommendation: "Introduce mother-tongue picture books to build vocabulary before Hindi transition.",
  },
  {
    id: "s5",
    name: "Kavita Devi",
    class: "Class 2",
    motherTongue: "Ho",
    attendance: 91,
    reading: 74,
    numeracy: 70,
    vocabulary: 72,
    overall: 72,
    risk: "Medium",
    weakConcepts: ["Number sequencing"],
    aiRecommendation: "Use number-line games to reinforce counting sequence.",
  },
  {
    id: "s6",
    name: "Suraj Tudu",
    class: "Class 2",
    motherTongue: "Santhali",
    attendance: 85,
    reading: 68,
    numeracy: 58,
    vocabulary: 65,
    overall: 64,
    risk: "Medium",
    weakConcepts: ["Addition above 10"],
    aiRecommendation: "Practice addition using stones and sticks for hands-on reinforcement.",
  },
  {
    id: "s7",
    name: "Anjali Oraon",
    class: "Class 2",
    motherTongue: "Mundari",
    attendance: 96,
    reading: 85,
    numeracy: 80,
    vocabulary: 83,
    overall: 83,
    risk: "Low",
    weakConcepts: [],
    aiRecommendation: "Continue current pace; introduce subtraction concepts next.",
  },
  {
    id: "s8",
    name: "Mangal Soren",
    class: "Class 2",
    motherTongue: "Santhali",
    attendance: 81,
    reading: 58,
    numeracy: 52,
    vocabulary: 60,
    overall: 57,
    risk: "High",
    weakConcepts: ["Addition above 10", "Number sequencing"],
    aiRecommendation: "Daily 10-minute visual counting practice with local objects recommended.",
  },
];

export const STUDENTS: Student[] = rawStudents.map((s) => ({
  ...s,
  avatarInitials: initials(s.name),
  status:
    s.overall >= 75 ? "On Track" : s.overall >= 60 ? "Needs Support" : "At Risk",
}));

export const LEARNING_GAPS: LearningGap[] = [
  { concept: "Addition above 10", studentsAffected: 3, severity: "High" },
  { concept: "Number sequencing", studentsAffected: 3, severity: "Medium" },
  { concept: "Reading fluency", studentsAffected: 2, severity: "Medium" },
];

export const ASSESSMENT_HISTORY: AssessmentRecord[] = [
  { id: "a1", studentId: "s2", type: "Quiz", date: "2026-08-25", subject: "Mathematics", topic: "Addition 1-20", score: 6, total: 10 },
  { id: "a2", studentId: "s2", type: "AI Viva", date: "2026-08-20", subject: "Mathematics", topic: "Addition 1-20", score: 5, total: 10 },
  { id: "a3", studentId: "s2", type: "Quiz", date: "2026-08-12", subject: "Hindi", topic: "Vocabulary", score: 7, total: 10 },
  { id: "a4", studentId: "s1", type: "Quiz", date: "2026-08-25", subject: "Mathematics", topic: "Addition 1-20", score: 8, total: 10 },
  { id: "a5", studentId: "s1", type: "AI Viva", date: "2026-08-18", subject: "Mathematics", topic: "Numbers 1-20", score: 9, total: 10 },
];

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "q1",
    question: "3 + 4 = ?",
    type: "MCQ",
    options: ["5", "6", "7", "8"],
    correctAnswer: "7",
    difficulty: "Easy",
    competency: "Basic Addition",
  },
  {
    id: "q2",
    question: "If you have 8 mangoes and get 5 more, how many mangoes do you have?",
    type: "MCQ",
    options: ["12", "13", "14", "11"],
    correctAnswer: "13",
    difficulty: "Medium",
    competency: "Applied Addition",
  },
  {
    id: "q3",
    question: "10 + 10 = 20",
    type: "True/False",
    options: ["True", "False"],
    correctAnswer: "True",
    difficulty: "Easy",
    competency: "Basic Addition",
  },
  {
    id: "q4",
    question: "Count the stones shown and select the correct total.",
    type: "Picture-based",
    options: ["9", "10", "11", "12"],
    correctAnswer: "11",
    difficulty: "Medium",
    competency: "Counting",
  },
  {
    id: "q5",
    question: "Say the answer aloud: 6 + 6",
    type: "Oral/Voice",
    correctAnswer: "12",
    difficulty: "Medium",
    competency: "Mental Addition",
  },
  {
    id: "q6",
    question: "9 + ___ = 15",
    type: "Fill in the blank",
    correctAnswer: "6",
    difficulty: "Hard",
    competency: "Missing Addend",
  },
  {
    id: "q7",
    question: "Which number comes after 17?",
    type: "MCQ",
    options: ["16", "18", "19", "20"],
    correctAnswer: "18",
    difficulty: "Easy",
    competency: "Number Sequencing",
  },
  {
    id: "q8",
    question: "15 + 4 = ?",
    type: "MCQ",
    options: ["18", "19", "20", "17"],
    correctAnswer: "19",
    difficulty: "Medium",
    competency: "Two-digit Addition",
  },
  {
    id: "q9",
    question: "5 + 5 + 5 = 15",
    type: "True/False",
    options: ["True", "False"],
    correctAnswer: "True",
    difficulty: "Hard",
    competency: "Repeated Addition",
  },
  {
    id: "q10",
    question: "How many sticks in total? (bundle of 10 + 3 loose sticks)",
    type: "Picture-based",
    options: ["12", "13", "14", "10"],
    correctAnswer: "13",
    difficulty: "Easy",
    competency: "Place Value",
  },
];

export const VIVA_QUESTIONS: VivaQuestion[] = [
  { id: "v1", question: "What is 3 + 2?", studentAnswer: "Five", isCorrect: true, competency: "Basic Addition" },
  { id: "v2", question: "What is 7 + 6?", studentAnswer: "Twelve", isCorrect: false, competency: "Two-digit Addition" },
  { id: "v3", question: "What comes after 14?", studentAnswer: "Fifteen", isCorrect: true, competency: "Number Sequencing" },
  { id: "v4", question: "If you have 4 stones and find 5 more, how many stones now?", studentAnswer: "Nine", isCorrect: true, competency: "Applied Addition" },
  { id: "v5", question: "What is 9 + 9?", studentAnswer: "Sixteen", isCorrect: false, competency: "Mental Addition" },
];

export const TOPICS = [
  "Numbers 1–20",
  "Addition 1–20",
  "Hindi Vocabulary",
  "Reading Comprehension",
  "Subtraction 1–20",
  "Shapes and Patterns",
];

export const LANGUAGES: string[] = ["Hindi", "Ho", "Mundari", "Santhali"];

export const QUESTION_TYPES = [
  "MCQ",
  "True/False",
  "Picture-based",
  "Oral/Voice",
  "Fill in the blank",
] as const;

export const DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;

const TRANSLATION_PREFIX: Record<string, string> = {
  Hindi: "",
  Ho: "Ho: ",
  Mundari: "Mundari: ",
  Santhali: "Sat: ",
};

export function mockTranslate(text: string, language: string): string {
  if (language === "Hindi") return text;
  return `${TRANSLATION_PREFIX[language] ?? ""}${text}`;
}

export interface GeneratedLesson {
  objectives: string[];
  teacherScript: string;
  motherTongueScript: string;
  activity: string;
}

export const CLASSES = ["Class 1", "Class 2", "Class 3", "Class 4", "Class 5"];
export const SUBJECTS = ["Mathematics", "Hindi", "Environmental Studies", "English"];
export const DURATIONS = ["20 minutes", "30 minutes", "40 minutes", "45 minutes"];

export function generateMockLesson(
  studentLanguage: string,
  topic: string
): GeneratedLesson {
  return {
    objectives: [
      "Understand basic addition using real-world objects",
      "Add numbers confidently up to 20",
      "Apply addition to simple everyday word problems",
    ],
    teacherScript: TEACHER_LESSON_SCRIPT_HI,
    motherTongueScript:
      studentLanguage === "Santhali"
        ? STUDENT_LESSON_SCRIPT_SAT
        : `[${studentLanguage} translation of the ${topic} lesson script would appear here, generated by Sarvam AI.]`,
    activity:
      "Give each student 20 small stones or tamarind seeds. Ask them to form two groups — one with 3 stones and one with 2 stones — then count the total together. Repeat with sticks and other local objects, gradually increasing the numbers up to 20.",
  };
}

export interface LiveExchange {
  id: string;
  teacherText: string;
  studentText: string;
  latencyMs: number;
}

export const LIVE_CONVERSATION: LiveExchange[] = [
  {
    id: "l1",
    teacherText: "नमस्ते बच्चों! आज हम जोड़ना सीखेंगे।",
    studentText: "Nomoskar Gidra'ko! Tehen'ge abo add koa seko lekhaye.",
    latencyMs: 1400,
  },
  {
    id: "l2",
    teacherText: "अगर मेरे पास तीन आम हैं और दो और मिला दूँ, तो कुल कितने आम होंगे?",
    studentText: "Jodi ing sate pe am menaghinge, ar bar am ratge, ontok kotenag am kanae?",
    latencyMs: 1700,
  },
  {
    id: "l3",
    teacherText: "चलिए साथ में गिनते हैं — एक, दो, तीन, चार, पाँच।",
    studentText: "Chalo abo sanam lekhta'be — mit, bar, pe, pon, mon.",
    latencyMs: 1600,
  },
  {
    id: "l4",
    teacherText: "बहुत बढ़िया! अब अपनी स्लेट पर पत्थर रखकर खुद गिनने की कोशिश करें।",
    studentText: "Bes kanae! Nonde am sate am gada'renye dul lekhaye kate lekhta'be.",
    latencyMs: 1900,
  },
  {
    id: "l5",
    teacherText: "अगला सवाल — छह और चार जोड़ने पर कितना होगा?",
    studentText: "Etkan sawal — turuy ar punyea add koa lekhaye ontok kotenag kanae?",
    latencyMs: 1500,
  },
];

export const TEACHER_LESSON_SCRIPT_HI = `नमस्ते बच्चों! आज हम जोड़ना सीखेंगे। मान लीजिए मेरे पास तीन आम हैं। अगर मैं इसमें दो और आम मिला दूँ, तो मेरे पास कुल कितने आम होंगे? आइए गिनते हैं — एक, दो, तीन, चार, पाँच। तो तीन और दो मिलाकर पाँच होते हैं। अब अपनी स्लेट पर पत्थर या बीज रखकर खुद गिनने की कोशिश करें।`;

export const STUDENT_LESSON_SCRIPT_SAT = `Nomoskar Gidra'ko! Tehen'ge abo Add Koa Seko Lekhaye. Ne Tinag Am Menaghinge. Am Barea Sen Koa Add Lekhaye, Ontok Kotenag Am Menakoa? Bo Lekhta'be — Mit, Bar, Pe, Pon, Mon. Ontok Pe Ar Bar Ratge Mon Kanae. Nonde Am Sate Am Gada'renye Dul Ar Bir Lekhaye Kate Lekhta'be.`;
