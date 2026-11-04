"use client";

import { AlertTriangle, Copy, Pencil, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";

import { AiIcon } from "@/components/ai/ai-progress";
import {
  AdaptPanel,
  CaptionAssistant,
  HashtagAssistant,
  useAdaptCaption,
} from "@/components/ai/caption-assistant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { lintCaption } from "@/lib/caption-lint";
import { checkCaption, composeCaption, extractHashtags, platformHashtags, trimHashtags } from "@/lib/captions";
import { PLATFORMS } from "@/lib/platforms";
import type { PostPlatformDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

import { HashtagInput } from "./hashtag-input";
import { PlatformBadge } from "./platform-badge";
import { Section } from "./editor-section";
import type { Draft } from "./post-editor";

const nf = new Intl.NumberFormat("fr-FR");

type PlatformPatch = Partial<Pick<PostPlatformDTO, "customCaption" | "customHashtags">>;

function PlatformCaption({
  entry,
  draft,
  onChange,
}: {
  entry: PostPlatformDTO;
  draft: Draft;
  onChange: (patch: PlatformPatch) => void;
}) {
  const custom = entry.customCaption !== null;
  const caption = entry.customCaption ?? draft.caption;
  const hashtags = platformHashtags(entry, draft.hashtags);
  const check = checkCaption(entry.platform, caption, hashtags);
  const lint = lintCaption(entry.platform, caption, hashtags);
  const { label, hashtagLimit } = PLATFORMS[entry.platform];
  const assistant = useAdaptCaption(draft, entry.platform);
  const commonCount = extractHashtags(draft.hashtags).length;
  const inCaption = extractHashtags(caption).length;

  async function copy() {
    await navigator.clipboard.writeText(composeCaption(caption, hashtags));
    toast.success(`Texte ${label} copié`);
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <PlatformBadge platform={entry.platform} />
        <span className="text-xs text-muted-foreground">
          {custom ? "Légende personnalisée" : "Légende commune"}
        </span>
        <span
          className={cn("text-xs text-muted-foreground", check.tooLong && "font-medium text-destructive")}
        >
          · {nf.format(check.length)} / {nf.format(check.limit)} caractères
        </span>
        <div className="ml-auto flex flex-wrap gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={assistant.adapt}
            title={`Réécrire la légende commune et choisir les hashtags selon les codes de ${label}`}
          >
            <AiIcon /> Adapter à {label}
          </Button>
          <Button variant="outline" size="sm" onClick={copy} title="Copier la légende + hashtags">
            <Copy /> Copier
          </Button>
        </div>
      </div>
      <AdaptPanel
        platform={entry.platform}
        state={assistant.state}
        onRetry={assistant.adapt}
        onClose={assistant.close}
        onUse={(text, tags) => {
          onChange({ customCaption: text, ...(tags.length ? { customHashtags: tags.join(" ") } : {}) });
          toast.success(`Légende ${label} personnalisée`);
        }}
      />

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs text-muted-foreground">Légende {label}</Label>
          {custom ? (
            <Button variant="ghost" size="sm" onClick={() => onChange({ customCaption: null })}>
              <RotateCcw /> Reprendre la légende commune
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => onChange({ customCaption: draft.caption })}>
              <Pencil /> Modifier pour {label}
            </Button>
          )}
        </div>
        {custom ? (
          <Textarea
            value={entry.customCaption ?? ""}
            onChange={(e) => onChange({ customCaption: e.target.value })}
            placeholder={`Légende spécifique à ${label}`}
            className="min-h-24"
          />
        ) : (
          <p className="text-xs text-muted-foreground">
            {draft.caption.trim()
              ? "Le texte de la légende commune ci-dessus est publié tel quel."
              : "Écris la légende commune ci-dessus, ou adapte-la à ce réseau."}
          </p>
        )}
        {lint.visible && lint.cut && (
          <p className="rounded-md bg-muted/60 px-2.5 py-1.5 text-xs whitespace-pre-wrap text-muted-foreground">
            <span className="font-medium text-foreground">Visible avant « plus » : </span>
            {lint.visible}…
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label className="text-xs text-muted-foreground">
            Hashtags {label}
            {hashtagLimit !== null && (
              <span className={cn("ml-1", check.tooManyHashtags && "font-medium text-destructive")}>
                ({check.hashtagCount} / {hashtagLimit})
              </span>
            )}
          </Label>
          <div className="flex flex-wrap gap-1">
            {entry.customHashtags === null ? (
              <>
                {hashtagLimit !== null && commonCount > hashtagLimit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onChange({ customHashtags: trimHashtags(draft.hashtags, hashtagLimit) })}
                  >
                    Garder les {hashtagLimit} premiers
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => onChange({ customHashtags: draft.hashtags })}>
                  <Pencil /> Choisir pour {label}
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => onChange({ customHashtags: null })}>
                <RotateCcw /> Reprendre les hashtags communs
              </Button>
            )}
          </div>
        </div>
        {entry.customHashtags === null ? (
          <p className="text-xs text-muted-foreground">
            {hashtags.trim() ? (
              <>
                Hashtags communs : <span className="text-foreground">{hashtags}</span>
              </>
            ) : (
              "Aucun hashtag."
            )}
          </p>
        ) : (
          <HashtagInput value={entry.customHashtags} onChange={(value) => onChange({ customHashtags: value })} />
        )}
        {check.tooManyHashtags && (
          <p className="flex items-start gap-1.5 text-xs text-destructive">
            <XCircle className="mt-0.5 size-3.5 shrink-0" />
            {label} accepte {hashtagLimit} hashtags au maximum
            {inCaption > 0 && ` (dont ${inCaption} écrits dans la légende)`} : choisis ceux à garder.
          </p>
        )}
      </div>

      {lint.issues.length > 0 && (
        <ul className="flex flex-col gap-1">
          {lint.issues.map((issue) => (
            <li
              key={issue.message}
              className={cn(
                "flex items-start gap-1.5 text-xs",
                issue.level === "error" ? "text-destructive" : "text-warning",
              )}
            >
              {issue.level === "error" ? (
                <XCircle className="mt-0.5 size-3.5 shrink-0" />
              ) : (
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              )}
              {issue.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CaptionSection({
  draft,
  update,
}: {
  draft: Draft;
  update: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
}) {
  return (
    <Section
      title="Légende & hashtags"
      description="La légende et les hashtags communs vont sur chaque réseau ; adapte-les ou modifie-les réseau par réseau en dessous."
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="caption" className="text-xs text-muted-foreground">
          Légende
        </Label>
        <Textarea
          id="caption"
          value={draft.caption}
          onChange={(e) => update("caption", e.target.value)}
          placeholder="Le texte qui accompagnera le post…"
          className="min-h-32"
        />
        <CaptionAssistant draft={draft} onApply={(caption) => update("caption", caption)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hashtags" className="text-xs text-muted-foreground">
          Hashtags
        </Label>
        <HashtagInput id="hashtags" value={draft.hashtags} onChange={(hashtags) => update("hashtags", hashtags)} />
        <HashtagAssistant draft={draft} onChange={(hashtags) => update("hashtags", hashtags)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cta" className="text-xs text-muted-foreground">
            Appel à l&apos;action
          </Label>
          <Input
            id="cta"
            value={draft.cta}
            onChange={(e) => update("cta", e.target.value)}
            placeholder="Rejoins la liste d'attente, lien en bio"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="link" className="text-xs text-muted-foreground">
            Lien
          </Label>
          <Input
            id="link"
            type="url"
            value={draft.link}
            onChange={(e) => update("link", e.target.value)}
            placeholder="https://…"
          />
        </div>
      </div>

      {draft.platforms.length > 0 ? (
        <div className="flex flex-col gap-2">
          {draft.platforms.map((entry) => (
            <PlatformCaption
              key={entry.platform}
              entry={entry}
              draft={draft}
              onChange={(patch) =>
                update(
                  "platforms",
                  draft.platforms.map((p) => (p.platform === entry.platform ? { ...p, ...patch } : p)),
                )
              }
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Sélectionne au moins un réseau pour voir les compteurs de caractères.
        </p>
      )}
    </Section>
  );
}
