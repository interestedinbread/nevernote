import "server-only"

import { Document } from "@/lib/RAG/types"
import { OpenAIEmbeddings } from "@langchain/openai"
import { ChromaClient } from "chromadb"
import type { Where } from "chromadb"
import type {
  RagChunkMetadata,
  RagQueryInput,
  RagQueryResult,
} from "@/lib/RAG/types"

export const RAG_EMBEDDING_MODEL = "text-embedding-3-small"
export const RAG_EMBEDDING_DIMENSIONS = 1536
export const RAG_TOP_K_DEFAULT = 5

const DEFAULT_CHROMA_URL = "http://localhost:8000"
const DEFAULT_CHROMA_COLLECTION = "nevernote-dev"
const RAG_COLLECTION_SCHEMA_VERSION = "byo-v1"

let chromaClient: ChromaClient | null = null
let collectionPromise: ReturnType<ChromaClient["getOrCreateCollection"]> | null =
  null
let embeddings: OpenAIEmbeddings | null = null

export function getChromaUrl(): string {
  return process.env.CHROMA_URL ?? DEFAULT_CHROMA_URL
}

export function getChromaCollectionName(): string {
  return process.env.CHROMA_COLLECTION ?? DEFAULT_CHROMA_COLLECTION
}

export function getRagEmbeddings(): OpenAIEmbeddings {
  if (embeddings) {
    return embeddings
  }

  embeddings = new OpenAIEmbeddings({
    model: RAG_EMBEDDING_MODEL,
    dimensions: RAG_EMBEDDING_DIMENSIONS,
  })

  return embeddings
}

function getChromaClient(): ChromaClient {
  if (chromaClient) {
    return chromaClient
  }

  const url = new URL(getChromaUrl())
  const port =
    url.port !== ""
      ? Number(url.port)
      : url.protocol === "https:"
        ? 443
        : 80

  chromaClient = new ChromaClient({
    host: url.hostname,
    port,
    ssl: url.protocol === "https:",
  })
  return chromaClient
}

// this returns our chroma collection or creates a new one
async function initRagCollection() {
  const client = getChromaClient()
  const name = getChromaCollectionName()

  // we set embedding function to null because we are handling our own embeddings
  return client.getOrCreateCollection({
    name,
    embeddingFunction: null,
    metadata: { rag_schema_version: RAG_COLLECTION_SCHEMA_VERSION },
  })
}

// this returns a cached promise to the collection handle
// if it doesn't already exist it initializes it 
export async function getRagCollection() {
  collectionPromise ??= initRagCollection()
  return collectionPromise
}


export async function upsertRagDocuments(
  documents: Array<Document<RagChunkMetadata>>,
  ids: string[]
): Promise<void> {
  if (documents.length === 0) {
    return
  }
  // documents and ids need to correspond 1 to 1, so if lengths don't match then we have a problem
  if (documents.length !== ids.length) {
    throw new Error(
      `upsertRagDocuments: ids length (${ids.length}) does not match documents length (${documents.length})`
    )
  }

  // grab collection and embeddingClient
  const collection = await getRagCollection()
  const embeddingClient = getRagEmbeddings()

  // extract page contents and metadata from documents to their own arrays
  const pageContents = documents.map((doc) => doc.pageContent)
  const metadatas = documents.map((doc) => doc.metadata)

  // use embeddingClient to make vectors from page contents
  const vectors = await embeddingClient.embedDocuments(pageContents)

  // upsert ids, page contents, metadatas, and vectors to chroma collection
  await collection.upsert({
    ids,
    documents: pageContents,
    metadatas,
    embeddings: vectors,
  })
}

// this deletes all rag documents for a specific note id
export async function deleteRagDocumentsForNote(
  noteId: string,
): Promise<void> {
  const collection = await getRagCollection()

  await collection.delete({
    where: { noteId: { $eq: noteId } },
  })
}

// this deletes individual documents by their id
export async function deleteRagDocumentsByIds(ids: string[]): Promise<void> {
  if (ids.length === 0) {
    return
  }
  const collection = await getRagCollection()
  await collection.delete({ ids })
}

// this takes the user query and returns relevant chunks from the chroma collection
export async function queryRagSimilarChunks(
  input: RagQueryInput
): Promise<RagQueryResult[]> {

  // grab collection and embedding client
  const collection = await getRagCollection()
  const embeddingClient = getRagEmbeddings()

  const k = input.k ?? RAG_TOP_K_DEFAULT

  // generate embedding from user query
  const queryEmbedding = await embeddingClient.embedQuery(input.query)

  // if there is a notebook id we pass that together with userId using $and
  // otherwise we just pass userId
  const where: Where = input.notebookId
    ? {
        $and: [
          { userId: { $eq: input.userId } },
          { notebookId: { $eq: input.notebookId } },
        ],
      }
    : { userId: { $eq: input.userId } }

  // here we actually query our collection, passing "where" which we set above
  const response = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: k,
    where: where,
    include: ["documents", "metadatas", "distances"],
  })

  const ids = response.ids?.[0] ?? []
  const docs = response.documents?.[0] ?? []
  const metadatas = response.metadatas?.[0] ?? []
  const distances = response.distances?.[0] ?? []

  // we take the arrays above and map them to a new array of objects
  return ids.map((id, index) => ({
    id,
    text: docs[index] ?? "",
    metadata: metadatas[index] as RagChunkMetadata,
    distance: distances[index] ?? null,
  }))
}
