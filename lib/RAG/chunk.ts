import "server-only"

import { Document } from "@langchain/core/documents"
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters"
import { createHash } from "crypto"

import type { NoteChunkInput, RagChunkMetadata } from "@/lib/RAG/types"

export const RAG_CHUNK_SIZE = 1000
export const RAG_CHUNK_OVERLAP = 200


const htmlSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: RAG_CHUNK_SIZE,
  chunkOverlap: RAG_CHUNK_OVERLAP,
  separators: RecursiveCharacterTextSplitter.getSeparatorsForLanguage("html"),
})

// chroma data object id created from noteId and chunk index
export function chunkDocumentId(noteId: string, chunkIndex: number): string {
  return `${noteId}:${chunkIndex}`
}

// title and content are passed to splitter, the title is included with every chunk
export function buildNoteEmbedText(title: string, content: string): string {
  const trimmedTitle = title.trim()
  const trimmedContent = content.trim()

  if (!trimmedTitle && !trimmedContent) {
    return ""
  }
  if (!trimmedContent) {
    return `Title: ${trimmedTitle}`
  }
  if (!trimmedTitle) {
    return trimmedContent
  }
  return `Title: ${trimmedTitle}\n\n${trimmedContent}`
}

// take data from notechunkInput excluding the content and put in a new object with chunkIndex.
// this is the metadata for that chunk. 
function toChunkMetadata(
  input: NoteChunkInput,
  chunkIndex: number
): RagChunkMetadata {
  return {
    userId: input.userId,
    noteId: input.noteId,
    chunkIndex,
    title: input.title,
    notebookId: input.notebookId,
  }
}

// this creates a hash of the content to check if there actually were any changes
export function toContentHash(title: string, content: string): string {
  const trimmed = buildNoteEmbedText(title, content)
  return createHash("sha256").update(trimmed).digest("hex")
}


async function splitNoteBody(content: string): Promise<string[]> {
  return htmlSplitter.splitText(content)
}


async function splitNoteIntoChunks(
  title: string,
  content: string
): Promise<string[]> {
  const trimmedTitle = title.trim()
  const trimmedContent = content.trim()

  if (!trimmedContent) {
    return trimmedTitle ? [`Title: ${trimmedTitle}`] : []
  }

  const bodySplits = await splitNoteBody(trimmedContent)
  const titlePrefix = trimmedTitle ? `Title: ${trimmedTitle}\n\n` : ""

  return bodySplits.map((split) => `${titlePrefix}${split}`)
}

/**
 * Split a note into LangChain documents for embedding.
 * Returns an empty array when title and content are both empty/whitespace.
 */
export async function chunkNote(
  input: NoteChunkInput
): Promise<Document<RagChunkMetadata>[]> {
  const trimmedTitle = input.title.trim()
  const trimmedContent = input.content.trim()

  if (!trimmedTitle && !trimmedContent) {
    return []
  }

  const splits = await splitNoteIntoChunks(input.title, input.content)
  const documents = splits.map(
    (pageContent, chunkIndex) =>
      new Document({
        pageContent,
        metadata: toChunkMetadata(input, chunkIndex),
      })
  )

  if (process.env.NODE_ENV === "development") {
    const lengths = documents.map((doc) => doc.pageContent.length)
    const avgLength =
      lengths.length === 0
        ? 0
        : Math.round(
            lengths.reduce((sum, length) => sum + length, 0) / lengths.length
          )
    console.info(
      `[rag] chunkNote noteId=${input.noteId} chunks=${documents.length} avgChars=${avgLength}`
    )
  }

  return documents
}
