/**
 * Typed client for the ShikshaSetu FastAPI backend.
 *
 * Every call goes through `NEXT_PUBLIC_API_URL` — never a hard-coded host —
 * so the same build works against local dev, staging or prod backends.
 * No API keys live here or anywhere under src/; those stay server-side in
 * the backend's own environment.
 *
 * Every backend error response has the shape
 * `{"error": {"code": "...", "message": "..."}}` — ApiError below
 * normalizes that into a regular JS Error so callers can just try/catch.
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...(init?.body && !(init.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError("NETWORK_ERROR", "Could not reach the ShikshaSetu backend.", 0);
  }

  if (!response.ok) {
    let code = "UNKNOWN_ERROR";
    let message = `Request failed with status ${response.status}`;
    try {
      const body = await response.json();
      code = body?.error?.code ?? code;
      message = body?.error?.message ?? message;
    } catch {
      // response wasn't JSON — keep the generic message
    }
    throw new ApiError(code, message, response.status);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

/** Maps the frontend's display language names to backend short codes. */
export const LANGUAGE_NAME_TO_CODE: Record<string, string> = {
  Hindi: "hi",
  Santhali: "sat",
  Ho: "ho",
  Mundari: "unr",
  English: "en",
};

// ---------------------------------------------------------------------------
// Types (mirrors backend/app/schemas/*.py)
// ---------------------------------------------------------------------------

export interface TranslationResult {
  source_text: string;
  translated_text: string;
  source_language: string;
  target_language: string;
  provider: string;
  context_used?: Record<string, unknown> | null;
}

export interface GeneratedLesson {
  id: string;
  title: string;
  grade: number;
  subject: string;
  topic: string;
  teacher_language: string;
  student_language: string;
  learning_objectives: string[];
  teacher_script: string;
  mother_tongue_script: string;
  activity: string;
  assessment_topics: string[];
  downloadable: boolean;
  created_at: string;
}

export interface LessonContent {
  id: string;
  lesson_id: string;
  content_type: "audio" | "worksheet" | "flashcards";
  language: string;
  text_content: string | null;
  audio_url: string | null;
  metadata_json?: Record<string, unknown> | null;
  created_at: string;
}

export type QuestionType = "mcq" | "true_false" | "picture_based" | "oral" | "fill_in_blank";
export type Difficulty = "easy" | "medium" | "hard";

export interface QuizQuestionTeacher {
  id: string;
  question: string;
  options: string[] | null;
  correct_answer: string;
  question_type: QuestionType;
  difficulty: Difficulty;
  competency: string;
  explanation: string | null;
}

export interface GeneratedQuiz {
  id: string;
  lesson_id: string | null;
  title: string | null;
  language: string;
  created_at: string;
  questions: QuizQuestionTeacher[];
}

export interface QuizAttemptResult {
  id: string;
  quiz_id: string;
  student_id: string;
  score: number;
  total: number;
  completed_at: string | null;
}

export interface VivaQuestion {
  id: string;
  question: string;
  competency: string | null;
  order_index: number;
}

export interface VivaSessionStart {
  id: string;
  student_id: string;
  subject: string;
  topic: string;
  language: string;
  num_questions: number;
  status: string;
  first_question: VivaQuestion;
}

export interface VivaAnswerResult {
  correct: boolean;
  score: number;
  confidence: number;
  feedback: string;
  competency: string | null;
  next_question: VivaQuestion | null;
  is_last_question: boolean;
}

export interface VivaReport {
  id: string;
  student_id: string;
  score: number;
  total: number;
  strengths: string[];
  weaknesses: string[];
  recommended_interventions: string[];
  completed_at: string | null;
}

export interface Student {
  id: string;
  name: string;
  class_id: string | null;
  mother_tongue: string;
  grade: number;
  school: string | null;
  attendance: number;
  reading_score: number;
  numeracy_score: number;
  vocabulary_score: number;
  overall_score: number;
  risk_level: "Low" | "Medium" | "High";
  created_at: string;
}

export interface SyncEventIn {
  event_id: string;
  type: string;
  timestamp?: string;
  payload: Record<string, unknown>;
}

export interface SyncResult {
  processed: string[];
  failed: string[];
}

// ---------------------------------------------------------------------------
// Translation & speech
// ---------------------------------------------------------------------------

export function translateText(
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
  context?: Record<string, unknown>
): Promise<TranslationResult> {
  return apiFetch<TranslationResult>("/api/translation", {
    method: "POST",
    body: JSON.stringify({ text, source_language: sourceLanguage, target_language: targetLanguage, context }),
  });
}

export function synthesizeSpeech(text: string, language: string) {
  return apiFetch<{ audio_url: string; format: string; language: string; provider: string }>(
    "/api/speech/synthesize",
    { method: "POST", body: JSON.stringify({ text, language }) }
  );
}

