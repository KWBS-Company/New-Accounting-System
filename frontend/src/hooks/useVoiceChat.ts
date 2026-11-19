import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { TOKEN_KEY } from '@/api/client'

export type VoiceState = 'off' | 'listening' | 'thinking' | 'speaking'

type Context = { chatId?: string; model?: string; targetLanguage?: string }
type Handlers = {
  onTranscript: (text: string, language: string) => void
  onToken: (text: string) => void
  onDone: (chatId: string, chatTitle: string) => void
  onError: (message: string) => void
}

const START_RMS = 0.04 // loudness that counts as speech
const BARGE_IN_RMS = 0.09 // higher bar while the assistant is speaking (avoids echo triggering)
const SILENCE_MS = 900 // quiet this long = end of utterance
const MIN_UTTERANCE_MS = 400

function socketOrigin(): string {
  const base = import.meta.env.VITE_API_URL ?? ''
  try {
    return new URL(base, window.location.origin).origin
  } catch {
    return window.location.origin
  }
}

export function useVoiceChat(getContext: () => Context, handlers: Handlers) {
  const [state, setState] = useState<VoiceState>('off')
  const stateRef = useRef<VoiceState>('off')
  const handlersRef = useRef(handlers)
  const contextRef = useRef(getContext)
  handlersRef.current = handlers
  contextRef.current = getContext

  const socketRef = useRef<Socket | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const timerRef = useRef<number | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const playQueue = useRef<string[]>([])
  const playerRef = useRef<HTMLAudioElement | null>(null)

  const set = (s: VoiceState) => {
    stateRef.current = s
    setState(s)
  }

  const stopPlayback = useCallback(() => {
    playQueue.current.forEach((u) => URL.revokeObjectURL(u))
    playQueue.current = []
    playerRef.current?.pause()
    playerRef.current = null
  }, [])

  const playNext = useCallback(() => {
    if (playerRef.current) return
    const url = playQueue.current.shift()
    if (!url) {
      if (stateRef.current === 'speaking') set('listening')
      return
    }
    const audio = new Audio(url)
    playerRef.current = audio
    set('speaking')
    const finish = () => {
      URL.revokeObjectURL(url)
      playerRef.current = null
      playNext()
    }
    audio.onended = finish
    audio.onerror = finish
    void audio.play().catch(finish)
  }, [])

  const stop = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current)
    timerRef.current = null
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.onstop = null
      recorderRef.current.stop()
    }
    recorderRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    void audioCtxRef.current?.close()
    audioCtxRef.current = null
    socketRef.current?.emit('voice:cancel')
    socketRef.current?.disconnect()
    socketRef.current = null
    stopPlayback()
    set('off')
  }, [stopPlayback])

  const start = useCallback(async () => {
    if (stateRef.current !== 'off') return
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
    } catch {
      handlersRef.current.onError('Microphone access was denied.')
      return
    }
    streamRef.current = stream

    const socket = io(`${socketOrigin()}/ai-chat/voice`, {
      auth: { token: localStorage.getItem(TOKEN_KEY) ?? '' },
    })
    socketRef.current = socket
    socket.on('voice:transcript', (m: { text: string; language: string }) => {
      set('thinking')
      handlersRef.current.onTranscript(m.text, m.language)
    })
    socket.on('voice:token', (m: { text: string }) => handlersRef.current.onToken(m.text))
    socket.on('voice:audio', (m: { audio: ArrayBuffer }) => {
      playQueue.current.push(URL.createObjectURL(new Blob([m.audio], { type: 'audio/wav' })))
      playNext()
    })
    socket.on('voice:done', (m: { chatId: string; chatTitle: string }) => {
      handlersRef.current.onDone(m.chatId, m.chatTitle)
      if (stateRef.current === 'thinking') set('listening')
    })
    socket.on('voice:error', (m: { message: string }) => {
      handlersRef.current.onError(m.message)
      if (stateRef.current === 'thinking') set('listening')
    })
    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        handlersRef.current.onError('Voice connection was rejected. Please sign in again.')
        stop()
      }
    })

    // Voice-activity detection: one MediaRecorder per utterance.
    const ctx = new AudioContext()
    audioCtxRef.current = ctx
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 1024
    ctx.createMediaStreamSource(stream).connect(analyser)
    const samples = new Uint8Array(analyser.fftSize)

    let startedAt = 0
    let lastVoiceAt = 0

    const beginUtterance = () => {
      chunksRef.current = []
      const rec = new MediaRecorder(stream)
      recorderRef.current = rec
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data)
      rec.onstop = async () => {
        const duration = Date.now() - startedAt
        const blob = new Blob(chunksRef.current, { type: rec.mimeType })
        recorderRef.current = null
        if (duration < MIN_UTTERANCE_MS || !socketRef.current) return
        set('thinking')
        socketRef.current.emit('voice:audio', {
          audio: await blob.arrayBuffer(),
          mimeType: rec.mimeType,
          ...contextRef.current(),
        })
      }
      startedAt = Date.now()
      rec.start()
    }

    timerRef.current = window.setInterval(() => {
      analyser.getByteTimeDomainData(samples)
      let sum = 0
      for (const v of samples) sum += ((v - 128) / 128) ** 2
      const rms = Math.sqrt(sum / samples.length)
      const now = Date.now()
      const threshold = stateRef.current === 'speaking' ? BARGE_IN_RMS : START_RMS

      if (rms > threshold) {
        lastVoiceAt = now
        if (!recorderRef.current) {
          if (stateRef.current === 'speaking' || stateRef.current === 'thinking') {
            socketRef.current?.emit('voice:cancel') // barge-in: interrupt the assistant
            stopPlayback()
          }
          beginUtterance()
        }
      } else if (recorderRef.current && now - lastVoiceAt > SILENCE_MS) {
        recorderRef.current.stop()
      }
    }, 50)

    set('listening')
  }, [playNext, stop, stopPlayback])

  useEffect(() => stop, [stop])

  return { state, start, stop }
}
