import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { columns, libraryAssets, pillars, socialAccounts } from "@/db/schema";
import { activeModel } from "@/lib/ai/settings";
import { APP_SHOTS_CATEGORY } from "@/lib/app-shots";
import { usedPlatforms } from "@/lib/accounts";
import { isPlatformId, type PlatformId } from "@/lib/platforms";
import { CHAT_MESSAGE_MAX, chatTitle, type ChatContext, type ChatEntry, type ChatStep } from "@/lib/ai/chat";
import { normalizeUrl } from "@/lib/web";
import { runAgent } from "@/server/ai/agent";
import { createChat, getChat, saveChatEntries } from "@/server/ai/chats";
import { getBrandContext } from "@/server/ai/context";
import type { AiPhase } from "@/server/ai/lmstudio";
import { errorMessage, ndjsonResponse } from "@/server/ai/run-task";
import { getPosts } from "@/server/queries";
import { getAiSettings } from "@/server/settings";

/** Une réponse avec plusieurs recherches et pages lues peut être longue avec un modèle local. */
const TIMEOUT_MS = 10 * 60 * 1000;

export type ChatStreamEvent =
  | { type: "chat"; chatId: number; title: string; userEntry: ChatEntry }
  | { type: "progress"; phase: AiPhase; chars: number }
  | { type: "text"; text: string }
  | { type: "step"; step: ChatStep }
  | { type: "done"; entry: ChatEntry }
  | { type: "error"; message: string; entry: ChatEntry | null };

const inputSchema = z.object({
  chatId: z.number().int().positive().nullable().default(null),
  message: z.string().trim().min(1, "Message vide").max(CHAT_MESSAGE_MAX, "Message trop long"),
});

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function chatContext(settings: ReturnType<typeof getAiSettings>): ChatContext {
  const db = getDb();
  const columnNames = new Map(db.select().from(columns).orderBy(asc(columns.position)).all().map((c) => [c.id, c.name]));
  const posts = getPosts()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 40)
    .map((p) => ({
      title: p.title,
      format: p.format,
      status: columnNames.get(p.columnId) ?? "",
      date: p.scheduledAt ? new Date(p.scheduledAt).toLocaleDateString("fr-FR") : null,
    }));
  return {
    brand: getBrandContext(settings),
    web: settings.web.enabled,
    siteUrl: normalizeUrl(settings.web.siteUrl) ?? "",
    today: new Date(),
    pillars: db.select().from(pillars).orderBy(asc(pillars.position)).all().map((p) => p.name),
    posts,
    screens: db
      .select({ title: libraryAssets.title })
      .from(libraryAssets)
      .where(eq(libraryAssets.category, APP_SHOTS_CATEGORY))
      .all()
      .map((a) => a.title),
    platforms: usedPlatforms(
      db.select().from(socialAccounts).all().filter((a) => isPlatformId(a.platform)) as { platform: PlatformId; status: string; defaultOnPosts: boolean }[],
    ),
  };
}

/** Discussion avec l'assistant : enregistre le message, puis la réponse (et ses étapes) au fil de l'eau. */
export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Demande invalide" }, { status: 400 });
  }
  const settings = getAiSettings();
  if (!activeModel(settings)) {
    return Response.json({ error: "Aucun modèle choisi : configure l'assistant dans Réglages." }, { status: 400 });
  }

  const { message } = parsed.data;
  const existing = parsed.data.chatId === null ? null : getChat(parsed.data.chatId);
  if (parsed.data.chatId !== null && !existing) {
    return Response.json({ error: "Discussion introuvable" }, { status: 404 });
  }
  const title = existing?.title ?? chatTitle(message);
  const chatId = existing?.id ?? createChat(title);
  const userEntry: ChatEntry = { id: newId(), role: "user", content: message, createdAt: Date.now() };
  const entries = [...(existing?.entries ?? []), userEntry];
  saveChatEntries(chatId, entries);

  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(TIMEOUT_MS)]);
  const context = chatContext(settings);

  return ndjsonResponse<ChatStreamEvent>(async (send) => {
    send({ type: "chat", chatId, title, userEntry });
    let text = "";
    const steps = new Map<string, ChatStep>();
    const answer = (extra: Partial<ChatEntry> = {}): ChatEntry => ({
      id: newId(),
      role: "assistant",
      content: text,
      steps: [...steps.values()],
      createdAt: Date.now(),
      ...extra,
    });

    try {
      send({ type: "progress", phase: "waiting", chars: 0 });
      const result = await runAgent({
        settings,
        context,
        entries,
        signal,
        events: {
          onProgress: (phase, chars) => send({ type: "progress", phase, chars }),
          onText: (value) => {
            text = value;
            send({ type: "text", text: value });
          },
          onStep: (step) => {
            steps.set(step.id, step);
            send({ type: "step", step });
          },
        },
      });
      text = result.content;
      const entry = answer();
      saveChatEntries(chatId, [...entries, entry]);
      send({ type: "done", entry });
    } catch (error) {
      const reason = errorMessage(error, 10) ?? "Réponse arrêtée.";
      // Les étapes en cours n'iront pas plus loin.
      for (const step of steps.values()) if (step.status === "running") step.status = "error";
      const entry = answer({ error: reason });
      saveChatEntries(chatId, [...entries, entry]);
      send({ type: "error", message: reason, entry });
    }
  });
}