export function transcribeAudio(file: Blob, language = "hi") {
  const form = new FormData();
  form.append("file", file, "segment.wav");
  form.append("language", language);
  return apiFetch<{ text: string; language: string; provider: string }>("/api/speech/transcribe", {
    method: "POST",
    body: form,
  });
}

// ---------------------------------------------------------------------------
// Lessons
// ---------------------------------------------------------------------------

export interface LessonGenerateInput {
  grade: number;
  subject: string;
  topic: string;
  teacher_language: string;
  student_language: string;
  description?: string;
  class_id?: string;
  teacher_id?: string;
}

export function generateLesson(input: LessonGenerateInput): Promise<GeneratedLesson> {
  return apiFetch<GeneratedLesson>("/api/lessons/generate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getLesson(lessonId: string): Promise<GeneratedLesson> {
  return apiFetch<GeneratedLesson>(`/api/lessons/${lessonId}`);
}

export function generateLessonAudio(
  lessonId: string,
  script: "teacher" | "mother_tongue",
  language: string
): Promise<LessonContent> {
  return apiFetch<LessonContent>(`/api/lessons/${lessonId}/audio`, {
    method: "POST",
    body: JSON.stringify({ script, language }),
  });
}

export function generateLessonWorksheet(lessonId: string, language = "hi"): Promise<LessonContent> {
  return apiFetch<LessonContent>(`/api/lessons/${lessonId}/worksheet?language=${language}`, {
    method: "POST",
  });
}

export function generateLessonFlashcards(lessonId: string, language = "sat"): Promise<LessonContent> {
  return apiFetch<LessonContent>(`/api/lessons/${lessonId}/flashcards?language=${language}`, {
    method: "POST",
  });
}

export function setLessonDownloadable(lessonId: string, downloadable = true): Promise<GeneratedLesson> {
  return apiFetch<GeneratedLesson>(`/api/lessons/${lessonId}/downloadable`, {
    method: "PATCH",
    body: JSON.stringify({ downloadable }),
  });
}

export function getOfflinePack(lessonId: string): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>(`/api/lessons/${lessonId}/offline-pack`);
}

export function generateTeachingPack(lessonId: string): Promise<{
  lesson: GeneratedLesson;
  content: LessonContent[];
  quiz_id: string | null;
  viva_seed: Record<string, unknown>;
  offline_manifest: Record<string, unknown>;
}> {
  return apiFetch(`/api/lessons/${lessonId}/teaching-pack`, { method: "POST" });
}

// ---------------------------------------------------------------------------
// Quizzes
// ---------------------------------------------------------------------------

export interface QuizGenerateInput {
  lesson_id: string;
  number_of_questions?: number;
  language: string;
  types?: QuestionType[];
  difficulty?: Difficulty;
}

