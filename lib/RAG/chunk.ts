import "server-only"

import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters"
import { createHash } from "crypto"

import type { NoteChunkInput, RagChunkMetadata, Document } from "@/lib/RAG/types"

// these are the same as the defaults set by langchain, they are set here for clarity
export const RAG_CHUNK_SIZE = 1000
export const RAG_CHUNK_OVERLAP = 200

// instantiate htmlsplitter with chunksize, overlap, and separators
const htmlSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: RAG_CHUNK_SIZE,
  chunkOverlap: RAG_CHUNK_OVERLAP,
  separators: RecursiveCharacterTextSplitter.getSeparatorsForLanguage("html")
})

// chroma data object id created from noteId and chunk index
export function chunkDocumentId (noteId: string, chunkIndex: string): string {
    return `${noteId}:${chunkIndex}`
}



// take data from notechunkInput excluding the content and put in a new object with chunkIndex.
// this is the metadata for that chunk. 
function buildChunkMetadata(
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



// this trims title and content, splits content, adds a prefix to the title, and returns title with prefix added with each chunk
async function splitNoteIntoChunks(
  title: string,
  content: string
): Promise<string[]> {
  const trimmedTitle = title.trim()
  const trimmedContent = content.trim()

// if there is no trimmed content, check if there is a trimmed title. If there is return it and otherwise return empty array. 
  if (!trimmedContent) {
    return trimmedTitle ? [`Title: ${trimmedTitle}`] : []
  }

// split just the note content, then create title element with linebreaks beneath and append to each bodysplit
  const bodySplits = await htmlSplitter.splitText(trimmedContent)
  const titlePrefix = trimmedTitle ? `Title: ${trimmedTitle}\n\n` : ""

  return bodySplits.map((split) => `${titlePrefix}${split}`)
}


export async function chunkNote(
  input: NoteChunkInput
): Promise<Document[]> {
  const trimmedTitle = input.title.trim()
  const trimmedContent = input.content.trim()

  if (!trimmedTitle && !trimmedContent) {
    return []
  }

  const splits = await splitNoteIntoChunks(input.title, input.content)
  const documents = splits.map(
    (pageContent, chunkIndex) =>
      ({
        content: pageContent,
        metadata: buildChunkMetadata(input, chunkIndex),
      })
    )

  return documents
}
