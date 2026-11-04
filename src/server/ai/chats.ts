import "server-only";

import { desc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { assistantChats } from "@/db/schema";
import { parseChatEntries, type ChatEntry } from "@/lib/ai/chat";

export type ChatSummary = { id: number; title: string; updatedAt: number };

export function listChats(): ChatSummary[] {
  return getDb()
    .select({ id: assistantChats.id, title: assistantChats.title, updatedAt: assistantChats.updatedAt })
    .from(assistantChats)
    .orderBy(desc(assistantChats.updatedAt))
    .all()
    .map((c) => ({ ...c, updatedAt: c.updatedAt.getTime() }));
}

export function getChat(id: number): { id: number; title: string; entries: ChatEntry[] } | null {
  const row = getDb().select().from(assistantChats).where(eq(assistantChats.id, id)).get();
  if (!row) return null;
  let raw: unknown = [];
  try {
    raw = JSON.parse(row.messages);
  } catch {
    // Messages illisibles : discussion vide.
  }
  return { id: row.id, title: row.title, entries: parseChatEntries(raw) };
}

export function createChat(title: string): number {
  return getDb().insert(assistantChats).values({ title }).returning({ id: assistantChats.id }).get().id;
}

export function saveChatEntries(id: number, entries: ChatEntry[]) {
  getDb()
    .update(assistantChats)
    .set({ messages: JSON.stringify(entries), updatedAt: new Date() })
    .where(eq(assistantChats.id, id))
    .run();
}
