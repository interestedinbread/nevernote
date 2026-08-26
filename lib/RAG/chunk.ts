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

// this trims title and content, splits content, adds a prefix to the title, and returns title with prefix added with each chunk
async function splitNoteIntoChunks(
  title: string,
  content: string
) : Promise<string[]> {
  const trimmedTitle = title.trim()
  const trimmedContent = content.trim()

  if(!trimmedContent){
    return trimmedTitle ? [`Title: ${trimmedTitle}`] : []
  }

  const contentSplits = await htmlSplitter.splitText(trimmedContent)
  const titlePrefix = title ? `Title: ${trimmedTitle}\n\n` : ""

  return contentSplits.map( (split) => `${titlePrefix}${split}`)
}

// take note chunk input and return an array of documents
export async function chunkNote(
  input: NoteChunkInput
) : Promise<Document[]> {
  const trimmedTitle = input.title.trim()
  const trimmedContent = input.content.trim()

  if(!trimmedContent && !trimmedTitle){
    return []
  }

  const splits = await splitNoteIntoChunks(trimmedTitle, trimmedContent)

  const documents = splits.map(
    (split, index) => ({
      content: split,
      metadata: buildChunkMetadata(input, index)
    })
  )

  return documents
}
