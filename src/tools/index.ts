import { z } from 'zod';
import type { Repo, ToolResult } from '../types.ts';
const s = z.string().trim().min(1).max(200);
/** Tool registry. Args are validated with Zod; results come ONLY from Repo (the database). */
export function makeTools(repo: Repo) {
  return {
    search_doctors: { schema: z.object({ specialty: s.optional(), city: s.optional(), language: z.string().regex(/^[A-Za-z]{2,20}$/).optional() }).strict(), run: (a: any) => repo.searchDoctors(a) },
    search_hospitals: { schema: z.object({ specialty: s.optional(), city: s.optional() }).strict(), run: (a: any) => repo.searchHospitals(a) },
    search_specialties: { schema: z.object({ symptom_category: s }).strict(), run: (a: any) => repo.searchSpecialties(a.symptom_category) },
    get_doctor_details: { schema: z.object({ doctor_id: z.string().regex(/^DOC-\d{3}$/) }).strict(), run: (a: any) => repo.getDoctor(a.doctor_id) },
    get_hospital_details: { schema: z.object({ hospital_id: z.string().regex(/^HOSP-\d{3}$/) }).strict(), run: (a: any) => repo.getHospital(a.hospital_id) },
  } as Record<string, { schema: z.ZodTypeAny; run: (a: any) => Promise<unknown> }>;
}
export type Tools = ReturnType<typeof makeTools>;

/** Never throws. Error categories only (no raw messages) so nothing sensitive leaks to logs/users. */
export async function executeTool(tools: Tools, name: string, args: unknown): Promise<ToolResult> {
  const t0 = performance.now();
  const done = (ok: boolean, data: unknown, error?: string): ToolResult => ({ name, args, ok, data, error, ms: Math.round(performance.now() - t0) });
  const tool = Object.hasOwn(tools, name) ? tools[name] : undefined;
  if (!tool) return done(false, null, 'unknown_tool');
  const parsed = tool.schema.safeParse(args ?? {});
  if (!parsed.success) return done(false, null, 'invalid_args');
  try {
    const data = await tool.run(parsed.data);
    return data === null ? done(false, null, 'not_found') : done(true, data);
  } catch {
    return done(false, null, 'tool_error');
  }
}
