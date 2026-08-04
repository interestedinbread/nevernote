import "server-only"

import { Document } from "@langchain/core/documents"
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters"
import { createHash } from "crypto"

import type { NoteChunkInput, RagChunkMetadata } from "@/lib/RAG/types"

export const RAG_CHUNK_SIZE = 1000
export const RAG_CHUNK_OVERLAP = 200

const CODE_BLOCK_MARKER_PREFIX = "\u0000RAG_CODE_"
const CODE_BLOCK_MARKER_SUFFIX = "\u0000"


const htmlSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: RAG_CHUNK_SIZE,
  chunkOverlap: RAG_CHUNK_OVERLAP,
  separators: RecursiveCharacterTextSplitter.getSeparatorsForLanguage("html"),
})

/** Stable Chroma document id: `{noteId}:{chunkIndex}`. */
export function chunkDocumentId(noteId: string, chunkIndex: number): string {
  return `${noteId}:${chunkIndex}`
}

/** Title + body string passed to the splitter (title included in every chunk's text). */
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

export function toContentHash(title: string, content: string): string {
  const trimmed = buildNoteEmbedText(title, content)
  return createHash("sha256").update(trimmed).digest("hex")
}

function looksLikeHtml(content: string): boolean {
  return /<[a-z][^>]*>/i.test(content)
}

function extractPreservedBlocks(content: string): {
  text: string
  blocks: string[]
} {
  const blocks: string[] = []
  const pattern = looksLikeHtml(content)
    ? /<pre[\s\S]*?<\/pre>/gi
    : /```[\s\S]*?```/g

  const text = content.replace(pattern, (match) => {
    const index = blocks.length
    blocks.push(match)
    return `${CODE_BLOCK_MARKER_PREFIX}${index}${CODE_BLOCK_MARKER_SUFFIX}`
  })

  return { text, blocks }
}

function restorePreservedBlocks(text: string, blocks: string[]): string {
  return text.replace(
    new RegExp(
      `${CODE_BLOCK_MARKER_PREFIX}(\\d+)${CODE_BLOCK_MARKER_SUFFIX}`,
      "g"
    ),
    (_, index) => blocks[Number(index)] ?? ""
  )
}

async function splitNoteBody(content: string): Promise<string[]> {
  const { text, blocks } = extractPreservedBlocks(content)
  const splitter = looksLikeHtml(content) ? htmlSplitter : markdownSplitter
  const splits = await splitter.splitText(text)
  return splits.map((split) => restorePreservedBlocks(split, blocks))
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
