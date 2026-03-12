import Anthropic from '@anthropic-ai/sdk'

type LlmProvider = 'anthropic' | 'ollama'

interface GenerateTextArgs {
  system: string
  prompt: string
  maxTokens: number
}

const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001'

let anthropicClient: Anthropic | null = null

function resolveProvider(): LlmProvider {
  const explicit = (process.env.LLM_PROVIDER || '').toLowerCase()
  if (explicit === 'anthropic' || explicit === 'ollama') return explicit
  if (explicit) {
    throw new Error(`Unsupported LLM_PROVIDER "${explicit}". Use "anthropic" or "ollama".`)
  }

  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY
  const hasOllama = !!process.env.OLLAMA_MODEL

  if (hasAnthropic && !hasOllama) return 'anthropic'
  if (hasOllama && !hasAnthropic) return 'ollama'
  if (!hasAnthropic && !hasOllama) {
    throw new Error(
      'No LLM configured. Set LLM_PROVIDER and the corresponding env vars.'
    )
  }

  throw new Error(
    'Multiple LLM providers configured. Set LLM_PROVIDER=anthropic or LLM_PROVIDER=ollama.'
  )
}

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set.')
    }
    anthropicClient = new Anthropic({ apiKey })
  }
  return anthropicClient
}

async function generateWithAnthropic({
  system,
  prompt,
  maxTokens,
}: GenerateTextArgs): Promise<string> {
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL
  const client = getAnthropicClient()

  const message = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = message.content?.[0] as { text?: string } | undefined
  const text = content?.text?.trim() ?? ''
  if (!text) {
    throw new Error('Anthropic returned empty content.')
  }
  return text
}

async function generateWithOllama({
  system,
  prompt,
  maxTokens,
}: GenerateTextArgs): Promise<string> {
  const baseUrl = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434')
    .replace(/\/+$/, '')
  const model = process.env.OLLAMA_MODEL
  if (!model) {
    throw new Error('OLLAMA_MODEL is not set.')
  }

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      options: { num_predict: maxTokens },
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Ollama error ${res.status}: ${body.slice(0, 200)}`)
  }

  const json = (await res.json()) as { message?: { content?: string } }
  const text = json?.message?.content?.trim() ?? ''
  if (!text) {
    throw new Error('Ollama returned empty content.')
  }
  return text
}

export async function generateText(args: GenerateTextArgs): Promise<string> {
  const provider = resolveProvider()
  if (provider === 'anthropic') return generateWithAnthropic(args)
  return generateWithOllama(args)
}
