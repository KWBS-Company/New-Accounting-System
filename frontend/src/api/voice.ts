import apiClient from './client'

/** Returns WAV audio for the text, or null if no voice exists for its language. */
export async function speakText(text: string, language?: string): Promise<Blob | null> {
  const res = await apiClient.post(
    '/ai-chat/voice/speak',
    { text, language },
    { responseType: 'blob', validateStatus: (s) => s === 200 || s === 204 },
  )
  return res.status === 204 ? null : (res.data as Blob)
}
