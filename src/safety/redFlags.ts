// ILLUSTRATIVE prototype rules. NOT clinically validated. Requires clinical review before any production use.
// Runs BEFORE the agent/LLM. Deterministic: an LLM can escalate but can never downgrade a match.
interface Rule { id: string; re: RegExp }
const RULES: Rule[] = [
  { id: 'severe_chest_pain', re: /(severe|crushing|intense|worst|tight|شديد|ساحق).{0,25}(chest|صدر)|(chest|الصدر|صدري).{0,25}(severe|crushing|intense|worst|شديد)/i },
  { id: 'difficulty_breathing', re: /(difficulty|trouble|can'?t|cannot|struggling|hard).{0,15}breath|short(ness)? of breath|صعوبة (في )?التنفس|ضيق (في )?التنفس|لا أستطيع التنفس/i },
  { id: 'loss_of_consciousness', re: /loss of consciousness|lost consciousness|passed out|unconscious|unresponsive|fainted|فقدان الوعي|فقد الوعي|أغمي عليه|مغمى عليه|إغماء/i },
  { id: 'severe_bleeding', re: /(severe|heavy|uncontrolled|won'?t stop).{0,15}bleed|bleeding (heavily|a lot|won'?t stop)|نزيف (شديد|حاد)|ينزف بشدة/i },
  { id: 'stroke_like', re: /sudden.{0,20}(weakness|numbness)|face droop|drooping face|slurred speech|can'?t (speak|move (my )?(arm|leg))|ضعف مفاجئ|تنميل مفاجئ|تدلي الوجه|ثقل الكلام|صعوبة في الكلام/i },
];
const NEGATION = /(\bno|\bnot|without|never|n't have|بدون|لا يوجد|ليس)\s*(any\s*)?$/i;

/** Returns the first matching non-negated rule id, or null. */
export function checkRedFlags(text: string): { ruleId: string } | null {
  for (const { id, re } of RULES) {
    const g = new RegExp(re.source, 'gi');
    for (const m of text.matchAll(g)) {
      const before = text.slice(Math.max(0, (m.index ?? 0) - 15), m.index ?? 0);
      if (!NEGATION.test(before)) return { ruleId: id };
    }
  }
  return null;
}
export function interpretYesNo(text: string): 'yes' | 'no' | null {
  if (/^\s*(yes|yeah|yep|y|نعم|أجل|ايوه|أيوه)(?=[\s.,!،]|$)/i.test(text)) return 'yes';
  if (/^\s*(no|nope|n|لا|كلا)(?=[\s.,!،]|$)/i.test(text)) return 'no';
  return null;
}
