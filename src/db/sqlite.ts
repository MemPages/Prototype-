import { DatabaseSync } from 'node:sqlite';
import type { Repo, Doctor, Hospital, Specialty } from '../types.ts';

export function openDb(path: string): DatabaseSync { return new DatabaseSync(path); }

// Portable SQL (no SQLite-only features) so the schema maps 1:1 to PostgreSQL (see prisma/schema.prisma).
// Array columns are JSON text here; in Postgres they become text[] / join tables.
export function migrate(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS specialties (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, name_ar TEXT NOT NULL, description TEXT NOT NULL, keywords TEXT NOT NULL, screen_first INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS hospitals (id TEXT PRIMARY KEY, name TEXT NOT NULL, name_ar TEXT NOT NULL, city TEXT NOT NULL, address TEXT NOT NULL, specialties TEXT NOT NULL, emergency_available INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS doctors (id TEXT PRIMARY KEY, name TEXT NOT NULL, name_ar TEXT NOT NULL, specialty TEXT NOT NULL, specialty_ar TEXT NOT NULL, hospital_id TEXT NOT NULL REFERENCES hospitals(id), city TEXT NOT NULL, languages TEXT NOT NULL, years_experience INTEGER NOT NULL, available INTEGER NOT NULL, bio TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_doctors_spec_city ON doctors(specialty, city);
  `);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
const toDoctor = (r: Row): Doctor => ({ ...r, languages: JSON.parse(r.languages), available: !!r.available });
const toHospital = (r: Row): Hospital => ({ ...r, specialties: JSON.parse(r.specialties), emergency_available: !!r.emergency_available });
const toSpecialty = (r: Row): Specialty => ({ id: r.id, name: r.name, name_ar: r.name_ar, description: r.description, screen_first: !!r.screen_first });

export class SqliteRepo implements Repo {
  private db: DatabaseSync;
  constructor(db: DatabaseSync) { this.db = db; }

  async searchDoctors(q: { specialty?: string; city?: string; language?: string }): Promise<Doctor[]> {
    const sp = q.specialty ?? null, ci = q.city ?? null, lg = q.language ? `%"${q.language.toLowerCase()}"%` : null;
    return this.db.prepare(
      `SELECT * FROM doctors WHERE available = 1 AND (? IS NULL OR lower(specialty) = lower(?)) AND (? IS NULL OR lower(city) = lower(?)) AND (? IS NULL OR lower(languages) LIKE ?) ORDER BY years_experience DESC, id LIMIT 10`,
    ).all(sp, sp, ci, ci, lg, lg).map(toDoctor);
  }
  async searchHospitals(q: { specialty?: string; city?: string }): Promise<Hospital[]> {
    const sp = q.specialty ? `%"${q.specialty.toLowerCase()}"%` : null, ci = q.city ?? null;
    return this.db.prepare(
      `SELECT * FROM hospitals WHERE (? IS NULL OR lower(specialties) LIKE ?) AND (? IS NULL OR lower(city) = lower(?)) ORDER BY id LIMIT 10`,
    ).all(sp, sp, ci, ci).map(toHospital);
  }
  /** Controlled dataset: keyword match against a fixed table; the LLM cannot add specialties. */
  async searchSpecialties(symptomCategory: string): Promise<Specialty[]> {
    const text = symptomCategory.toLowerCase().slice(0, 500);
    const rows = this.db.prepare(`SELECT * FROM specialties ORDER BY id`).all() as Row[];
    return rows
      .map((r) => ({ r, score: String(r.keywords).split(',').filter((k) => k && text.includes(k)).length }))
      .filter((x) => x.score > 0).sort((a, b) => b.score - a.score).map((x) => toSpecialty(x.r));
  }
  async listSpecialties(): Promise<Specialty[]> { return (this.db.prepare(`SELECT * FROM specialties ORDER BY id`).all() as Row[]).map(toSpecialty); }
  async getDoctor(id: string): Promise<Doctor | null> { const r = this.db.prepare(`SELECT * FROM doctors WHERE id = ?`).get(id); return r ? toDoctor(r) : null; }
  async getHospital(id: string): Promise<Hospital | null> { const r = this.db.prepare(`SELECT * FROM hospitals WHERE id = ?`).get(id); return r ? toHospital(r) : null; }
}
