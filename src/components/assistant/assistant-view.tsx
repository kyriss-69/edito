"use client";

import {
  ArrowUp,
  Globe,
  History,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  Square,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { AiError, AiIcon, AiProgress } from "@/components/ai/ai-progress";
import { readNdjson, responseError } from "@/components/ai/ndjson";
import { useAiTask, type AiPhase } from "@/components/ai/use-ai-task";
import { useApp } from "@/components/app-provider";
import { PageHeader } from "@/components/page-header";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { activeModel } from "@/lib/ai/settings";
import { CHAT_MESSAGE_MAX, type ChatEntry, type ChatStep } from "@/lib/ai/chat";
import { defaultPostPlatforms, usedPlatforms } from "@/lib/accounts";
import { cn } from "@/lib/utils";
import { displayUrl, normalizeUrl } from "@/lib/web";
import { deleteChat, renameChat } from "@/server/actions";

import { ChatSteps, IdeaCards } from "./chat-steps";
import { Markdown } from "./markdown";

export type ChatSummaryDTO = { id: number; title: string; updatedAt: number };

type StreamEvent =
  | { type: "chat"; chatId: number; title: string; userEntry: ChatEntry }
  | { type: "progress"; phase: AiPhase; chars: number }
  | { type: "text"; text: string }
  | { type: "step"; step: ChatStep }
  | { type: "done"; entry: ChatEntry }
  | { type: "error"; message: string; entry: ChatEntry | null };

type Streaming = { text: string; steps: ChatStep[]; phase: AiPhase; startedAt: number };

/** Heure de l'envoi d'un message (appelée seulement depuis les gestionnaires d'événements). */
const now = () => Date.now();

/** Discussion avec l'assistant : idées de posts, rédaction, recherches et captures sur le web. */
export function AssistantView({
  chats,
  chat,
}: {
  chats: ChatSummaryDTO[];
  chat: { id: number; title: string; entries: ChatEntry[] } | null;
}) {
  const { meta } = useApp();
  const router = useRouter();
  const [chatId, setChatId] = useState<number | null>(chat?.id ?? null);
  const [entries, setEntries] = useState<ChatEntry[]>(chat?.entries ?? []);
  const [syncedId, setSyncedId] = useState<number | null>(chat?.id ?? null);
  const [streaming, setStreaming] = useState<Streaming | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  // Autre discussion choisie (lien ou historique) : on affiche ses messages.
  const propId = chat?.id ?? null;
  if (propId !== syncedId && !streaming) {
    setSyncedId(propId);
    setChatId(propId);
    setEntries(chat?.entries ?? []);
    setError(null);
  }

  useEffect(() => () => controllerRef.current?.abort(), []);

  // Suit la réponse en cours, sauf si l'utilisateur est remonté dans la discussion.
  const lastLength = (streaming?.text.length ?? 0) + (streaming?.steps.length ?? 0) * 1000 + entries.length;
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [lastLength]);

  const title = chats.find((c) => c.id === chatId)?.title ?? (chatId ? "Discussion" : "Nouvelle discussion");
  const siteUrl = normalizeUrl(meta.ai.web.siteUrl);
  const site = siteUrl ? displayUrl(siteUrl) : "mon site";

  async function send(text: string) {
    const message = text.trim();
    if (!message || streaming) return;
    if (!activeModel(meta.ai)) {
      toast.error("Configure d'abord l'assistant IA dans Réglages (modèle LM Studio ou OpenRouter).");
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    const startedAt = now();
    const optimistic: ChatEntry = { id: `local-${startedAt}`, role: "user", content: message, createdAt: startedAt };
    setEntries((prev) => [...prev, optimistic]);
    setDraft("");
    setError(null);
    stickToBottom.current = true;
    setStreaming({ text: "", steps: [], phase: "waiting", startedAt });
    let createdId: number | null = null;

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, message }),
        signal: controller.signal,
      });
      if (!res.ok) {
        setEntries((prev) => prev.filter((e) => e.id !== optimistic.id));
        setDraft(message);
        setError(await responseError(res, "L'assistant n'a pas pu répondre."));
        return;
      }
      let finished = false;
      await readNdjson<StreamEvent>(res, (event) => {
        switch (event.type) {
          case "chat":
            if (chatId === null) createdId = event.chatId;
            setChatId(event.chatId);
            setSyncedId(event.chatId);
            setEntries((prev) => prev.map((e) => (e.id === optimistic.id ? event.userEntry : e)));
            break;
          case "progress":
            setStreaming((prev) => prev && { ...prev, phase: event.phase });
            break;
          case "text":
            setStreaming((prev) => prev && { ...prev, text: event.text });
            break;
          case "step":
            setStreaming(
              (prev) =>
                prev && {
                  ...prev,
                  steps: prev.steps.some((s) => s.id === event.step.id)
                    ? prev.steps.map((s) => (s.id === event.step.id ? event.step : s))
                    : [...prev.steps, event.step],
                },
            );
            break;
          case "done":
            finished = true;
            setEntries((prev) => [...prev, event.entry]);
            break;
          case "error":
            finished = true;
            if (event.entry && (event.entry.content || event.entry.steps?.length)) {
              setEntries((prev) => [...prev, event.entry!]);
            }
            setError(event.message);
            break;
        }
      });
      if (!finished) setError("La connexion avec l'assistant a été interrompue.");
    } catch (err) {
      if (!(err instanceof Error && err.name === "AbortError")) setError("Impossible de contacter l'assistant.");
    } finally {
      controllerRef.current = null;
      setStreaming(null);
      if (createdId !== null) router.replace(`/assistant?chat=${createdId}`, { scroll: false });
      else router.refresh();
    }
  }

  function stop() {
    controllerRef.current?.abort();
  }

  function newChat() {
    if (streaming) stop();
    setShowHistory(false);
    router.push("/assistant");
  }

  const suggestions = meta.ai.web.enabled
    ? [
        `Lis ${site} et propose-moi 5 idées de posts pour cette semaine`,
        "Quelles sont les tendances du moment sur le marketing d'influence en France ?",
        `Fais une capture de ${site} en version téléphone, pour un carrousel`,
        "Aide-moi à trouver une accroche forte pour un carrousel sur les tarifs des créateurs",
      ]
    : [
        "Propose-moi 5 idées de posts pour cette semaine",
        "Aide-moi à trouver une accroche forte pour un carrousel sur les tarifs des créateurs",
        "Quels formats marchent le mieux sur Instagram en ce moment pour une marque qui se lance ?",
      ];

  return (
    <>
      <PageHeader title="Assistant" description={title}>
        <Button
          variant="ghost"
          size="sm"
          className="lg:hidden"
          onClick={() => setShowHistory((v) => !v)}
          aria-expanded={showHistory}
        >
          <History /> <span className="max-sm:hidden">Discussions</span>
        </Button>
        <Button variant="outline" size="sm" onClick={newChat}>
          <MessageSquarePlus /> <span className="max-sm:hidden">Nouvelle discussion</span>
        </Button>
      </PageHeader>

      <div className="flex min-h-0 flex-1">
        <ChatList
          chats={chats}
          activeId={chatId}
          className={cn("w-64 shrink-0 border-r max-lg:hidden", showHistory && "max-lg:absolute max-lg:inset-y-0 max-lg:left-0 max-lg:z-20 max-lg:flex max-lg:shadow-lg")}
          onNavigate={() => setShowHistory(false)}
          onDeleted={(id) => id === chatId && router.push("/assistant")}
        />

        <div className="relative flex min-w-0 flex-1 flex-col">
          <div
            ref={scrollRef}
            onScroll={(e) => {
              const el = e.currentTarget;
              stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            }}
            className="flex-1 overflow-y-auto"
          >
            <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6">
              {entries.length === 0 && !streaming && (
                <div className="flex flex-col items-center gap-4 py-10 text-center">
                  <span className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                    <AiIcon className="size-6" />
                  </span>
                  <div className="flex flex-col gap-1">
                    <h2 className="text-lg font-semibold">Qu&apos;est-ce qu&apos;on prépare ?</h2>
                    <p className="max-w-md text-sm text-muted-foreground">
                      Discute avec l&apos;assistant pour trouver des idées de posts, les affiner et les rédiger.
                      {meta.ai.web.enabled
                        ? " Il peut chercher sur internet, lire ton site et faire des captures d'écran pour tes visuels."
                        : ""}
                    </p>
                  </div>
                  <div className="grid w-full max-w-xl gap-2 sm:grid-cols-2">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => void send(s)}
                        className="rounded-lg border bg-card px-3 py-2.5 text-left text-sm transition-colors hover:border-primary/50 hover:bg-primary/5"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  {!meta.ai.web.enabled && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Globe className="size-3.5" /> Accès à internet désactivé ·{" "}
                      <Link href="/settings/ai" className="underline underline-offset-2">
                        Réglages
                      </Link>
                    </p>
                  )}
                </div>
              )}

              {entries.map((entry) => (
                <Message key={entry.id} entry={entry} />
              ))}

              {streaming && (
                <div className="flex flex-col gap-2.5">
                  {streaming.steps.length > 0 && <ChatSteps steps={streaming.steps} />}
                  {streaming.text && <Markdown text={streaming.text} />}
                  <AiProgress phase={streaming.phase} startedAt={streaming.startedAt} onCancel={stop} />
                </div>
              )}
              {error && <AiError message={error} />}
            </div>
          </div>

          <form
            className="border-t bg-card px-4 py-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send(draft);
            }}
          >
            <div className="mx-auto flex max-w-3xl items-end gap-2">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, CHAT_MESSAGE_MAX))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send(draft);
                  }
                }}
                placeholder={
                  meta.ai.web.enabled
                    ? "Une idée à creuser, un post à rédiger, une page à lire ou à capturer…"
                    : "Une idée à creuser, un post à rédiger…"
                }
                aria-label="Message à l'assistant"
                rows={1}
                className="max-h-48 min-h-10 resize-none"
                autoFocus
              />
              {streaming ? (
                <Button type="button" size="icon" variant="outline" onClick={stop} aria-label="Arrêter la réponse">
                  <Square className="fill-current" />
                </Button>
              ) : (
                <Button type="submit" size="icon" disabled={!draft.trim()} aria-label="Envoyer">
                  <ArrowUp />
                </Button>
              )}
            </div>
            <p className="mx-auto mt-1.5 max-w-3xl text-[11px] text-muted-foreground">
              Entrée pour envoyer, Maj + Entrée pour aller à la ligne · {activeModel(meta.ai) || "aucun modèle choisi"}
              {meta.ai.web.enabled && " · accès à internet activé"}
            </p>
          </form>
        </div>
      </div>
    </>
  );
}

