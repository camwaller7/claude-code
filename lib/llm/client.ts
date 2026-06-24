import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import Groq from 'groq-sdk'
import type { LLMProvider } from '@/types'

export interface LLMRequest {
  provider: LLMProvider
  model: string
  system: string
  prompt: string
  maxTokens?: number
}

export interface LLMResponse {
  text: string
  inputTokens: number
  outputTokens: number
}

export async function llmComplete(req: LLMRequest): Promise<LLMResponse> {
  switch (req.provider) {
    case 'anthropic': return anthropicComplete(req)
    case 'openai': return openaiComplete(req)
    case 'google': return googleComplete(req)
    case 'groq': return groqComplete(req)
    default: throw new Error(`Unknown provider: ${req.provider}`)
  }
}

async function anthropicComplete(req: LLMRequest): Promise<LLMResponse> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const res = await client.messages.create({
    model: req.model,
    max_tokens: req.maxTokens ?? 1024,
    system: req.system,
    messages: [{ role: 'user', content: req.prompt }],
  })
  const text = res.content.filter(b => b.type === 'text').map(b => (b as { type: 'text'; text: string }).text).join('')
  return { text, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens }
}

async function openaiComplete(req: LLMRequest): Promise<LLMResponse> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const res = await client.chat.completions.create({
    model: req.model,
    max_tokens: req.maxTokens ?? 1024,
    messages: [
      { role: 'system', content: req.system },
      { role: 'user', content: req.prompt },
    ],
  })
  const text = res.choices[0]?.message?.content ?? ''
  return {
    text,
    inputTokens: res.usage?.prompt_tokens ?? 0,
    outputTokens: res.usage?.completion_tokens ?? 0,
  }
}

async function googleComplete(req: LLMRequest): Promise<LLMResponse> {
  const client = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY ?? '')
  const model = client.getGenerativeModel({ model: req.model, systemInstruction: req.system })
  const res = await model.generateContent(req.prompt)
  const text = res.response.text()
  const usage = res.response.usageMetadata
  return {
    text,
    inputTokens: usage?.promptTokenCount ?? 0,
    outputTokens: usage?.candidatesTokenCount ?? 0,
  }
}

async function groqComplete(req: LLMRequest): Promise<LLMResponse> {
  const client = new Groq({ apiKey: process.env.GROQ_API_KEY })
  const res = await client.chat.completions.create({
    model: req.model,
    max_tokens: req.maxTokens ?? 1024,
    messages: [
      { role: 'system', content: req.system },
      { role: 'user', content: req.prompt },
    ],
  })
  const text = res.choices[0]?.message?.content ?? ''
  return {
    text,
    inputTokens: res.usage?.prompt_tokens ?? 0,
    outputTokens: res.usage?.completion_tokens ?? 0,
  }
}
