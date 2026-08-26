import "server-only"

import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters"

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
export function chunkObjectId(noteId: string, chunkIndex: number): string {
    return `${noteId}:${chunkIndex}`
}

// take data from notechunkInput excluding the content and put in a new object with chunkIndex.
// this is the metadata for that chunk. 
function buildChunkMetadata(
  input: NoteChunkInput,
  chunkIndex: number
) : RagChunkMetadata {
  return {
    userId: input.userId,
    noteId: input.noteId,
    chunkIndex,
    title: input.title,
    notebookId: input.notebookId
  }
}

// this takes title and content and returns an array of strings. Each string is a text chunk with title prefix
export async function splitNoteIntoChunks(
  title: string,
  content: string
) : Promise<string[]> {
  const trimmedTitle = title.trim()
  const trimmedContent = content.trim()

  if(!trimmedContent){
    return trimmedTitle ? [`Title: ${trimmedTitle}`] : []
  }

  const contentSplits = await htmlSplitter.splitText(content)
  const titlePrefix = trimmedTitle ? `Title: ${trimmedTitle}` : ''

  return contentSplits.map((split) => `${titlePrefix}${split}`)
}

// take note chunk input and return an array of documents
export async function chunkNote(
  input: NoteChunkInput
) : Promise<Document[]> {
  if(!input.title && !input.content){
    return []
  }

  const splits = await splitNoteIntoChunks(input.title, input.content)

  const documents = splits.map((split, index) => ({
    content: split,
    metadata: buildChunkMetadata(input, index)
  }))

  return documents
}
