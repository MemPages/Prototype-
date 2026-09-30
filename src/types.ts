export type Lang = 'en' | 'ar';
export interface Doctor { id: string; name: string; name_ar: string; specialty: string; specialty_ar: string; hospital_id: string; city: string; languages: string[]; years_experience: number; available: boolean; bio: string }
export interface Hospital { id: string; name: string; name_ar: string; city: string; address: string; specialties: string[]; emergency_available: boolean }
export interface Specialty { id: string; name: string; name_ar: string; description: string; screen_first: boolean }

/** Data-access boundary. The ONLY source of truth for doctors/hospitals. Swap SqliteRepo for a Postgres/Prisma impl later. */
export interface Repo {
  searchDoctors(q: { specialty?: string; city?: string; language?: string }): Promise<Doctor[]>;
  searchHospitals(q: { specialty?: string; city?: string }): Promise<Hospital[]>;
  searchSpecialties(symptomCategory: string): Promise<Specialty[]>;
  listSpecialties(): Promise<Specialty[]>;
  getDoctor(id: string): Promise<Doctor | null>;
  getHospital(id: string): Promise<Hospital | null>;
}

export interface ToolResult { name: string; args: unknown; ok: boolean; data: unknown; error?: string; ms: number }
export interface SessionState {
  lang: Lang; userText: string; specialty: string | null; specialtyAr: string | null;
  screenFirst: boolean; screening: 'clear' | null; awaiting: 'screening' | null; asked: string[];
}
export interface Session { id: string; state: SessionState; history: { role: 'user' | 'assistant'; content: string }[]; touched: number }
export type ProviderStep = { kind: 'tool_calls'; calls: { name: string; args: unknown }[] } | { kind: 'final'; draft: unknown };
export interface ProviderContext { lang: Lang; userText: string; state: SessionState; history: Session['history']; toolResults: ToolResult[]; signal: AbortSignal }
/** The LLM may only DECIDE which tool to call and DRAFT a decision. It never supplies tool results. */
export interface LLMProvider { name: string; next(ctx: ProviderContext): Promise<ProviderStep> }
export type Logger = (event: string, fields?: Record<string, unknown>) => void;