export function generateQuiz(input: QuizGenerateInput): Promise<GeneratedQuiz> {
  return apiFetch<GeneratedQuiz>("/api/quizzes/generate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function submitQuizAttempt(
  quizId: string,
  studentId: string,
  answers: { question_id: string; student_answer: string }[]
): Promise<QuizAttemptResult> {
  return apiFetch<QuizAttemptResult>(`/api/quizzes/${quizId}/attempt`, {
    method: "POST",
    body: JSON.stringify({ student_id: studentId, answers }),
  });
}

// ---------------------------------------------------------------------------
// AI Viva
// ---------------------------------------------------------------------------

export interface VivaStartInput {
  student_id: string;
  subject: string;
  topic: string;
  language: string;
  number_of_questions?: number;
  lesson_id?: string;
}

export function startViva(input: VivaStartInput): Promise<VivaSessionStart> {
  return apiFetch<VivaSessionStart>("/api/viva/start", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function answerVivaQuestion(
  vivaId: string,
  questionId: string,
  studentAnswerText: string
): Promise<VivaAnswerResult> {
  return apiFetch<VivaAnswerResult>(`/api/viva/${vivaId}/answer`, {
    method: "POST",
    body: JSON.stringify({ question_id: questionId, student_answer_text: studentAnswerText }),
  });
}

export function completeViva(vivaId: string): Promise<VivaReport> {
  return apiFetch<VivaReport>(`/api/viva/${vivaId}/complete`, { method: "POST" });
}

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

export function listStudents(classId?: string): Promise<Student[]> {
  const query = classId ? `?class_id=${classId}` : "";
  return apiFetch<Student[]>(`/api/students${query}`);
}

export function getStudent(studentId: string): Promise<Student> {
  return apiFetch<Student>(`/api/students/${studentId}`);
}

export function recordStudentProgress(
  studentId: string,
  eventType: string,
  competency?: string,
  score?: number,
  extraData?: Record<string, unknown>
) {
  return apiFetch(`/api/students/${studentId}/progress`, {
    method: "POST",
    body: JSON.stringify({ event_type: eventType, competency, score, extra_data: extraData }),
  });
}

// ---------------------------------------------------------------------------
// Offline sync
// ---------------------------------------------------------------------------

export function syncEvents(studentId: string, events: SyncEventIn[]): Promise<SyncResult> {
  return apiFetch<SyncResult>("/api/sync", {
    method: "POST",
    body: JSON.stringify({ student_id: studentId, events }),
  });
}

// ---------------------------------------------------------------------------
// Classroom session + LiveKit video token
//
// Purely metadata/signaling — no video ever flows through this backend or
// this API client. The token minted here is short-lived and scoped
// (teacher can publish, student can only subscribe); the LiveKit API secret
// never leaves the backend.
// ---------------------------------------------------------------------------

export interface ClassSession {
  session_id: string;
  teacher_id: string | null;
  class_id: string | null;
  teacher_language: string;
  student_language: string;
  status: "active" | "ended";
  lesson_id: string | null;
  current_slide_index: number;
  created_at: string;
  ended_at: string | null;
}

export interface Classroom {
  id: string;
  teacher_id: string | null;
  name: string | null;
  class_code: string;
  grade: number;
  section: string | null;
  subject_focus: string | null;
  teacher_language: string;
  student_language: string;
  created_at: string;
}

export interface ClassroomParticipant {
  id: string;
  session_id: string;
  student_id: string | null;
  participant_type: "teacher" | "student" | string;
  display_name: string;
  status: "online" | "offline" | string;
  joined_at: string;
  left_at: string | null;
}

export interface ClassSessionInput {
  teacher_id?: string;
  class_id?: string;
  teacher_language: string;
  student_language: string;
}

export interface ClassroomInput {
  teacher_id?: string;
  name: string;
  grade: number;
  section?: string;
  subject_focus?: string;
  teacher_language: string;
  student_language: string;
}

export type ParticipantType = "teacher" | "student";

export interface LiveKitTokenResult {
  token: string;
  url: string;
  room: string;
}

export function createClassroomSession(input: ClassSessionInput): Promise<ClassSession> {
  return apiFetch<ClassSession>("/api/classroom/session", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createClassroom(input: ClassroomInput): Promise<Classroom> {
  return apiFetch<Classroom>("/api/classroom/classes", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function joinClassroom(
  classCode: string,
  studentId?: string,
  displayName?: string
): Promise<{ classroom: Classroom; active_session: ClassSession | null }> {
  return apiFetch("/api/classroom/classes/join", {
    method: "POST",
    body: JSON.stringify({ class_code: classCode, student_id: studentId, display_name: displayName }),
  });
}

export function startClassroom(classId: string): Promise<ClassSession> {
  return apiFetch<ClassSession>(`/api/classroom/classes/${classId}/start`, { method: "POST" });
}

export function listClassroomSessions(classId?: string, status?: "active" | "ended"): Promise<ClassSession[]> {
  const params = new URLSearchParams();
  if (classId) params.set("class_id", classId);
  if (status) params.set("status", status);
  const query = params.toString();
  return apiFetch<ClassSession[]>(`/api/classroom/sessions${query ? `?${query}` : ""}`);
}

export function listClassroomParticipants(sessionId: string): Promise<ClassroomParticipant[]> {
  return apiFetch<ClassroomParticipant[]>(`/api/classroom/session/${sessionId}/participants`);
}

export function setClassroomContent(
  sessionId: string,
  lessonId: string | null,
  slideIndex: number
): Promise<{
  session_id: string;
  lesson_id: string | null;
  current_slide_index: number;
  offline_pack: Record<string, unknown> | null;
}> {
  return apiFetch(`/api/classroom/session/${sessionId}/content`, {
    method: "POST",
    body: JSON.stringify({ lesson_id: lessonId, slide_index: slideIndex }),
  });
}

export function getStudentLearningInsights(studentId: string): Promise<{
  weak_concepts: { concept: string; average_score: number }[];
  strengths: { concept: string; average_score: number }[];
  recommendation: string;
  intervention_activity: { duration_minutes: number; language: string; activity: string } | null;
  source: string;
}> {
  return apiFetch(`/api/students/${studentId}/learning-insights`);
}

export function getClassroomMetrics(classId?: string): Promise<Record<string, unknown>> {
  return apiFetch(`/api/classroom/metrics${classId ? `?class_id=${classId}` : ""}`);
}

export function endClassroomSession(sessionId: string): Promise<ClassSession> {
  return apiFetch<ClassSession>(`/api/classroom/session/${sessionId}/end`, { method: "POST" });
}

export function getLiveKitToken(
  sessionId: string,
  participantType: ParticipantType,
  identity?: string
): Promise<LiveKitTokenResult> {
  return apiFetch<LiveKitTokenResult>("/api/classroom/livekit-token", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, participant_type: participantType, identity }),
  });
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export function checkBackendHealth() {
  return apiFetch<{ status: string; service: string; version: string; mock_mode: boolean }>(
    "/health"
  );
}
