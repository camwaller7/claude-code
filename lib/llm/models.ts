import type { LLMModel } from '@/types'

export const MODELS: LLMModel[] = [
  { provider: 'anthropic', id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', contextWindow: 200000, inputPricePer1k: 0.0008, outputPricePer1k: 0.004 },
  { provider: 'anthropic', id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', contextWindow: 200000, inputPricePer1k: 0.003, outputPricePer1k: 0.015 },
  { provider: 'anthropic', id: 'claude-opus-4-8', label: 'Claude Opus 4.8', contextWindow: 200000, inputPricePer1k: 0.015, outputPricePer1k: 0.075 },
  { provider: 'openai', id: 'gpt-4o-mini', label: 'GPT-4o Mini', contextWindow: 128000, inputPricePer1k: 0.00015, outputPricePer1k: 0.0006 },
  { provider: 'openai', id: 'gpt-4o', label: 'GPT-4o', contextWindow: 128000, inputPricePer1k: 0.0025, outputPricePer1k: 0.01 },
  { provider: 'openai', id: 'gpt-4-turbo', label: 'GPT-4 Turbo', contextWindow: 128000, inputPricePer1k: 0.01, outputPricePer1k: 0.03 },
  { provider: 'google', id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', contextWindow: 1000000, inputPricePer1k: 0.0001, outputPricePer1k: 0.0004 },
  { provider: 'google', id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', contextWindow: 2000000, inputPricePer1k: 0.00125, outputPricePer1k: 0.005 },
  { provider: 'groq', id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', contextWindow: 128000, inputPricePer1k: 0.00059, outputPricePer1k: 0.00079 },
  { provider: 'groq', id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B', contextWindow: 32768, inputPricePer1k: 0.00024, outputPricePer1k: 0.00024 },
]

export function getModel(id: string): LLMModel | undefined {
  return MODELS.find(m => m.id === id)
}

export function getModelsByProvider(provider: string): LLMModel[] {
  return MODELS.filter(m => m.provider === provider)
}
