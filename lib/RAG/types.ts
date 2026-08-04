/** Input for chunking a single note before embedding. */
export type NoteChunkInput = {
  userId: string
  noteId: string
  notebookId: string
  title: string
  content: string
}

/** Stored on every Chroma / LangChain document */
export type RagChunkMetadata = {
  userId: string
  noteId: string
  chunkIndex: number
  title: string
  notebookId: string
}

/** Input for similarity search over indexed note chunks. */
export type RagQueryInput = {
  query: string
  userId: string
  notebookId?: string
  k?: number
}

/** One retrieved chunk from Chroma similarity search. */
export type RagQueryResult = {
  id: string
  text: string
  metadata: RagChunkMetadata
  distance: number | null
}
