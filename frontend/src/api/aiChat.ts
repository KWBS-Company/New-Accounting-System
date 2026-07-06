import apiClient, { TOKEN_KEY } from './client'

import type {
  ChatListItem,
  ChatDetail,
  ChatModel,
  UpdateChatTitlePayload,
  ChatAttachment,
} from '@/types'

const BASE = '/ai-chat'

export const aiChatApi = {
  list: async (): Promise<ChatListItem[]> => {
    const res = await apiClient.get(BASE)
    return res.data
  },

  detail: async (chatId: string): Promise<ChatDetail> => {
    const res = await apiClient.get(`${BASE}/${chatId}`)
    return res.data
  },

  models: async (): Promise<ChatModel[]> => {
    const res = await apiClient.get(`${BASE}/all/models`)
    return res.data
  },

  updateTitle: async (payload: UpdateChatTitlePayload) => {
    const res = await apiClient.patch(`${BASE}/title`, payload)
    return res.data
  },

  remove: async (chatId: string) => {
    const res = await apiClient.delete(`${BASE}/${chatId}`)
    return res.data
  },

  // Assumption — see notes below. Adjust path/field names to match your backend.
  uploadDocument: async (file: File): Promise<ChatAttachment> => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await apiClient.post(`${BASE}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },
}

// ---------------------------------------------------------------------------
// Streaming
// ---------------------------------------------------------------------------

export type SendChatPayload = {
  question: string
  chatId?: string
  model?: string
}

type StreamHandlers = {
  onToken: (text: string) => void
  onMeta: (chatId: string, chatTitle: string) => void
}

/**
 * POSTs to /ai-chat and reads the SSE-style stream
 * (`data: {"text":"..."}` lines, terminated by a `data: {"type":"meta",...}` line).
 * Uses raw fetch since axios can't consume a ReadableStream in the browser.
 */
export async function sendChatMessage(
  payload: SendChatPayload,
  { onToken, onMeta }: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const token = localStorage.getItem(TOKEN_KEY)
  const baseUrl = import.meta.env.VITE_API_URL ?? ''

  const res = await fetch(`${baseUrl}${BASE}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
    signal,
  })

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Request failed (${res.status})`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? '' // keep the last (possibly partial) line

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line.startsWith('data:')) continue

      const jsonStr = line.slice(5).trim()
      if (!jsonStr) continue

      try {
        const parsed = JSON.parse(jsonStr)
        if (parsed.type === 'meta') {
          onMeta(parsed.chatId, parsed.chatTitle)
        } else if (typeof parsed.text === 'string') {
          onToken(parsed.text)
        }
      } catch {
        // ignore malformed chunk
      }
    }
  }
}
