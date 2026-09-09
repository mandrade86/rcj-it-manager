export type LlmProvider = 'gemini' | 'ollama'

const DEFAULTS = {
  gemini: 'gemini-2.0-flash',
  ollama: 'llama3.2',
} as const

export function resolveLlmProvider(): LlmProvider {
  const explicit = process.env.LLM_PROVIDER?.trim().toLowerCase()
  if (explicit === 'openai') {
    throw new Error('OpenAI está desactivado en esta aplicación. Use gemini u ollama.')
  }
  if (explicit === 'gemini' || explicit === 'ollama') {
    return explicit
  }
  if (process.env.GEMINI_API_KEY?.trim()) return 'gemini'
  return 'ollama'
}

export function isLlmConfigured(): boolean {
  const explicit = process.env.LLM_PROVIDER?.trim().toLowerCase()
  if (explicit === 'openai') return false
  if (explicit === 'gemini') return Boolean(process.env.GEMINI_API_KEY?.trim())
  if (explicit === 'ollama') return true
  if (process.env.GEMINI_API_KEY?.trim()) return true
  return false
}

export function llmProviderLabel(provider: LlmProvider): string {
  switch (provider) {
    case 'gemini':
      return 'Google Gemini (gratis)'
    case 'ollama':
      return 'Ollama (local, gratis)'
  }
}

async function geminiCompletion(
  prompt: string,
  opts?: { maxTokens?: number; temperature?: number },
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY no configurada. Obtenga una gratis en https://aistudio.google.com/apikey',
    )
  }
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULTS.gemini
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: opts?.maxTokens ?? 2048,
        temperature: opts?.temperature ?? 0.2,
      },
    }),
  })

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    error?: { message?: string }
  }

  if (!res.ok) {
    throw new Error(`Gemini: ${data.error?.message ?? res.statusText}`)
  }

  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim() ?? ''
  if (!text) throw new Error('Gemini devolvió respuesta vacía.')
  return text
}

async function ollamaCompletion(
  prompt: string,
  opts?: { maxTokens?: number; temperature?: number },
): Promise<string> {
  const base = process.env.OLLAMA_BASE_URL?.trim() || 'http://127.0.0.1:11434'
  const model = process.env.OLLAMA_MODEL?.trim() || DEFAULTS.ollama

  let res: Response
  try {
    res = await fetch(`${base.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        options: {
          temperature: opts?.temperature ?? 0.2,
          num_predict: opts?.maxTokens ?? 2048,
        },
      }),
    })
  } catch {
    throw new Error(
      'Ollama no responde. Instálelo desde https://ollama.com, ejecute `ollama pull llama3.2` y deje Ollama corriendo.',
    )
  }

  const data = (await res.json()) as {
    message?: { content?: string }
    error?: string
  }

  if (!res.ok) {
    throw new Error(`Ollama: ${data.error ?? res.statusText}`)
  }

  const text = data.message?.content?.trim() ?? ''
  if (!text) throw new Error('Ollama devolvió respuesta vacía.')
  return text
}

/** Chat completion — gemini u ollama. OpenAI no está soportado. */
export async function llmChatCompletion(
  prompt: string,
  opts?: { maxTokens?: number; temperature?: number; provider?: LlmProvider },
): Promise<string> {
  const provider = opts?.provider ?? resolveLlmProvider()
  switch (provider) {
    case 'gemini':
      return geminiCompletion(prompt, opts)
    case 'ollama':
      return ollamaCompletion(prompt, opts)
  }
}
