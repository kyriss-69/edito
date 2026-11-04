"use client";

import { CheckCircle2, Eye, Globe, Loader2, PlugZap, Save, XCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { AiIcon } from "@/components/ai/ai-progress";
import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import { FormField as Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { activeModel, AI_PROVIDERS, type AiSettings } from "@/lib/ai/settings";
import { saveAiSettings, saveOpenRouterKey } from "@/server/actions";

type Connection =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "ok"; models: string[]; vision: string[] }
  | { status: "error"; message: string };

/** Connexion de l'assistant IA : LM Studio en local ou OpenRouter (modèle, créativité). */
export function AiSettingsForm() {
  const { meta } = useApp();
  const [form, setForm] = useState<AiSettings>(meta.ai);
  /** Nouvelle clé OpenRouter saisie (vide : on garde celle enregistrée). */
  const [key, setKey] = useState("");
  const [connection, setConnection] = useState<Connection>({ status: "idle" });
  const [pending, startTransition] = useTransition();
  const openrouter = form.provider === "openrouter";
  const modelKey = openrouter ? "openrouterModel" : "model";
  // Le brief de marque se règle ailleurs : on ne compare que la connexion et l'accès à internet.
  const dirty =
    Boolean(key.trim()) || JSON.stringify({ ...form, brand: null }) !== JSON.stringify({ ...meta.ai, brand: null });

  async function testConnection() {
    setConnection({ status: "testing" });
    try {
      const res = openrouter
        ? await fetch("/api/ai/models", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: key.trim() }),
          })
        : await fetch(`/api/ai/models?baseUrl=${encodeURIComponent(form.baseUrl)}`);
      const body = (await res.json()) as { models?: string[]; vision?: string[]; error?: string };
      if (!res.ok || !body.models) {
        setConnection({ status: "error", message: body.error ?? "Connexion impossible" });
        return;
      }
      const models = body.models;
      setConnection({ status: "ok", models, vision: body.vision ?? [] });
      // Présélectionne un modèle si aucun n'est choisi : Ministral en local, un Qwen gratuit sur OpenRouter.
      if (!activeModel(form) && models.length) {
        const preferred = models.find((m) => (openrouter ? /qwen.*:free$/i : /ministral/i).test(m)) ?? models[0];
        setForm((prev) => ({ ...prev, [modelKey]: preferred }));
      }
    } catch {
      setConnection({ status: "error", message: "Connexion impossible" });
    }
  }

  function save() {
    startTransition(async () => {
      if (key.trim()) {
        const saved = await saveOpenRouterKey(key);
        if (!saved.ok) {
          toast.error(saved.error);
          return;
        }
        setKey("");
      }
      // Le brief de marque se règle dans Marque › Identité : on garde celui enregistré.
      const result = await saveAiSettings({ ...form, brand: meta.ai.brand });
      if (result.ok) toast.success("Réglages de l'assistant enregistrés");
      else toast.error(result.error);
    });
  }

  const vision = connection.status === "ok" ? connection.vision : [];
  const model = activeModel(form);
  const models =
    connection.status === "ok"
      ? Array.from(new Set([...connection.models, ...(model ? [model] : [])]))
      : model
        ? [model]
        : [];

  return (
    <section className="flex flex-col gap-6 rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <AiIcon className="size-4" /> Assistant IA
          </h2>
          <p className="text-sm text-muted-foreground">
            Génère des légendes, des hashtags et des idées de posts avec un modèle local (LM Studio) ou en ligne
            (OpenRouter). Ce que
            l&apos;assistant sait de ta marque se règle dans Marque › Identité.
          </p>
        </div>
        <Button onClick={save} disabled={!dirty || pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />}
          Enregistrer
        </Button>
      </div>

      <div className="grid gap-6">
        <div className="flex flex-col gap-4">
          <Field label="Fournisseur" htmlFor="ai-provider">
            <Select
              value={form.provider}
              onValueChange={(provider) => {
                setForm((prev) => ({ ...prev, provider: provider as AiSettings["provider"] }));
                setConnection({ status: "idle" });
              }}
            >
              <SelectTrigger id="ai-provider" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_PROVIDERS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {openrouter ? (
            <Field
              label="Clé d'API OpenRouter"
              htmlFor="ai-openrouter-key"
              hint={
                meta.openrouterKey
                  ? "Une clé est enregistrée (gardée sur cet ordinateur, jamais envoyée à la page). Saisis-en une autre pour la remplacer."
                  : "À créer sur openrouter.ai/keys. Gardée sur cet ordinateur, jamais envoyée à la page."
              }
            >
              <div className="flex gap-2">
                <Input
                  id="ai-openrouter-key"
                  type="password"
                  autoComplete="off"
                  value={key}
                  onChange={(e) => {
                    setKey(e.target.value);
                    setConnection({ status: "idle" });
                  }}
                  placeholder={meta.openrouterKey ? "•••••••• (clé enregistrée)" : "sk-or-v1-…"}
                />
                <Button
                  variant="outline"
                  onClick={testConnection}
                  disabled={connection.status === "testing" || (!key.trim() && !meta.openrouterKey)}
                >
                  {connection.status === "testing" ? <Loader2 className="animate-spin" /> : <PlugZap />}
                  Tester
                </Button>
              </div>
            </Field>
          ) : (
          <Field
            label="Adresse du serveur"
            htmlFor="ai-base-url"
            hint="Dans LM Studio : onglet Developer → Start Server (port 1234 par défaut)."
          >
            <div className="flex gap-2">
              <Input
                id="ai-base-url"
                value={form.baseUrl}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, baseUrl: e.target.value }));
                  setConnection({ status: "idle" });
                }}
                placeholder="http://localhost:1234"
              />
              <Button
                variant="outline"
                onClick={testConnection}
                disabled={connection.status === "testing"}
              >
                {connection.status === "testing" ? <Loader2 className="animate-spin" /> : <PlugZap />}
                Tester
              </Button>
            </div>
          </Field>
          )}
          {connection.status === "ok" && (
            <p className="flex items-center gap-1.5 text-sm text-success">
              <CheckCircle2 className="size-4" /> Connecté · {connection.models.length} modèle(s)
              disponible(s)
            </p>
          )}
          {connection.status === "error" && (
            <p className="flex items-start gap-1.5 text-sm text-destructive">
              <XCircle className="mt-0.5 size-4 shrink-0" /> {connection.message}
            </p>
          )}

          <Field
            label="Modèle"
            htmlFor="ai-model"
            hint={
              models.length === 0
                ? "Clique sur « Tester » pour charger la liste des modèles."
                : openrouter
                  ? "Les modèles « :free » sont gratuits : 50 demandes par jour (1 000 après un achat unique de 10 $ de crédit). Une demande de l'assistant avec recherche web en utilise plusieurs. Seuls les modèles qui savent appeler des outils sont listés."
                  : "Conseil : dans LM Studio, règle la longueur de contexte du modèle sur 8 000 tokens ou plus. Les modèles « vision » peuvent aussi analyser les photos et vidéos des posts."
            }
          >
            <Select
              value={model || undefined}
              onValueChange={(value) => setForm((prev) => ({ ...prev, [modelKey]: value }))}
              disabled={models.length === 0}
            >
              <SelectTrigger id="ai-model" className="w-full">
                <SelectValue placeholder="Aucun modèle choisi">{model || undefined}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                    {vision.includes(m) && (
                      <span className="ml-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Eye className="size-3.5" /> vision
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            label={`Créativité : ${form.temperature.toFixed(1)}`}
            htmlFor="ai-temperature"
            hint="Plus bas : textes plus sages et réguliers. Plus haut : plus variés et surprenants."
          >
            <input
              id="ai-temperature"
              type="range"
              min={0}
              max={1.2}
              step={0.1}
              value={form.temperature}
              onChange={(e) => setForm((prev) => ({ ...prev, temperature: Number(e.target.value) }))}
              className="accent-primary"
            />
          </Field>
        </div>

        <div className="flex flex-col gap-4 border-t pt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Globe className="size-4 text-muted-foreground" /> Accès à internet
              </h3>
              <p className="text-sm text-muted-foreground">
                Dans la discussion avec l&apos;assistant : recherche sur le web, lecture de pages et captures
                d&apos;écran (rangées dans la médiathèque). Les pages sont ouvertes avec Google Chrome, sans fenêtre.
              </p>
            </div>
            <Switch
              checked={form.web.enabled}
              onCheckedChange={(enabled) => setForm((prev) => ({ ...prev, web: { ...prev.web, enabled } }))}
              aria-label="Accès à internet"
            />
          </div>
          <Field
            label="Site de la marque"
            htmlFor="ai-site-url"
            hint="Lu par l'assistant pour coller aux messages du site, et proposé pour les captures. Son analyse se lance dans Marque › Identité."
          >
            <Input
              id="ai-site-url"
              value={form.web.siteUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, web: { ...prev.web, siteUrl: e.target.value } }))}
              placeholder="https://tamarque.fr"
            />
          </Field>
        </div>
      </div>
    </section>
  );
}
