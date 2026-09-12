import "server-only"

import { deleteRagDocumentsForNote, upsertRagDocuments } from "./chroma";
import { chunkNote, chunkObjectId } from "./chunk";
import { NoteChunkInput } from "./types";



export async function ingestNote(input: NoteChunkInput): Promise<void>{

   const { noteId } = input

    // delete old chunks
    await deleteNoteDocuments(noteId)

    // create new documents with chunks and metadata
    const documents = await chunkNote(input)

    const documentIds = documents.map((doc) =>
        chunkObjectId(doc.metadata.noteId, doc.metadata.chunkIndex)
    )

    await upsertRagDocuments(documents, documentIds)

}

export async function deleteNoteDocuments(noteId: string): Promise<void> {
    await deleteRagDocumentsForNote(noteId)
  }