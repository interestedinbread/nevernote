"use client"

import { FormEvent, useRef, useState } from "react"
import { htmlToPlainText } from "@/app/lib/format/htmlToPlainText"

type RagQuerySource = {
  id: string
  noteId: string
  title: string
  notebookId: string
  chunkId: string
  excerpt: string
  distance: number | null
}

type ChatMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; sources: RagQuerySource[] }

interface ChatPanelProps {
  onOpenSource: (source: Pick<RagQuerySource, "noteId" | "notebookId" | "title">) => void
  notebookId?: string | null
}

export function ChatPanel({ onOpenSource, notebookId }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      })
    })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const query = draft.trim()
    if (!query || loading) return

    setError(null)
    setDraft("")
    setMessages((prev) => [...prev, { role: "user", content: query }])
    setLoading(true)
    scrollToBottom()

    try {
      const body: { query: string; notebookId?: string } = { query }
      if (notebookId) {
        body.notebookId = notebookId
      }

      const res = await fetch("/api/rag/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const json = (await res.json()) as {
        data?: { answer: string; sources: RagQuerySource[] }
        error?: string
      }

      if (!res.ok) {
        throw new Error(json.error ?? "Something went wrong")
      }

      const answer = json.data?.answer ?? ""
      const sources = json.data?.sources ?? []

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: answer, sources },
      ])
      scrollToBottom()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get an answer")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Ask your notes</h2>
        <p className="mt-1 text-xs text-muted">
          {notebookId
            ? "Searching the selected notebook only."
            : "Searching all indexed notes."}
        </p>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-4"
      >
        {messages.length === 0 && !loading && (
          <p className="text-sm text-muted">
            Ask a question about notes you have created or edited since RAG was
            enabled.
          </p>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={
              message.role === "user"
                ? "ml-6 rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-foreground"
                : "mr-2 space-y-2"
            }
          >
            {message.role === "user" ? (
              message.content
            ) : (
              <>
                <p className="whitespace-pre-wrap text-sm text-foreground">
                  {message.content}
                </p>
                {message.sources.length > 0 && (
                  <ul className="space-y-2 border-t border-border pt-2">
                    {message.sources.map((source) => (
                      <li key={source.id}>
                        <button
                          type="button"
                          onClick={() => onOpenSource(source)}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-left transition-colors hover:bg-surface-2"
                        >
                          <span className="block text-sm font-medium text-control">
                            {source.title}
                          </span>
                          <span className="mt-1 block text-xs text-muted line-clamp-2">
                            {htmlToPlainText(source.excerpt)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        ))}

        {loading && (
          <p className="text-sm text-muted" aria-live="polite">
            Searching your notes…
          </p>
        )}
      </div>

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="border-t border-border p-4 space-y-2"
      >
        {error && (
          <p className="text-xs text-red-400" role="alert">
            {error}
          </p>
        )}
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="What did I write about…?"
          rows={2}
          disabled={loading}
          className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:ring-2 focus:ring-focus-ring/50 disabled:opacity-60"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              formRef.current?.requestSubmit()
            }
          }}
        />
        <button
          type="submit"
          disabled={loading || draft.trim().length === 0}
          className="w-full rounded-lg border border-control-border bg-control-surface px-3 py-2 text-sm font-medium text-control hover:bg-control-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Thinking…" : "Ask"}
        </button>
      </form>
    </div>
  )
}
