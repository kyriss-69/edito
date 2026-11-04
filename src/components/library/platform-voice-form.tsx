"use client";

import { Loader2, RotateCcw, Save } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { useApp } from "@/components/app-provider";
import { PlatformIcon } from "@/components/icons/platform-icon";
import { Button } from "@/components/ui/button";
import { CharCounter, FormField } from "@/components/ui/form-field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { usedPlatforms } from "@/lib/accounts";
import {
  DEFAULT_VOICES,
  VOICE_FIELD_MAX,
  VOICE_FIELDS,
  resolveVoice,
  type PlatformVoice,
} from "@/lib/ai/platform-voice";
import type { AiSettings } from "@/lib/ai/settings";
import { PLATFORMS, type PlatformId } from "@/lib/platforms";
import { saveAiSettings } from "@/server/actions";

type Voices = Record<PlatformId, PlatformVoice>;

function effectiveVoices(stored: AiSettings["voices"], platforms: readonly PlatformId[]): Voices {
  return Object.fromEntries(platforms.map((p) => [p, resolveVoice(p, stored[p])])) as Voices;
}

/** Ne garde que ce qui diffère des consignes par défaut (vide = défaut, mis à jour avec l'app). */
function toOverrides(voices: Partial<Voices>): AiSettings["voices"] {
  const result: AiSettings["voices"] = {};
  for (const [platform, voice] of Object.entries(voices) as [PlatformId, PlatformVoice][]) {
    const base = DEFAULT_VOICES[platform];
    const override = {
      tone: voice.tone.trim() === base.tone ? "" : voice.tone,
      writing: voice.writing.trim() === base.writing ? "" : voice.writing,
      hashtags: voice.hashtags.trim() === base.hashtags ? "" : voice.hashtags,
      bio: voice.bio.trim() === base.bio ? "" : voice.bio,
    };
    if (Object.values(override).some((v) => v.trim())) result[platform] = override;
  }
  return result;
}

/** Façon de s'exprimer de l'assistant sur chaque réseau utilisé par la marque. */
/** Guide (skill) du réseau envoyé à l'assistant, en plus de ces consignes. */
function SkillStatus({ platform }: { platform: PlatformId }) {
  const { meta } = useApp();
  const info = meta.platformSkills.find((s) => s.platform === platform);
  if (!info) return null;
  const found = info.files.length - info.missing.length;
  return (
    <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
      {found > 0 ? (
        <>
          Guide expert ({found} fichier{found > 1 ? "s" : ""}, {info.chars.toLocaleString("fr-FR")} caractères) :{" "}
          {info.files.map((f) => `brand/skills/${f}`).join(", ")}. Ces consignes restent prioritaires sur le guide.
        </>
      ) : (
        <>Aucun guide trouvé dans brand/skills/ pour ce réseau.</>
      )}
      {found > 0 && info.missing.length > 0 && <> Manquant : {info.missing.join(", ")}.</>}
    </p>
  );
}

export function PlatformVoiceForm() {
  const { meta } = useApp();
  const platforms = usedPlatforms(meta.accounts);
  const [voices, setVoices] = useState(() => effectiveVoices(meta.ai.voices, platforms));
  const [synced, setSynced] = useState(meta.ai.voices);
  if (synced !== meta.ai.voices) {
    setSynced(meta.ai.voices);
    setVoices(effectiveVoices(meta.ai.voices, platforms));
  }
  const [tab, setTab] = useState<PlatformId | undefined>(platforms[0]);
  const [pending, startTransition] = useTransition();
  const dirty =
    JSON.stringify(voices) !== JSON.stringify(effectiveVoices(meta.ai.voices, platforms));

  if (!platforms.length) return null;
  const current = tab && platforms.includes(tab) ? tab : platforms[0];

  const set = (platform: PlatformId, key: keyof PlatformVoice, value: string) =>
    setVoices((prev) => ({ ...prev, [platform]: { ...prev[platform], [key]: value } }));

  function save() {
    startTransition(async () => {
      // Les réseaux non utilisés gardent leurs réglages.
      const result = await saveAiSettings({ ...meta.ai, voices: { ...meta.ai.voices, ...toOverrides(voices) } });
      if (result.ok) toast.success("Consignes par réseau enregistrées");
      else toast.error(result.error);
    });
  }

  return (
    <section
      className="mx-auto flex w-full max-w-3xl flex-col gap-4 rounded-xl border bg-card p-5"
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
          e.preventDefault();
          save();
        }
      }}
    >
      <div>
        <h2 className="font-semibold">Ton par réseau</h2>
        <p className="text-sm text-muted-foreground">
          On ne s&apos;exprime pas de la même façon sur TikTok et sur LinkedIn : l&apos;assistant suit ces consignes
          pour les légendes, les hashtags et les bios de chaque réseau, en plus du brief de marque. Elles sont
          préremplies avec les bonnes pratiques actuelles ; adapte-les à ta marque.
        </p>
      </div>
      <Tabs value={current} onValueChange={(v) => setTab(v as PlatformId)}>
        <TabsList className="flex-wrap">
          {platforms.map((p) => (
            <TabsTrigger key={p} value={p}>
              <PlatformIcon platform={p} /> {PLATFORMS[p].label}
            </TabsTrigger>
          ))}
        </TabsList>
        {platforms.map((p) => {
          const isDefault = VOICE_FIELDS.every((f) => voices[p][f.id].trim() === DEFAULT_VOICES[p][f.id]);
          return (
            <TabsContent key={p} value={p} className="mt-4 flex flex-col gap-4">
              <SkillStatus platform={p} />
              {VOICE_FIELDS.map((field) => (
                <FormField key={field.id} label={field.label} htmlFor={`voice-${p}-${field.id}`} hint={field.hint}>
                  <Textarea
                    id={`voice-${p}-${field.id}`}
                    value={voices[p][field.id]}
                    onChange={(e) => set(p, field.id, e.target.value)}
                    placeholder={DEFAULT_VOICES[p][field.id]}
                    className="min-h-20"
                  />
                  <CharCounter value={voices[p][field.id]} max={VOICE_FIELD_MAX} />
                </FormField>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="self-start"
                disabled={isDefault}
                onClick={() => setVoices((prev) => ({ ...prev, [p]: { ...DEFAULT_VOICES[p] } }))}
              >
                <RotateCcw /> Revenir aux consignes conseillées pour {PLATFORMS[p].label}
              </Button>
            </TabsContent>
          );
        })}
      </Tabs>

      {dirty && (
        <div className="sticky bottom-4 z-10 flex items-center justify-end gap-3 self-end rounded-xl border bg-popover p-2 pl-4 shadow-lg">
          <span className="text-xs text-muted-foreground">Modifications non enregistrées</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setVoices(effectiveVoices(meta.ai.voices, platforms))}
            disabled={pending}
          >
            Annuler
          </Button>
          <Button size="sm" onClick={save} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Save />}
            Enregistrer
          </Button>
        </div>
      )}
    </section>
  );
}
