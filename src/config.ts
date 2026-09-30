export interface Config { port: number; provider: 'mock' | 'openai'; providerFellBack: boolean; openaiKey?: string; openaiBase: string; openaiModel: string; dbPath: string; llmTimeoutMs: number }
/** Secrets come from env only. openai is activated ONLY when a key is present; otherwise fall back to mock. */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const wantsOpenai = env.AI_PROVIDER === 'openai';
  const key = env.OPENAI_API_KEY?.trim();
  const usable = wantsOpenai && !!key && !key.startsWith('replace-me');
  return {
    port: Number(env.PORT) || 3000, provider: usable ? 'openai' : 'mock', providerFellBack: wantsOpenai && !usable,
    openaiKey: usable ? key : undefined, openaiBase: env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    openaiModel: env.OPENAI_MODEL || 'gpt-4o-mini', dbPath: env.DB_PATH || 'data/healtrip.db',
    llmTimeoutMs: Number(env.LLM_TIMEOUT_MS) || 15000,
  };
}
