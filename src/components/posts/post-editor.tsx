"use client";

import {
  BookmarkPlus,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  CopyPlus,
  Loader2,
  MoreHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { MediaAssistant } from "@/components/ai/media-assistant";
import { PostResearch } from "@/components/ai/post-research";
import { VisualBriefAssistant } from "@/components/ai/visual-brief";
import { useApp } from "@/components/app-provider";
import { TemplateDialog } from "@/components/library/templates-view";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { SaveIndicator, type SaveStatus } from "@/components/save-indicator";
import { StudioBridge } from "@/components/studio/studio-bridge";
import { Hint } from "@/components/ui/tooltip";
import { suggestFormat } from "@/lib/platforms";
import { draftFromPost, emptyDraft, type Draft, type NewPostDefaults } from "@/lib/post-draft";
import { readiness } from "@/lib/post-status";
import type { MediaDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { deletePost, duplicatePost, savePost } from "@/server/actions";

import { CaptionSection } from "./caption-section";
import { DetailsPanel } from "./details-panel";
import { Section } from "./editor-section";
import { MediaSection } from "./media-section";
import { ColorDot } from "./platform-badge";
import { PostPreview } from "./post-preview";

export type { Draft, NewPostDefaults };

const EMPTY_MEDIA: MediaDTO[] = [];
/** Délai avant l'enregistrement automatique, après la dernière modification. */
const AUTOSAVE_DELAY = 800;

type Tab = "content" | "preview" | "details";

type EditorProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: number | null;
  defaults?: NewPostDefaults;
};

export function PostEditor(props: EditorProps) {
  const { posts } = useApp();
  // Un post tout juste créé (ex. duplication) peut arriver un instant après l'ouverture.
  const available = props.postId === null || posts.some((p) => p.id === props.postId);
  // Une fois le formulaire affiché, on le garde, même si le post disparaît pendant la fermeture.
  const [ready, setReady] = useState(available);
  if (!ready && available) setReady(true);

  if (!ready) {
    return (
      <Sheet open={props.open} onOpenChange={props.onOpenChange}>
        <SheetContent>
          <SheetTitle className="sr-only">Chargement du post</SheetTitle>
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }
  return <PostEditorForm {...props} />;
}

/** « Prêt 4/6 » : ce qui manque pour publier. */
function ReadinessButton({ draft, media }: { draft: Draft; media: MediaDTO[] }) {
  const { items, done, total } = readiness({ ...draft, media });
  const complete = done === total;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className={cn("h-7 gap-1.5 px-2 text-xs", complete && "text-success")}>
          <svg viewBox="0 0 20 20" className="size-4 -rotate-90" aria-hidden="true">
            <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
            <circle
              cx="10"
              cy="10"
              r="8"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${(done / total) * 50.27} 50.27`}
              className={complete ? "text-success" : "text-primary"}
            />
          </svg>
          Prêt {done}/{total}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          {complete ? "Tout est prêt pour publier." : "Pour être prêt à publier :"}
        </p>
        <ul className="flex flex-col gap-1.5 text-sm">
          {items.map((item) => (
            <li key={item.id} className={cn("flex items-center gap-2", item.done && "text-muted-foreground")}>
              {item.done ? (
                <Check className="size-4 text-success" />
              ) : (
                <Circle className="size-4 text-muted-foreground/50" />
              )}
              {item.label}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/** Statut (colonne du tableau) du post. */
function StatusMenu({ columnId, onChange }: { columnId: number; onChange: (columnId: number) => void }) {
  const { meta } = useApp();
  const column = meta.columns.find((c) => c.id === columnId);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 max-w-48 gap-1.5 rounded-full px-2.5 text-xs">
          {column && <ColorDot color={column.color} />}
          <span className="truncate">{column?.name ?? "Statut"}</span>
          <ChevronDown className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Statut</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={String(columnId)} onValueChange={(v) => onChange(Number(v))}>
          {meta.columns.map((c) => (
            <DropdownMenuRadioItem key={c.id} value={String(c.id)}>
              <ColorDot color={c.color} />
              {c.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PostEditorForm({ open, onOpenChange, postId, defaults }: EditorProps) {
  const { meta, posts, openPost } = useApp();
  const [savedId, setSavedId] = useState<number | null>(postId);
  const post = savedId === null ? undefined : posts.find((p) => p.id === savedId);

  const [draft, setDraft] = useState<Draft>(() => (post ? draftFromPost(post) : emptyDraft(meta, defaults)));
  const [baseline, setBaseline] = useState(() => JSON.stringify(draft));
  const [status, setStatus] = useState<SaveStatus>(post ? "saved" : "idle");
  const [tab, setTab] = useState<Tab>("content");

  // Ajout de médias : passe le format en vidéo / carrousel si le post est encore en « Post image ».
  const media = post?.media ?? EMPTY_MEDIA;
  const mediaKey = media.map((m) => m.id).join(",");
  const [seenMediaKey, setSeenMediaKey] = useState(mediaKey);
  if (mediaKey !== seenMediaKey) {
    setSeenMediaKey(mediaKey);
    const added = media.length > seenMediaKey.split(",").filter(Boolean).length;
    const suggested = suggestFormat(draft.format, media.map((m) => m.mimeType));
    if (added && suggested) {
      setDraft((prev) => ({ ...prev, format: suggested }));
    }
  }
  const draftJson = JSON.stringify(draft);
  const dirty = draftJson !== baseline;

  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Valeurs lues par les enregistrements asynchrones (toujours les plus récentes).
  const draftRef = useRef(draft);
  const savedIdRef = useRef(savedId);
  const savingRef = useRef<Promise<number | null> | null>(null);
  const deletedRef = useRef(false);
  useEffect(() => {
    draftRef.current = draft;
  });

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  /** Enregistre le brouillon (un enregistrement à la fois) et renvoie l'id du post, créé au besoin. */
  async function persist(): Promise<number | null> {
    while (savingRef.current) await savingRef.current;
    const current = draftRef.current;
    const run = (async () => {
      setStatus("saving");
      const result = await savePost({
        ...current,
        id: savedIdRef.current ?? undefined,
        title: current.title.trim() || "Sans titre",
        checklist: current.checklist
          .filter((item) => item.label.trim())
          .map(({ label, done }) => ({ label, done })),
      });
      if (!result.ok) {
        setStatus("error");
        toast.error(result.error);
        return null;
      }
      savedIdRef.current = result.data.id;
      setSavedId(result.data.id);
      setBaseline(JSON.stringify(current));
      setStatus("saved");
      return result.data.id;
    })();
    savingRef.current = run;
    try {
      return await run;
    } finally {
      savingRef.current = null;
    }
  }

  // Enregistrement automatique, peu après la dernière modification.
  const autosave = useEffectEvent(() => {
    if (!deletedRef.current) void persist();
  });
  useEffect(() => {
    if (!dirty || !open) return;
    const timer = setTimeout(autosave, AUTOSAVE_DELAY);
    return () => clearTimeout(timer);
  }, [draftJson, dirty, open]);

  /** Ferme la fiche après avoir enregistré les dernières modifications. */
  function requestClose(next: boolean) {
    if (next) return onOpenChange(true);
    if (!dirty || deletedRef.current) return onOpenChange(false);
    void persist().then((id) => {
      if (id !== null) onOpenChange(false);
    });
  }

  /** Ouvre un autre post (précédent ou suivant) une fois celui-ci enregistré. */
  function goTo(id: number) {
    if (!dirty) return openPost(id);
    void persist().then((saved) => {
      if (saved !== null) openPost(id);
    });
  }

  function handleDuplicate() {
    startTransition(async () => {
      const id = dirty || savedId === null ? await persist() : savedId;
      if (!id) return;
      const result = await duplicatePost(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Post dupliqué");
      openPost(result.data.id);
    });
  }

  function handleDelete() {
    if (savedId === null) return;
    deletedRef.current = true;
    startTransition(async () => {
      await deletePost(savedId);
      toast.success("Post supprimé");
      onOpenChange(false);
    });
  }

  const onShortcut = useEffectEvent((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      void persist().then((id) => id !== null && toast.success("Post enregistré"));
    }
  });
  useEffect(() => {
    if (!open) return;
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, [open]);

  // Posts voisins dans la même colonne, pour passer de l'un à l'autre.
  const siblings = post
    ? posts.filter((p) => p.columnId === post.columnId).sort((a, b) => a.position - b.position)
    : [];
  const index = siblings.findIndex((p) => p.id === savedId);
  const previous = index > 0 ? siblings[index - 1] : undefined;
  const next = index >= 0 ? siblings[index + 1] : undefined;

  const content = (
    <>
      <MediaSection
        media={media}
        postId={savedId}
        ensurePostId={async () => savedIdRef.current ?? (await persist())}
        format={draft.format}
        platforms={draft.platforms.map((p) => p.platform)}
      >
        <MediaAssistant media={media} draft={draft} update={update} />
        <StudioBridge
          postId={savedId}
          draft={draft}
          ensurePostId={async () => savedIdRef.current ?? (await persist())}
          onLeave={() => requestClose(false)}
        />
      </MediaSection>

      <PostResearch draft={draft} update={update} />

      <CaptionSection draft={draft} update={update} />

      <Section title="Notes internes" description="Visibles seulement dans l'app.">
        <Label htmlFor="notes" className="sr-only">
          Notes internes
        </Label>
        <Textarea
          id="notes"
          value={draft.notes}
          onChange={(e) => update("notes", e.target.value)}
          placeholder="Idées, références, musique à utiliser, brief du visuel…"
          className="min-h-20"
        />
        <VisualBriefAssistant
          draft={draft}
          onAppend={(brief) => update("notes", draft.notes.trim() ? `${draft.notes.trim()}\n\n${brief}` : brief)}
        />
      </Section>
    </>
  );

  return (
    <Sheet open={open} onOpenChange={requestClose}>
      <SheetContent className="gap-0 sm:max-w-5xl" showClose={false}>
        <SheetTitle className="sr-only">{savedId ? "Modifier le post" : "Nouveau post"}</SheetTitle>
        <SheetDescription className="sr-only">Les modifications sont enregistrées automatiquement.</SheetDescription>

        <header className="flex flex-col gap-2 border-b px-4 pt-3 pb-2 sm:px-6">
          <div className="flex items-center gap-1.5">
            <StatusMenu columnId={draft.columnId} onChange={(columnId) => update("columnId", columnId)} />
            <div className="ml-auto flex items-center gap-1">
              <SaveIndicator status={dirty && status !== "error" ? "saving" : status} onRetry={() => void persist()} />
              <ReadinessButton draft={draft} media={media} />
              {siblings.length > 1 && (
                <div className="flex max-sm:hidden">
                  <Hint label="Post précédent de la colonne">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={!previous}
                      onClick={() => previous && goTo(previous.id)}
                      aria-label="Post précédent"
                    >
                      <ChevronLeft />
                    </Button>
                  </Hint>
                  <Hint label="Post suivant de la colonne">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={!next}
                      onClick={() => next && goTo(next.id)}
                      aria-label="Post suivant"
                    >
                      <ChevronRight />
                    </Button>
                  </Hint>
                </div>
              )}
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="Plus d'actions" disabled={pending}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onSelect={() => setSavingTemplate(true)}>
                    <BookmarkPlus /> Enregistrer comme modèle
                  </DropdownMenuItem>
                  {savedId !== null && (
                    <>
                      <DropdownMenuItem onSelect={handleDuplicate}>
                        <CopyPlus /> Dupliquer
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
                        <Trash2 /> Supprimer
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="ghost" size="icon-sm" onClick={() => requestClose(false)} aria-label="Fermer">
                <X />
              </Button>
            </div>
          </div>
          <Textarea
            autoFocus={!savedId}
            rows={1}
            value={draft.title}
            onChange={(e) => update("title", e.target.value.replace(/\n/g, " "))}
            onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
            placeholder="Titre du post (usage interne)"
            aria-label="Titre du post"
            className="min-h-0 resize-none border-0 bg-transparent px-0 py-0.5 text-xl font-semibold shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
            <TabsList>
              <TabsTrigger value="content">Contenu</TabsTrigger>
              <TabsTrigger value="details" className="lg:hidden">
                Détails
              </TabsTrigger>
              <TabsTrigger value="preview">Aperçu</TabsTrigger>
            </TabsList>
          </Tabs>
        </header>

        <div className="flex min-h-0 flex-1">
          <div className={cn("min-w-0 flex-1 overflow-y-auto", tab === "details" && "max-lg:hidden")}>
            {tab === "preview" ? <PostPreview draft={draft} media={media} /> : content}
          </div>
          <aside
            aria-label="Détails du post"
            className={cn(
              "w-80 shrink-0 overflow-y-auto border-l bg-sidebar max-lg:w-full max-lg:border-l-0",
              tab !== "details" && "max-lg:hidden",
            )}
          >
            <DetailsPanel draft={draft} update={update} post={post} />
          </aside>
        </div>

        {savingTemplate && (
          <TemplateDialog
            id={null}
            initial={{
              name: draft.title.trim(),
              description: "",
              title: draft.title,
              caption: draft.caption,
              hashtags: draft.hashtags,
              cta: draft.cta,
              format: draft.format,
              platforms: draft.platforms.map((p) => p.platform),
              pillarId: draft.pillarId,
              notes: "",
              checklist: draft.checklist.map((c) => c.label).filter((l) => l.trim()),
            }}
            onClose={() => setSavingTemplate(false)}
          />
        )}
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Supprimer ce post ?"
          description="Le post et ses médias seront définitivement supprimés."
          confirmLabel="Supprimer"
          onConfirm={handleDelete}
        />
      </SheetContent>
    </Sheet>
  );
}
