export type Platform = 'instagram' | 'facebook' | 'x' | 'threads' | 'tiktok' | 'gmail' | 'telegram'

export type MessageCategory = 'brand_deal' | 'client' | 'fan' | 'spam' | 'uncategorized'

export type MessageStatus = 'needs_reply' | 'replied' | 'archived'

export type DealStatus = 'inquiry' | 'negotiating' | 'contracted' | 'delivered' | 'paid' | 'lost'

export type ClientStatus = 'active' | 'churned' | 'refunded'

export type PostStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed'

export interface PlatformConnection {
  id: string
  platform: Platform
  account_id: string
  access_token: string
  refresh_token: string | null
  expires_at: string | null
  connected_at: string
}

export interface Conversation {
  id: string
  platform: Platform
  external_thread_id: string
  contact_name: string
  contact_handle: string
  category: MessageCategory
  status: MessageStatus
  priority: number
  last_message_at: string
  created_at: string
}

export interface Message {
  id: string
  conversation_id: string
  direction: 'inbound' | 'outbound'
  body: string
  ai_category: MessageCategory | null
  ai_draft_reply: string | null
  sent_at: string
  created_at: string
}

export interface Deal {
  id: string
  conversation_id: string | null
  brand_name: string
  contact_name: string
  status: DealStatus
  deal_value: number | null
  currency: string
  agreed_date: string | null
  payment_due_date: string | null
  notes: string | null
  created_at: string
}

export interface CreatorClient {
  id: string
  conversation_id: string | null
  name: string
  handle: string
  product_purchased: string
  purchase_date: string | null
  status: ClientStatus
  notes: string | null
  age: number | null
  gender: string | null
  job_title: string | null
  location: string | null
  email: string | null
  phone: string | null
  goals: string | null
  preferences: string | null
  important_dates: string | null
  ai_context: string | null
  created_at: string
}

export interface Post {
  id: string
  caption: string
  hashtags: string
  media_url: string | null
  platforms: Platform[]
  scheduled_at: string | null
  status: PostStatus
  published_at: string | null
  platform_post_ids: Record<string, string> | null
  created_at: string
}

export type LLMProvider = 'anthropic' | 'openai' | 'google' | 'groq'

export interface LLMModel {
  provider: LLMProvider
  id: string
  label: string
  contextWindow: number
  inputPricePer1k: number
  outputPricePer1k: number
}

export interface AppSettings {
  id: number
  llm_provider: LLMProvider
  llm_model: string
}

export interface TokenUsage {
  id: string
  provider: string
  model: string
  feature: string
  input_tokens: number
  output_tokens: number
  created_at: string
}
