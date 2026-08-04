import type { Note } from "@/lib/types/api"
import type { ComponentPropsWithoutRef } from "react"

export type NoteCardRenderProps = {
    renderNotePreview: (content: string) => string
    renderNoteUpdatedTime: (time: string) => string
}

type NoteCardProps = NoteCardRenderProps & {
    note: Note
    isSelected: boolean
    variant?: "grid" | "overlay"
} & ComponentPropsWithoutRef<"div">

export function NoteCard({
    note,
    isSelected,
    renderNotePreview,
    renderNoteUpdatedTime,
    variant = "grid",
    className,
    ...props
}: NoteCardProps) {
    const title = note.title.trim().length === 0 ? "Untitled" : note.title

    const shellClass =
        variant === "overlay"
            ? isSelected
                ? "max-w-[200px] w-full cursor-grabbing rounded-xl border border-accent/60 bg-surface p-2 shadow-lg ring-1 ring-ring h-[250px]"
                : "max-w-[200px] w-full cursor-grabbing rounded-xl border border-border bg-surface p-2 shadow-lg h-[250px]"
            : isSelected
              ? "cursor-default bg-surface border border-accent/60 ring-1 ring-ring rounded-xl p-2 overflow-hidden h-[250px] w-full text-left flex flex-col items-start justify-start mt-2 hover:bg-surface-2"
              : "cursor-default bg-surface border border-border rounded-xl min-w-[100px] p-2 overflow-hidden h-[250px] w-full text-left flex flex-col items-start justify-start mt-2 hover:bg-surface-2"

    const previewClass =
        variant === "overlay"
            ? "min-h-0 flex-1 overflow-hidden p-2 text-sm text-muted"
            : "text-sm text-muted p-2"

    const timeClass =
        variant === "overlay"
            ? "mt-auto shrink-0 text-xs text-muted/80"
            : "mt-auto text-xs text-muted/80"

    const content = (
        <>
            <div
                className={
                    variant === "overlay"
                        ? "flex w-full shrink-0 items-center justify-between gap-2"
                        : "flex w-full items-center justify-between gap-2"
                }
            >
                <p className="min-w-0 flex-1 truncate pl-2 text-base font-bold">{title}</p>
            </div>
            <p className={previewClass}>{renderNotePreview(note.content)}</p>
            {/* <p className="mt-auto text-xs">{note.customOrder}</p> */}
            <p className={timeClass}>{renderNoteUpdatedTime(note.updatedAt)}</p>
        </>
    )

    const combinedClass = [shellClass, className].filter(Boolean).join(" ")

    if (variant === "overlay") {
        return (
            <div className={combinedClass} {...props}>
                <div className="flex h-full min-h-0 w-full flex-col items-start text-left">
                    {content}
                </div>
            </div>
        )
    }

    return (
        <div className={combinedClass} {...props}>
            {content}
        </div>
    )
}
