import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Bot,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  Send,
  SquarePen,
  Square,
  Trash2,
  User,
  X,
  FileText,
  ChevronDown,
} from 'lucide-react'
import { aiChatApi, sendChatMessage } from '@/api/aiChat'
import { useToast } from '@/context/ToastContext'
import { extractApiError } from '@/api/client'
import { cn, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ChatListItem, ChatModel } from '@/types'

// ---------------------------------------------------------------------------
// Local message shape used for rendering (independent of the persisted
// question/answer pair shape returned by the detail endpoint)
// ---------------------------------------------------------------------------

type UIMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  pending?: boolean
  error?: boolean
}

type PendingFile = {
  id: string
  name: string
  size: number
}

function conversationsToMessages(chat: { conversations: { id: string; question: string; answer: string }[] }): UIMessage[] {
  return chat.conversations.flatMap((c) => [
    { id: `${c.id}-q`, role: 'user' as const, content: c.question },
    { id: `${c.id}-a`, role: 'assistant' as const, content: c.answer },
  ])
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Chat() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const { chatId: routeChatId } = useParams<{ chatId?: string }>()

  const [chats, setChats] = useState<ChatListItem[]>([])
  const [chatsLoading, setChatsLoading] = useState(true)
  const [activeChatId, setActiveChatId] = useState<string | undefined>(routeChatId)

  const [messages, setMessages] = useState<UIMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)

  const [models, setModels] = useState<ChatModel[]>([])
  const [selectedModel, setSelectedModel] = useState<string | undefined>()

  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // -------------------------------------------------------------------------
  // Load chat list + models
  // -------------------------------------------------------------------------

  const fetchChats = useCallback(async () => {
    setChatsLoading(true)
    try {
      const res = await aiChatApi.list()
      setChats(res)
    } catch (err) {
      toast(extractApiError(err), 'error')
    } finally {
      setChatsLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchChats() }, [fetchChats])

  useEffect(() => {
    aiChatApi.models()
      .then((res) => {
        setModels(res)
        if (res.length > 0) setSelectedModel((prev) => prev ?? res[0].name)
      })
      .catch(() => { /* non-fatal */ })
  }, [])

  // -------------------------------------------------------------------------
  // Load active chat's messages
  // -------------------------------------------------------------------------

  useEffect(() => {
    setActiveChatId(routeChatId)
    if (!routeChatId) {
      setMessages([])
      return
    }
    setMessagesLoading(true)
    aiChatApi.detail(routeChatId)
      .then((chat) => setMessages(conversationsToMessages(chat)))
      .catch((err) => toast(extractApiError(err), 'error'))
      .finally(() => setMessagesLoading(false))
  }, [routeChatId, toast])

  // Auto-scroll on new content
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  // -------------------------------------------------------------------------
  // Sending
  // -------------------------------------------------------------------------

  const startNewChat = () => {
    if (streaming) return
    setActiveChatId(undefined)
    setMessages([])
    navigate('/chat')
    textareaRef.current?.focus()
  }

  const handleSend = async () => {
    const question = input.trim()
    if (!question || streaming) return

    const userMsg: UIMessage = { id: `local-${Date.now()}-u`, role: 'user', content: question }
    const assistantMsg: UIMessage = { id: `local-${Date.now()}-a`, role: 'assistant', content: '', pending: true }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setInput('')
    setPendingFiles([])
    setStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      await sendChatMessage(
        { question, chatId: activeChatId, model: selectedModel },
        {
          onToken: (text) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: m.content + text } : m)),
            )
          },
          onMeta: (chatId, chatTitle) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsg.id ? { ...m, pending: false } : m)),
            )
            if (!activeChatId) {
              setActiveChatId(chatId)
              navigate(`/chat/${chatId}`, { replace: true })
              setChats((prev) => [
                {
                  id: chatId,
                  chatTitle,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  deletedAt: null,
                  customerId: '',
                },
                ...prev,
              ])
            } else {
              setChats((prev) =>
                prev.map((c) => (c.id === chatId ? { ...c, updatedAt: new Date().toISOString() } : c)),
              )
            }
          },
        },
        controller.signal,
      )
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        toast(extractApiError(err), 'error')
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, pending: false, error: true, content: m.content || 'Something went wrong generating a response.' }
              : m,
          ),
        )
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  const handleStop = () => {
    abortRef.current?.abort()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // -------------------------------------------------------------------------
  // Chat management
  // -------------------------------------------------------------------------

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this chat? This cannot be undone.')) return
    try {
      await aiChatApi.remove(id)
      setChats((prev) => prev.filter((c) => c.id !== id))
      if (activeChatId === id) startNewChat()
      toast('Chat deleted', 'success')
    } catch (err) {
      toast(extractApiError(err), 'error')
    }
  }

  const startRename = (chat: ChatListItem) => {
    setRenamingId(chat.id)
    setRenameValue(chat.chatTitle)
  }

  const submitRename = async (id: string) => {
    const title = renameValue.trim()
    setRenamingId(null)
    if (!title) return
    const prevChats = chats
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, chatTitle: title } : c)))
    try {
      await aiChatApi.updateTitle({ chatId: id, title })
    } catch (err) {
      setChats(prevChats)
      toast(extractApiError(err), 'error')
    }
  }

  // -------------------------------------------------------------------------
  // File attachments
  // -------------------------------------------------------------------------

  const handleFilesSelected = (files: FileList | null) => {
    if (!files) return
    const next = Array.from(files).map((f) => ({
      id: `${f.name}-${f.size}-${Date.now()}`,
      name: f.name,
      size: f.size,
    }))
    setPendingFiles((prev) => [...prev, ...next])
    // Wire this up to aiChatApi.uploadDocument(file) once the upload
    // endpoint contract is confirmed — see notes.
  }

  const removePendingFile = (id: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.id !== id))
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 shrink-0 border-r border-border bg-muted/20 flex flex-col">
        <div className="p-3 border-b border-border">
          <Button className="w-full justify-start" variant="outline" onClick={startNewChat}>
            <SquarePen className="h-4 w-4" />
            New chat
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {chatsLoading ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">Loading chats…</div>
          ) : chats.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">No chats yet.</div>
          ) : (
            chats.map((chat) => {
              const isActive = chat.id === activeChatId
              const isRenaming = renamingId === chat.id
              return (
                <div
                  key={chat.id}
                  className={cn(
                    'group flex items-center gap-1.5 rounded-md px-2.5 py-2 cursor-pointer text-sm transition-colors',
                    isActive ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                  )}
                  onClick={() => !isRenaming && navigate(`/chat/${chat.id}`)}
                >
                  {isRenaming ? (
                    <Input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitRename(chat.id)
                        if (e.key === 'Escape') setRenamingId(null)
                      }}
                      onBlur={() => submitRename(chat.id)}
                      className="h-7 text-sm"
                    />
                  ) : (
                    <>
                      <span className="truncate flex-1">{chat.chatTitle}</span>
                      <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                        <button
                          className="p-1 rounded hover:bg-background text-muted-foreground hover:text-foreground"
                          onClick={(e) => { e.stopPropagation(); startRename(chat) }}
                          title="Rename"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="p-1 rounded hover:bg-background text-muted-foreground hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); handleDelete(chat.id) }}
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )
            })
          )}
        </div>
      </aside>

      {/* Main panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {messagesLoading ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              Loading conversation…
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-6">
              <Bot className="h-8 w-8 text-muted-foreground/50" />
              <p className="font-display text-lg text-foreground">Ask anything.</p>
              <p className="text-sm text-muted-foreground max-w-sm">
                Questions about accounts, ledgers, or reports — or attach a document for context.
              </p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-border bg-background p-3 sm:p-4">
          <div className="max-w-3xl mx-auto">
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {pendingFiles.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs"
                  >
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="max-w-[140px] truncate">{f.name}</span>
                    <button onClick={() => removePendingFile(f.id)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2 rounded-lg border border-border bg-card p-2 shadow-sm focus-within:ring-1 focus-within:ring-ring">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="Attach documents"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => { handleFilesSelected(e.target.files); e.target.value = '' }}
              />

              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message…"
                className="flex-1 resize-none bg-transparent text-sm outline-none py-2 max-h-40 placeholder:text-muted-foreground"
              />

              {streaming ? (
                <Button size="icon" variant="destructive" onClick={handleStop} title="Stop generating">
                  <Square className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button size="icon" onClick={handleSend} disabled={!input.trim()} title="Send">
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="flex items-center justify-between mt-2 px-1">
              <ModelPicker models={models} selected={selectedModel} onSelect={setSelectedModel} />
              <span className="text-[11px] text-muted-foreground">Enter to send, Shift+Enter for a new line</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MessageBubble
// ---------------------------------------------------------------------------

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === 'user'
  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'shrink-0 h-7 w-7 rounded-full flex items-center justify-center',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
        )}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>
      <div
        className={cn(
          'rounded-lg px-3.5 py-2.5 text-sm leading-relaxed max-w-[85%] whitespace-pre-wrap',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-foreground',
          message.error && 'border border-destructive/50 text-destructive',
        )}
      >
        {message.content}
        {message.pending && !message.content && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ModelPicker
// ---------------------------------------------------------------------------

function ModelPicker({
  models,
  selected,
  onSelect,
}: {
  models: ChatModel[]
  selected?: string
  onSelect: (name: string) => void
}) {
  if (models.length === 0) return <span />
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-mono">
          {selected ?? 'Select model'}
          <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {models.map((m) => (
          <DropdownMenuItem key={m.name} onClick={() => onSelect(m.name)}>
            {m.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}