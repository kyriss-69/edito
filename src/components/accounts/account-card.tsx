"use client";

import { Camera, ExternalLink, Loader2, RefreshCw, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { AiError, AiIcon, AiProgress } from "@/components/ai/ai-progress";
import { AssistantPanel, Proposal, useAiReady } from "@/components/ai/caption-assistant";
import { useAiTask } from "@/components/ai/use-ai-task";
import { ChecklistEditor } from "@/components/posts/checklist-section";
import { ColorDot, PlatformBadge } from "@/components/posts/platform-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ACCOUNT_STATUSES, ACCOUNT_TYPES, cleanHandle } from "@/lib/accounts";
import { PLATFORMS } from "@/lib/platforms";
import type { AccountDTO, ChecklistItemDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { removeAccountAvatar, saveAccount } from "@/server/actions";

import { ProfileAudit } from "./profile-audit";

type AccountDraft = {
  status: string;
  handle: string;
  profileUrl: string;
  accountType: string;
  bio: string;
  bioLink: string;
  followersGoal: number | null;
  postsPerWeek: number | null;
  defaultOnPosts: boolean;
  notes: string;
  checklist: ChecklistItemDTO[];
};

function draftFrom(account: AccountDTO): AccountDraft {
  return {
    status: account.status,
    handle: account.handle,
    profileUrl: account.profileUrl,
    accountType: account.accountType,
    bio: account.bio,
    bioLink: account.bioLink,
    followersGoal: account.followersGoal,
    postsPerWeek: account.postsPerWeek,
    defaultOnPosts: account.defaultOnPosts,
    notes: account.notes,
    checklist: account.checklist.map(({ label, done }) => ({ label, done })),
  };
}

function toCount(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Math.max(0, Math.round(Number(value)));
  return Number.isFinite(n) ? n : null;
}

function Field({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function Avatar({ account }: { account: AccountDTO }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [, startTransition] = useTransition();
  const config = PLATFORMS[account.platform];

  async function upload(file: File) {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`/api/accounts/${account.id}/avatar`, { method: "POST", body });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? "Échec de l'envoi");
        return;
      }
      toast.success("Photo de profil mise à jour");
      router.refresh();
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="group relative size-16 shrink-0">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex size-16 items-center justify-center overflow-hidden rounded-full border-2 bg-muted"
        style={{ borderColor: config.color }}
        aria-label="Changer la photo de profil"
        title="Changer la photo de profil"
      >
        {account.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- image locale servie par l'API
          <img src={account.avatarUrl} alt="" className="size-full object-cover" />
        ) : (
          <Camera className="size-5 text-muted-foreground" />
        )}
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100">
          {uploading ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
        </span>
      </button>
      {account.avatarUrl && (
        <button
          type="button"
          onClick={() =>
            startTransition(async () => {
              await removeAccountAvatar(account.id);
            })
          }
          className="absolute -right-1 -bottom-1 rounded-full border bg-card p-1 text-muted-foreground opacity-0 shadow-sm group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
          aria-label="Retirer la photo de profil"
          title="Retirer la photo"
        >
          <Trash2 className="size-3" />
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
    </div>
  );
}

function BioAssistant({
  account,
  draft,
  onUse,
}: {
  account: AccountDTO;
  draft: AccountDraft;
  onUse: (bio: string) => void;
}) {
  const ready = useAiReady();
  const task = useAiTask("bio");
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const limit = PLATFORMS[account.platform].bioLimit;

  function generate() {
    if (!ready()) return;
    setOpen(true);
    void task.run({
      platform: account.platform,
      handle: cleanHandle(draft.handle),
      currentBio: draft.bio,
      bioLink: draft.bioLink,
      instruction,
    });
  }

  function close() {
    task.cancel();
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="outline" size="sm" className="self-start" onClick={generate}>
        <AiIcon /> Proposer des bios
      </Button>
      {open && (
        <AssistantPanel title={`Bios pour ${PLATFORMS[account.platform].label}`} onClose={close}>
          {task.state.status === "running" && (
            <AiProgress phase={task.state.phase} startedAt={task.state.startedAt} onCancel={close} />
          )}
          {task.state.status === "error" && <AiError message={task.state.error} onRetry={generate} />}
          {task.state.status === "done" && (
            <>
              {task.state.result.bios.map((bio, i) => (
                <Proposal
                  key={i}
                  text={bio}
                  limit={limit}
                  actionLabel="Utiliser"
                  onUse={() => {
                    onUse(bio);
                    close();
                  }}
                />
              ))}
              <div className="flex gap-2">
                <Input
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      generate();
                    }
                  }}
                  placeholder="Affiner (optionnel) : plus fun, mentionner…"
                  className="h-8"
                />
                <Button size="sm" variant="outline" onClick={generate}>
                  <RefreshCw /> Relancer
                </Button>
              </div>
            </>
          )}
        </AssistantPanel>
      )}
    </div>
  );
}

