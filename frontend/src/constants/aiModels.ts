// Selectable AI model options, shared across the platform (super-admin) and
// tenant AI settings dropdowns. Add new providers/models here in one place.
//
// "OpenAI Compatible" providers (e.g. MiniMax served via https://ollama.com/v1)
// require a base URL to be set alongside the API key so the OpenAI SDK targets
// the right endpoint. See the AI settings "OpenAI-compatible base URL" field.

export interface AIModelOption {
  value: string;
  label: string;
  /** Provider label shown for context; "OpenAI" is the default api.openai.com. */
  provider?: string;
}

export const AI_MODEL_OPTIONS: AIModelOption[] = [
  { value: "gpt-4o-mini",   label: "GPT-4o Mini — fast & affordable", provider: "OpenAI" },
  { value: "gpt-4o",        label: "GPT-4o — most capable",           provider: "OpenAI" },
  { value: "gpt-4-turbo",   label: "GPT-4 Turbo",                      provider: "OpenAI" },
  { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo — cheapest",         provider: "OpenAI" },
  { value: "minimax-m3",    label: "MiniMax M3 (OpenAI Compatible)",   provider: "OpenAI Compatible" },
];

// Suggested base URL for the OpenAI-compatible provider used by MiniMax M3.
export const OPENAI_COMPATIBLE_BASE_URL = "https://ollama.com/v1";
