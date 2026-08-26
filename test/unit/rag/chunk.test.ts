
import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import {
  chunkObjectId,
  chunkNote
} from "@/lib/RAG/chunk"

describe("chunkObjectId", () => {
  it("formats noteId and chunk index", () => {
    expect(chunkObjectId("note-1", 0)).toBe("note-1:0")
  })
})

describe("chunkNote", () => {
  const baseInput = {
    userId: "user-1",
    noteId: "note-1",
    notebookId: "nb-1",
    title: "Test",
    content: "Short body.",
  }

  it("returns documents with required metadata", async () => {
    const docs = await chunkNote(baseInput)

    expect(docs.length).toBeGreaterThanOrEqual(1)
    expect(docs[0].content).toContain("Title: Test")
    expect(docs[0].metadata).toEqual({
      userId: "user-1",
      noteId: "note-1",
      chunkIndex: 0,
      title: "Test",
      notebookId: "nb-1",
    })
  })

  it("returns no documents for empty notes", async () => {
    const docs = await chunkNote({
      ...baseInput,
      title: "",
      content: "",
    })

    expect(docs).toEqual([])
  })


  it("splits quill html on heading tags when content exceeds chunk size", async () => {
    const sectionBody = "word ".repeat(350).trim()
    const content = `<h2>Section A</h2><p>${sectionBody}</p><h2>Section B</h2><p>${sectionBody}</p>`
    const docs = await chunkNote({ ...baseInput, title: "Note", content })

    expect(docs.length).toBeGreaterThan(1)
    expect(
      docs.some(
        (doc) => doc.content.includes("Section A") && !doc.content.includes("Section B")
      )
    ).toBe(true)
    expect(
      docs.some(
        (doc) => doc.content.includes("Section B") && !doc.content.includes("Section A")
      )
    ).toBe(true)
  })

  it("keeps a small html code block in one chunk", async () => {
    const code = "const answer = 42;"
    const content = `<p>Intro.</p><pre class="ql-syntax">${code}</pre><p>Outro.</p>`
    const docs = await chunkNote({ ...baseInput, title: "Note", content })

    const codeChunk = docs.find((doc) => doc.content.includes(code))
    expect(codeChunk).toBeDefined()
    expect(codeChunk?.content).toContain("<pre")
    expect(codeChunk?.content).toContain(code)
  })
})
