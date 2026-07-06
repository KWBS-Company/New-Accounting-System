import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Bot,
  Check,
  Copy,
  Paperclip,
  Pencil,
  Send,
  SquarePen,
  Square,
  Trash2,
  User,
  X,
  FileText,
  AlertCircle,
  ChevronDown,
  Loader2,
} from 'lucide-react'
import { aiChatApi, sendChatMessage } from '@/api/aiChat'
import { useToast } from '@/context/ToastContext'
import { extractApiError } from '@/api/client'
import { cn } from '@/lib/utils'
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
// Local types
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
  status: 'uploading' | 'done' | 'error'
  attachmentId?: string
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
              prev.map((m) =>
                m.id === assistantMsg.id ? { ...m, content: m.content + text, pending: false } : m,
              ),
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

  const handleStop = () => abortRef.current?.abort()

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
  // File attachments — actually calls the upload API now
  // -------------------------------------------------------------------------

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const fileArray = Array.from(files)

    const entries: PendingFile[] = fileArray.map((f) => ({
      id: `${f.name}-${f.size}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: f.name,
      size: f.size,
      status: 'uploading',
    }))
    setPendingFiles((prev) => [...prev, ...entries])

    await Promise.all(
      fileArray.map(async (file, i) => {
        const entryId = entries[i].id
        try {
          const res = await aiChatApi.uploadDocument(file)
          setPendingFiles((prev) =>
            prev.map((f) => (f.id === entryId ? { ...f, status: 'done', attachmentId: res.id } : f)),
          )
        } catch (err) {
          setPendingFiles((prev) => prev.map((f) => (f.id === entryId ? { ...f, status: 'error' } : f)))
          toast(extractApiError(err), 'error')
        }
      }),
    )
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
                    className={cn(
                      'flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs',
                      f.status === 'error'
                        ? 'border-destructive/40 bg-destructive/10 text-destructive'
                        : 'border-border bg-muted/40',
                    )}
                  >
                    {f.status === 'uploading' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    ) : f.status === 'error' ? (
                      <AlertCircle className="h-3.5 w-3.5" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
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
// MessageBubble — with copy button + thinking animation + markdown
// ---------------------------------------------------------------------------

function MessageBubble({ message }: { message: UIMessage }) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'
  const showThinking = message.pending && !message.content

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast('Could not copy to clipboard', 'error')
    }
  }

  return (
    <div className={cn('group flex gap-3', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'shrink-0 h-7 w-7 rounded-full flex items-center justify-center',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
        )}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>

      <div className={cn('flex flex-col gap-1 max-w-[85%]', isUser && 'items-end')}>
        <div
          className={cn(
            'rounded-lg px-3.5 py-2.5 text-sm leading-relaxed',
            isUser ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-foreground',
            message.error && 'border border-destructive/50 text-destructive',
          )}
        >
          {showThinking ? (
            <ThinkingDots />
          ) : isUser ? (
            <span className="whitespace-pre-wrap">{message.content}</span>
          ) : (
            <MarkdownContent text={message.content} />
          )}
        </div>

        {!showThinking && message.content && (
          <button
            onClick={handleCopy}
            className={cn(
              'flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-opacity px-1',
              'opacity-0 group-hover:opacity-100',
            )}
            title="Copy"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
    </div>
  )
}

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-0.5">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" />
    </span>
  )
}

// ---------------------------------------------------------------------------
// Minimal markdown renderer — bold, italic, inline code, code blocks,
// bullet/numbered lists, headings. No external dependency required.
// ---------------------------------------------------------------------------

function MarkdownContent({ text }: { text: string }) {
  const parts: React.ReactNode[] = []
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let blockIdx = 0

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<TextBlock key={`t-${blockIdx}`} text={text.slice(lastIndex, match.index)} keyPrefix={`t-${blockIdx}`} />)
    }
    parts.push(
      <pre key={`code-${blockIdx}`} className="rounded-md bg-background/60 border border-border p-3 overflow-x-auto text-xs font-mono my-2">
        <code>{match[2].replace(/\n$/, '')}</code>
      </pre>,
    )
    lastIndex = match.index + match[0].length
    blockIdx++
  }
  if (lastIndex < text.length) {
    parts.push(<TextBlock key={`t-${blockIdx}`} text={text.slice(lastIndex)} keyPrefix={`t-${blockIdx}`} />)
  }

  return <div className="space-y-1">{parts}</div>
}

function TextBlock({ text, keyPrefix }: { text: string; keyPrefix: string }) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let listBuffer: string[] = []
  let listType: 'ul' | 'ol' | null = null
  let paraBuffer: string[] = []
  let idx = 0

  const flushPara = () => {
    if (paraBuffer.length === 0) return
    const joined = paraBuffer.join(' ').trim()
    if (joined) {
      elements.push(
        <p key={`${keyPrefix}-p-${idx}`} className="mb-2 last:mb-0">
          {renderInline(joined, `${keyPrefix}-p-${idx}`)}
        </p>,
      )
      idx++
    }
    paraBuffer = []
  }

  const flushList = () => {
    if (listBuffer.length === 0) return
    const items = listBuffer
    const type = listType
    elements.push(
      type === 'ol' ? (
        <ol key={`${keyPrefix}-l-${idx}`} className="mb-2 last:mb-0 pl-5 space-y-0.5 list-decimal">
          {items.map((item, i) => <li key={i}>{renderInline(item, `${keyPrefix}-li-${idx}-${i}`)}</li>)}
        </ol>
      ) : (
        <ul key={`${keyPrefix}-l-${idx}`} className="mb-2 last:mb-0 pl-5 space-y-0.5 list-disc">
          {items.map((item, i) => <li key={i}>{renderInline(item, `${keyPrefix}-li-${idx}-${i}`)}</li>)}
        </ul>
      ),
    )
    idx++
    listBuffer = []
    listType = null
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    const headingMatch = /^(#{1,6})\s+(.*)/.exec(line)
    const ulMatch = /^[-*]\s+(.*)/.exec(line)
    const olMatch = /^\d+\.\s+(.*)/.exec(line)

    if (headingMatch) {
      flushList(); flushPara()
      const level = headingMatch[1].length
      elements.push(
        <div
          key={`${keyPrefix}-h-${idx}`}
          className={cn('font-semibold mt-2 first:mt-0 mb-1', level <= 2 ? 'text-[15px]' : 'text-sm')}
        >
          {renderInline(headingMatch[2], `${keyPrefix}-h-${idx}`)}
        </div>,
      )
      idx++
    } else if (ulMatch) {
      flushPara()
      if (listType !== 'ul') flushList()
      listType = 'ul'
      listBuffer.push(ulMatch[1])
    } else if (olMatch) {
      flushPara()
      if (listType !== 'ol') flushList()
      listType = 'ol'
      listBuffer.push(olMatch[1])
    } else if (line === '') {
      flushList(); flushPara()
    } else {
      flushList()
      paraBuffer.push(line)
    }
  }
  flushList()
  flushPara()

  return <>{elements}</>
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let i = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    const token = match[0]
    if (token.startsWith('**')) {
      nodes.push(<strong key={`${keyPrefix}-b-${i++}`}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('`')) {
      nodes.push(
        <code key={`${keyPrefix}-c-${i++}`} className="rounded bg-background/60 px-1 py-0.5 text-[0.85em] font-mono">
          {token.slice(1, -1)}
        </code>,
      )
    } else {
      nodes.push(<em key={`${keyPrefix}-i-${i++}`}>{token.slice(1, -1)}</em>)
    }
    lastIndex = match.index + token.length
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
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