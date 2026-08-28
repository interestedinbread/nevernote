import "server-only"

import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters"

import type { NoteChunkInput, RagChunkMetadata, Document } from "./types"

const RAG_CHUNK_SIZE = 1000
const RAG_CHUNK_OVERLAP = 200

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: RAG_CHUNK_SIZE,
  chunkOverlap: RAG_CHUNK_OVERLAP,
  separators: RecursiveCharacterTextSplitter.getSeparatorsForLanguage("html")

})

export function chunkObjectId(noteId: string, chunkIndex: number): string {
  return `${noteId}:${chunkIndex}`
}

function buildChunkMetaData (input: NoteChunkInput, chunkIndex: number): RagChunkMetadata {
  return {
    userId: input.userId,
    noteId: input.noteId,
    chunkIndex,
    title: input.title,
    notebookId: input.notebookId
  }
}

export async function splitNoteIntoChunks(
  title: string,
  content: string
): Promise<string[]> {
  const trimmedTitle = title.trim()
  const trimmedContent = content.trim()

  if(!trimmedContent){
    return trimmedTitle ? [`Title: ${trimmedTitle}`] : []
  }

  const contentSplits = await splitter.splitText(trimmedContent)
  const titlePrefix = trimmedTitle ? `Title: ${trimmedTitle}` : ""

  return contentSplits.map(
    (split) => `${titlePrefix}${split}`
  )
}

export async function chunkNote (
  input: NoteChunkInput
) : Promise<Document[]> {
  if(!input.title && input.content){
    return []
  }

  const splits = await splitNoteIntoChunks(input.title, input.content)

  const documents = splits.map((split, index) => ({
    content: split,
    metadata: buildChunkMetaData(input, index)
  }))

  return documents
}