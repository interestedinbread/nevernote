"use client"

import { SetStateAction, useState, Dispatch, useEffect, useRef, useCallback } from "react"
import { Note } from "@/lib/types/api"
import { RichTextEditor, type RichTextEditorHandle } from "./RichTextEditor"
import type { RefetchNotesState } from "@/app/lib/types"


interface EditNotePanelProps {
    selectedNoteId: string | null,
    setSelectedNoteId: Dispatch<SetStateAction<string | null>>
    selectedNotebookId: string | null,
    setRefetchNotes: Dispatch<SetStateAction<RefetchNotesState>>
    notes: Note[] | []
}



export function EditNotePanel ({
    selectedNoteId,
    selectedNotebookId,
    setRefetchNotes,
    notes,
    setSelectedNoteId,
}: EditNotePanelProps) {

    const [title, setTitle] = useState('')
    const [content, setContent] = useState('')
    const [message, setMessage] = useState('')
    const [, setLoading] = useState(false)
    const [isLoadingNote, setIsLoadingNote] = useState(false)
    const lastSavedRef = useRef<string>("")
    const lastHydratedNoteIdRef = useRef<string>("")
    const suppressRteOnChangeRef = useRef(false)
    const editorRef = useRef<RichTextEditorHandle>(null)
    
    const handleEditNote = useCallback(
        async (
            title: string,
            content: string,
            selectedNotebookId: string | null,
            selectedNoteId: string | null
        ) => {
            try {
                setLoading(true)
                setMessage("")

                const res = await fetch(`/api/notes/${selectedNoteId}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        title,
                        content,
                        notebookId: selectedNotebookId,
                    }),
                })

                if (!res.ok) {
                    throw new Error("Error updating note")
                }

                void (await res.json())
                
                setRefetchNotes((prev) => ({
                    key: prev.key + 1,
                    reason: "note-updated",
                }))

                return true
            } catch (err) {
                console.error(err)
                return false
            } finally {
                setLoading(false)
            }
        },
        [setRefetchNotes]
    )

    const handleDeleteNote = async (id: string) => {

        try{
            const noteTitle = title
            setLoading(true)
            setTitle('')
            setContent('')
            const res = await fetch(`/api/notes/${id}`, {
                method: "DELETE"
            })

            if(!res.ok){
                throw new Error('Error deleting note')
            }

            setMessage(`${noteTitle} deleted`)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
            setSelectedNoteId(null)
            setRefetchNotes(prev => ({ key: prev.key + 1, reason: "note-deleted"}))
        }
    }

    // Load the open note from the API so we are not racing the notes list (clears, refetches, notebooks loading).
    useEffect(() => {
        if (!selectedNoteId) {
            lastHydratedNoteIdRef.current = ""
            setTitle("")
            setContent("")
            setIsLoadingNote(false)
            return
        }

        let cancelled = false
        setIsLoadingNote(true)

        ;(async () => {
            try {
                const res = await fetch(`/api/notes/${selectedNoteId}`)
                if (!res.ok) {
                    throw new Error("Failed to load note")
                }
                const parsed = await res.json()
                const note = parsed.data as Note | undefined
                if (cancelled || !note) return

                suppressRteOnChangeRef.current = true
                setTitle(note.title ?? "")
                setContent(note.content ?? "")
                lastHydratedNoteIdRef.current = selectedNoteId
                lastSavedRef.current = JSON.stringify({
                    title: note.title ?? "",
                    content: note.content ?? "",
                    selectedNoteId,
                })
                window.setTimeout(() => {
                    suppressRteOnChangeRef.current = false
                }, 0)
            } catch (e) {
                if (!cancelled) {
                    console.error(e)
                    setMessage("Note not found")
                }
            } finally {
                if (!cancelled) {
                    setIsLoadingNote(false)
                }
            }
        })()

        return () => {
            cancelled = true
            setIsLoadingNote(false)
        }
    }, [selectedNoteId])

    // this sets a timer that will clear the message element after a few seconds
    useEffect(() => {
        if(!message) return
        const timer = window.setTimeout(() => setMessage(''), 5000)
        return () => window.clearTimeout(timer)
    }, [message])

    useEffect(() => {
        if (!selectedNoteId) return

        const note = notes.find((n) => n.id === selectedNoteId)
        if (!note) return

        if (lastHydratedNoteIdRef.current !== selectedNoteId) return

        const snapshot = JSON.stringify({ title, content, selectedNoteId })
        if (snapshot === lastSavedRef.current) return

        const timer = window.setTimeout(() => {
            void (async () => {
                const ok = await handleEditNote(
                    title,
                    content,
                    selectedNotebookId,
                    selectedNoteId
                )
                if (ok) {
                    lastSavedRef.current = snapshot
                }
            })()
        }, 800)

        return () => window.clearTimeout(timer)
    }, [title, content, selectedNoteId, selectedNotebookId, notes, handleEditNote])

    return(

        <div className="h-full min-h-0 flex flex-col p-8 rounded-2xl border border-border bg-surface">
            {selectedNoteId && (<form
                className="h-full min-h-0 flex flex-col"
                onSubmit={(e) => {
                    e.preventDefault()
                    handleEditNote(title, content, selectedNotebookId, selectedNoteId )
                }}
                
                >
                <input
                className="text-[2rem] rounded-xl bg-transparent p-1 m-2 outline-none placeholder:text-muted"
                    id="title-input"
                    type="text"
                    value={title}
                    onChange={(e) => {
                        setTitle(e.target.value)
                    }}
                    onKeyDown={(e) => {
                        if (e.key !== "Enter" || isLoadingNote) return 
                        e.preventDefault()
                        editorRef.current?.focus()
                    }}
                    placeholder="title"
                />
                <div className="flex-1 min-h-0">
                    <RichTextEditor
                        ref={editorRef}
                        key={selectedNoteId}
                        value={content}
                        readOnly={isLoadingNote}
                        onChange={(nextValue) => {
                            if (suppressRteOnChangeRef.current) return
                            setContent(nextValue)
                        }}
                    />
                </div>
                <div className="flex justify-end w-full">
                    {selectedNoteId && (<button
                        className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted hover:border-control-border hover:text-control-hover w-[120px] mt-4"
                        onClick={() => {
                            if(!selectedNoteId) return
                            handleDeleteNote(selectedNoteId)
                        }}
                    >
                        Delete Note
                    </button>)}
                </div>
            </form>)}
        </div>
    )
}