function Message({ entry }: { entry: ChatEntry }) {
  if (entry.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary/10 px-3.5 py-2 text-sm whitespace-pre-wrap break-words">
          {entry.content}
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2.5">
      {entry.steps && entry.steps.length > 0 && <ChatSteps steps={entry.steps} />}
      {entry.content && <Markdown text={entry.content} />}
      {entry.error && <p className="text-xs text-muted-foreground italic">Réponse interrompue : {entry.error}</p>}
      {mayContainIdeas(entry) && <ExtractIdeas text={entry.content} />}
    </div>
  );
}

/** Réponse qui semble lister des idées de posts, sans les cartes de l'outil. */
function mayContainIdeas(entry: ChatEntry): boolean {
  if (entry.steps?.some((s) => s.ideas?.length)) return false;
  const items = entry.content.match(/^\s*(?:[-*•]|\d+[.)]|#{1,4})\s+\S/gm)?.length ?? 0;
  return /\bidées?\b|\bposts?\b/i.test(entry.content) && items >= 2;
}

/** Idées écrites dans le texte d'une réponse (sans l'outil des cartes) : l'IA les relève pour les ajouter au tableau. */
function ExtractIdeas({ text }: { text: string }) {
  const { meta } = useApp();
  const task = useAiTask("extractIdeas");
  const { state } = task;

  function run() {
    if (!activeModel(meta.ai)) {
      toast.error("Configure d'abord l'assistant IA dans Réglages (modèle LM Studio ou OpenRouter).");
      return;
    }
    const defaults = defaultPostPlatforms(meta.accounts);
    void task.run({ text, platforms: defaults.length ? defaults : usedPlatforms(meta.accounts) });
  }

  if (state.status === "idle") {
    return (
      <Button size="sm" variant="ghost" className="self-start text-muted-foreground" onClick={run}>
        <AiIcon /> Ajouter ces idées au tableau
      </Button>
    );
  }
  if (state.status === "running") {
    return <AiProgress phase={state.phase} startedAt={state.startedAt} onCancel={task.cancel} />;
  }
  if (state.status === "error") {
    return <AiError message="Aucune idée de post trouvée dans ce message, ou réponse illisible." onRetry={run} />;
  }
  return <IdeaCards ideas={state.result.ideas} />;
}

function ChatList({
  chats,
  activeId,
  className,
  onNavigate,
  onDeleted,
}: {
  chats: ChatSummaryDTO[];
  activeId: number | null;
  className?: string;
  onNavigate: () => void;
  onDeleted: (id: number) => void;
}) {
  const [renaming, setRenaming] = useState<{ id: number; title: string } | null>(null);
  const [deleting, setDeleting] = useState<ChatSummaryDTO | null>(null);
  const [, startTransition] = useTransition();

  function submitRename() {
    if (!renaming) return;
    const { id, title } = renaming;
    setRenaming(null);
    startTransition(async () => {
      const result = await renameChat(id, title);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <aside className={cn("flex-col overflow-y-auto bg-card p-2", className)}>
      <p className="px-2 pt-1 pb-2 text-xs font-medium text-muted-foreground">Discussions</p>
      {chats.length === 0 && <p className="px-2 text-xs text-muted-foreground">Aucune discussion pour l&apos;instant.</p>}
      <ul className="flex flex-col gap-0.5">
        {chats.map((c) => (
          <li key={c.id} className="group relative">
            {renaming?.id === c.id ? (
              <Input
                value={renaming.title}
                onChange={(e) => setRenaming({ id: c.id, title: e.target.value })}
                onBlur={submitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitRename();
                  if (e.key === "Escape") setRenaming(null);
                }}
                className="h-8"
                autoFocus
              />
            ) : (
              <Link
                href={`/assistant?chat=${c.id}`}
                onClick={onNavigate}
                className={cn(
                  "flex flex-col rounded-md px-2 py-1.5 pr-8 text-sm hover:bg-muted",
                  c.id === activeId && "bg-muted font-medium",
                )}
              >
                <span className="truncate">{c.title}</span>
                <span className="text-[11px] font-normal text-muted-foreground">
                  {new Date(c.updatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                </span>
              </Link>
            )}
            {renaming?.id !== c.id && (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="absolute top-1.5 right-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                    aria-label={`Actions sur « ${c.title} »`}
                  >
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setRenaming({ id: c.id, title: c.title })}>
                    <Pencil /> Renommer
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(c)}>
                    <Trash2 /> Supprimer
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Supprimer cette discussion ?"
        description={`« ${deleting?.title ?? ""} » sera supprimée. Les captures et les posts créés sont conservés.`}
        confirmLabel="Supprimer"
        onConfirm={() => {
          const target = deleting;
          setDeleting(null);
          if (!target) return;
          startTransition(async () => {
            await deleteChat(target.id);
            onDeleted(target.id);
            toast.success("Discussion supprimée");
          });
        }}
      />
    </aside>
  );
}
