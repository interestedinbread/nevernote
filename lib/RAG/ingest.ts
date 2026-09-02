import "server-only"

import { deleteRagDocumentsForNote, upsertRagDocuments } from "./chroma";
import { chunkNote, chunkObjectId } from "./chunk";
import { prisma } from "../db";
import { NoteChunkInput } from "./types";



export async function ingestNote(input: NoteChunkInput): Promise<void>{

    const {
        userId,
        noteId,
        notebookId,
        title,
        content
    } = input

 
    // delete old chunks
    await deleteNoteDocuments(id)

    // create new documents with chunks and metadata
    const documents = await chunkNote({ userId, noteId, notebookId, title, content })
    if (documents.length === 0) {
        await prisma.note.update({
            where: { id: noteId },
            data: { contentHash: hash },
        })
        return
    }

    const documentIds = documents.map((doc) =>
        chunkObjectId(doc.metadata.noteId, doc.metadata.chunkIndex)
    )

    await upsertRagDocuments(documents, documentIds)

    await prisma.note.update({
        where: { id },
        data: { contentHash: hash },
    })
}

export async function deleteNoteDocuments(noteId: string): Promise<void> {
    await deleteRagDocumentsForNote(noteId)
  }