// Anti-hallucination guard: any doctor/hospital-looking name in LLM text must match a record returned by a tool this turn.
const DR = /\bDr\.?\s+[A-Z][\w'-]+(?:\s+[A-Z][\w'-]+)?/g;
const AR_DR = /د\.\s*[\u0600-\u06FF]+(?:\s+[\u0600-\u06FF]+)?/g;
const FAC = /\b(?:[A-Z][\w'-]*\s+){1,3}(?:Hospital|Medical Center|Clinic)\b/g;
export function findUngrounded(text: string, known: string[]): string[] {
  const k = known.map((x) => x.toLowerCase()).filter(Boolean);
  const out: string[] = [];
  for (const re of [DR, AR_DR, FAC]) for (const m of text.matchAll(re)) {
    const x = m[0].toLowerCase().trim();
    if (!k.some((n) => n.includes(x) || x.includes(n))) out.push(m[0]);
  }
  return out;
}
