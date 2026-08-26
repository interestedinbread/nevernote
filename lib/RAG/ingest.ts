import "server-only"

import { deleteRagDocumentsForNote, upsertRagDocuments } from "./chroma";
import { chunkNote, chunkObjectId } from "./chunk";
import { prisma } from "../db";

type IngestInput = {
    id: string,
    title: string,
    content: string,
    notebookId: string,
    userId: string,
}

export async function ingestNote(input: IngestInput): Promise<void>{

    const {
        userId,
        id,
        notebookId,
        title,
        content
    } = input

    // check if any changes were made by hashing title and content and checking against hash from db
    const hash = toContentHash(title, content)
    const storedHash = await prisma.note.findUnique({
        where: {
            id
        },
        select: {
            contentHash: true
        }
    })

    if(storedHash?.contentHash === hash) return
 
    // delete old chunks
    await deleteNoteDocuments(id)

    // create new documents with chunks and metadata
    const documents = await chunkNote({ userId, noteId: id, notebookId, title, content })
    if (documents.length === 0) {
        await prisma.note.update({
            where: { id },
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