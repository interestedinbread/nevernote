
export type NoteChunkInput = {
  userId: string
  noteId: string
  notebookId: string
  title: string
  content: string
}

export type Document = {
  content: string,
  metadata: RagChunkMetadata
}

export type RagChunkMetadata = {
  userId: string
  noteId: string
  chunkIndex: number
  title: string
  notebookId: string
}

export type RagQueryInput = {
  query: string
  userId: string
  notebookId?: string
  k?: number
}

export type RagQueryResult = {
  id: string
  text: string
  metadata: RagChunkMetadata
  distance: number | null
}


// chroma upsert data model for reference

export type chromaObject = {
  ids: string[],
  documents: string[],
  metadatas: object[],
  embeddings: number[][]
}