export function AccountCard({ account }: { account: AccountDTO }) {
  const config = PLATFORMS[account.platform];
  const [draft, setDraft] = useState<AccountDraft>(() => draftFrom(account));
  const [pending, startTransition] = useTransition();
  const dirty = JSON.stringify(draft) !== JSON.stringify(draftFrom(account));

  const update = <K extends keyof AccountDraft>(key: K, value: AccountDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const handle = cleanHandle(draft.handle);
  const profileLink = draft.profileUrl.trim() || (handle ? config.profileUrl(handle) : "");
  const bioLength = [...draft.bio].length;
  const status = ACCOUNT_STATUSES.find((s) => s.id === draft.status) ?? ACCOUNT_STATUSES[0];
  const done = draft.checklist.filter((c) => c.done).length;
  const id = (name: string) => `${account.platform}-${name}`;

  function save() {
    startTransition(async () => {
      const result = await saveAccount({
        id: account.id,
        ...draft,
        handle,
        checklist: draft.checklist
          .filter((c) => c.label.trim())
          .map(({ label, done }) => ({ label, done })),
      });
      if (result.ok) {
        setDraft((prev) => ({ ...prev, handle }));
        toast.success(`Compte ${config.label} enregistré`);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <section
      className="flex flex-col overflow-hidden rounded-xl border bg-card"
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
          e.preventDefault();
          save();
        }
      }}
    >
      <header className="flex items-center gap-4 border-b p-5">
        <Avatar account={account} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <PlatformBadge platform={account.platform} />
            {draft.checklist.length > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-success"
                    style={{ width: `${(done / draft.checklist.length) * 100}%` }}
                  />
                </span>
                {done}/{draft.checklist.length}
              </span>
            )}
          </div>
          <h2 className="truncate text-lg font-semibold">
            {handle ? `@${handle}` : <span className="text-muted-foreground">Pseudo à définir</span>}
          </h2>
          {profileLink && (
            <a
              href={profileLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center gap-1 text-xs text-primary hover:underline"
            >
              Ouvrir le profil <ExternalLink className="size-3" />
            </a>
          )}
        </div>
        <Select value={draft.status} onValueChange={(v) => update("status", v)}>
          <SelectTrigger className="w-36" aria-label="Statut du compte">
            <SelectValue>
              <ColorDot color={status.color} />
              {status.label}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ACCOUNT_STATUSES.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                <ColorDot color={s.color} />
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      <Tabs defaultValue="profile" className="flex flex-col">
        <div className="border-b px-5 py-2">
          <TabsList>
            <TabsTrigger value="profile">Profil</TabsTrigger>
            <TabsTrigger value="goals">Objectifs</TabsTrigger>
            <TabsTrigger value="checklist">
              Checklist
              <span className="text-muted-foreground tabular-nums">
                {done}/{draft.checklist.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="profile" className="flex flex-col gap-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Pseudo" htmlFor={id("handle")}>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                  @
                </span>
                <Input
                  id={id("handle")}
                  value={draft.handle}
                  onChange={(e) => update("handle", e.target.value)}
                  placeholder="ta_marque"
                  className="pl-7"
                />
              </div>
            </Field>
            <Field label="Type de compte" htmlFor={id("type")}>
              <Select value={draft.accountType} onValueChange={(v) => update("accountType", v)}>
                <SelectTrigger id={id("type")} className="w-full">
                  <SelectValue>{ACCOUNT_TYPES.find((t) => t.id === draft.accountType)?.label}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Adresse du profil" htmlFor={id("url")} className="sm:col-span-2">
              <Input
                id={id("url")}
                type="url"
                value={draft.profileUrl}
                onChange={(e) => update("profileUrl", e.target.value)}
                placeholder={handle ? config.profileUrl(handle) : "Déduite du pseudo si vide"}
              />
            </Field>
          </div>

          <Field label="Bio" htmlFor={id("bio")}>
            <Textarea
              id={id("bio")}
              value={draft.bio}
              onChange={(e) => update("bio", e.target.value)}
              placeholder="Ce que fait la marque, pour qui, et pourquoi s'abonner"
              className="min-h-20"
            />
            <span
              className={cn(
                "text-xs text-muted-foreground",
                bioLength > config.bioLimit && "font-medium text-destructive",
              )}
            >
              {bioLength} / {config.bioLimit} caractères
              {bioLength > config.bioLimit && ` · ${config.label} refusera une bio aussi longue`}
            </span>
          </Field>
          <BioAssistant account={account} draft={draft} onUse={(bio) => update("bio", bio)} />
          {account.platform === "instagram" && (
            <ProfileAudit
              handle={cleanHandle(draft.handle)}
              bio={draft.bio}
              bioLink={draft.bioLink}
              hasPhoto={account.avatarUrl !== null}
              onUseBio={(bio) => update("bio", bio)}
            />
          )}

          <Field label="Lien en bio" htmlFor={id("link")}>
            <Input
              id={id("link")}
              type="url"
              value={draft.bioLink}
              onChange={(e) => update("bioLink", e.target.value)}
              placeholder="https://ta-marque.fr"
            />
          </Field>
        </TabsContent>

        <TabsContent value="goals" className="flex flex-col gap-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Abonnés visés" htmlFor={id("followers")}>
              <Input
                id={id("followers")}
                type="number"
                min={0}
                value={draft.followersGoal ?? ""}
                onChange={(e) => update("followersGoal", toCount(e.target.value))}
                placeholder="Ex. : 1 000"
              />
            </Field>
            <Field label="Posts par semaine visés" htmlFor={id("frequency")}>
              <Input
                id={id("frequency")}
                type="number"
                min={0}
                max={50}
                value={draft.postsPerWeek ?? ""}
                onChange={(e) => update("postsPerWeek", toCount(e.target.value))}
                placeholder="Ex. : 3"
              />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">
            L&apos;Accueil et le calendrier signalent les semaines qui n&apos;atteignent pas ce rythme.
          </p>
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <Switch
              id={id("default")}
              checked={draft.defaultOnPosts}
              onCheckedChange={(checked) => update("defaultOnPosts", checked)}
              className="mt-0.5"
            />
            <Label htmlFor={id("default")} className="flex flex-col items-start gap-1 font-normal">
              <span className="text-sm font-medium">Coché d&apos;office sur les nouveaux posts</span>
              <span className="text-xs text-muted-foreground">
                Pour les réseaux où tu publies presque tout ; tu peux toujours le décocher dans la fiche d&apos;un
                post.
              </span>
            </Label>
          </div>
        </TabsContent>

        <TabsContent value="checklist" className="p-5">
          <ChecklistEditor items={draft.checklist} onChange={(items) => update("checklist", items)} />
        </TabsContent>

        <TabsContent value="notes" className="flex flex-col gap-1.5 p-5">
          <Label htmlFor={id("notes")} className="sr-only">
            Notes
          </Label>
          <Textarea
            id={id("notes")}
            value={draft.notes}
            onChange={(e) => update("notes", e.target.value)}
            placeholder="Adresse e-mail utilisée, idées de stories à la une, comptes à suivre…"
            className="min-h-32"
          />
          <p className="text-xs text-muted-foreground">
            Ne note pas de mot de passe ici : utilise un gestionnaire de mots de passe.
          </p>
        </TabsContent>
      </Tabs>

      <footer className="sticky bottom-0 mt-auto flex items-center justify-end gap-3 border-t bg-card px-5 py-3">
        {dirty && <span className="text-xs text-muted-foreground">Modifications non enregistrées</span>}
        <Button size="sm" onClick={save} disabled={!dirty || pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />}
          Enregistrer
        </Button>
      </footer>
    </section>
  );
}
