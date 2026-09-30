import { z } from 'zod';
export const LangSchema = z.enum(['en', 'ar']);
export const ChatRequest = z.object({
  sessionId: z.string().regex(/^[\w-]{8,64}$/).optional(),
  message: z.string().trim().min(1).max(1000),
  language: LangSchema.default('en'),
}).strict();
const Urgency = z.enum(['emergency', 'urgent', 'routine', 'unclear']);
const Action = z.enum(['seek_emergency_care', 'consult_specialist', 'seek_second_opinion', 'monitor_and_consult', 'ask_questions']);
/** What the LLM may produce. No doctor/hospital fields exist here by design. */
export const DecisionDraft = z.object({
  urgency: Urgency, recommended_action: Action, specialty: z.string().max(80).nullable(),
  reason: z.string().min(1).max(600), questions: z.array(z.string().max(300)).max(3), confidence: z.enum(['low', 'medium', 'high']),
}).strict();
/** What the server returns. sources + disclaimer are always server-generated. */
export const Decision = DecisionDraft.extend({ type: z.literal('decision'), sources: z.array(z.string()), disclaimer: z.string().min(1) });
const Rec = z.object({ id: z.string() }).passthrough();
export const ChatResponse = z.object({
  sessionId: z.string(), message: z.string(), decision: Decision, emergency: z.boolean(), demoData: z.literal(true),
  recommendations: z.object({ doctors: z.array(Rec), hospitals: z.array(Rec) }),
  toolCalls: z.array(z.object({ name: z.string(), ok: z.boolean(), resultCount: z.number(), ms: z.number() })),
  suggestedReplies: z.array(z.string()),
});
export type ChatResponseT = z.infer<typeof ChatResponse>;
export type DecisionT = z.infer<typeof Decision>;
export const SearchQuery = z.object({
  specialty: z.string().trim().min(1).max(80).optional(), city: z.string().trim().min(1).max(80).optional(),
  language: z.string().regex(/^[A-Za-z]{2,20}$/).optional(),
});
