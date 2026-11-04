import { z } from "zod";

import { FORMATS, formatLabel, type PlatformId } from "@/lib/platforms";
import { displayUrl, type CaptureDevice } from "@/lib/web";

import { buildSystemPrompt, platformTips, type BrandContext, type ChatContentPart } from "./tasks";

/**
 * Discussion avec l'assistant (page « Assistant ») : messages enregistrés,
 * outils que le modèle peut appeler (recherche web, lecture de pages, captures
 * d'écran, idées de posts) et consignes envoyées au modèle.
 */

export const CHAT_MESSAGE_MAX = 4_000;
/** Messages précédents renvoyés au modèle (les plus récents). */
export const CHAT_HISTORY_LIMIT = 16;
/** Appels d'outils par réponse, au-delà le modèle doit répondre avec ce qu'il a. */
export const CHAT_MAX_TOOL_CALLS = 8;
/** Texte d'une page web transmis au modèle. */
export const CHAT_PAGE_CHARS = 6_000;

/* ------------------------------------------------------------------ */
/* Messages enregistrés                                               */
/* ------------------------------------------------------------------ */

const ideaSchema = z.object({
  title: z.string().trim().min(1).max(200),
  hook: z.string().trim().max(1_000).default(""),
  format: z
    .string()
    .default("image")
    .transform((f) => ((FORMATS.map((x) => x.id) as string[]).includes(f) ? f : "image")),
  angle: z.string().trim().max(2_000).default(""),
});
export type ChatIdea = z.output<typeof ideaSchema>;

export type ChatToolName = "web_search" | "read_page" | "take_screenshot" | "propose_post_ideas";

export type ChatStep = {
  id: string;
  tool: ChatToolName;
  status: "running" | "done" | "error";
  /** Ce que fait l'outil, ex. « Recherche : media kit créateur ». */
  label: string;
  /** Erreur, ou précision sur le résultat (ex. « 8 résultats »). */
  detail?: string;
  /** Pages trouvées ou lues. */
  links?: { title: string; url: string }[];
  capture?: { assetId: number; title: string; url: string; device: CaptureDevice };
  ideas?: ChatIdea[];
};

export type ChatEntry = {
  id: string;
  role: "user" | "assistant";
  content: string;
  steps?: ChatStep[];
  /** Réponse interrompue (erreur ou arrêt). */
  error?: string;
  createdAt: number;
};

const entrySchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  steps: z.array(z.any()).optional(),
  error: z.string().optional(),
  createdAt: z.number(),
});

/** Lit les messages stockés en JSON (en ignorant ceux qui sont abîmés). */
export function parseChatEntries(raw: unknown): ChatEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const parsed = entrySchema.safeParse(item);
    return parsed.success ? [parsed.data as ChatEntry] : [];
  });
}

/** Titre d'une discussion d'après le premier message. */
export function chatTitle(message: string) {
  const line = message.trim().split("\n")[0].replace(/\s+/g, " ");
  return line.length > 60 ? `${line.slice(0, 57).trimEnd()}…` : line || "Nouvelle discussion";
}

/* ------------------------------------------------------------------ */
/* Messages envoyés au modèle                                         */
/* ------------------------------------------------------------------ */

export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

/** Message au format OpenAI, appels d'outils compris. */
export type AgentMessage =
  | { role: "system" | "user"; content: string | ChatContentPart[] }
  | { role: "assistant"; content: string | ChatContentPart[] | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

/** Résumé des outils utilisés, ajouté à la réponse dans l'historique envoyé au modèle. */
function describeSteps(steps: readonly ChatStep[]) {
  const lines = steps
    .filter((s) => s.status === "done")
    .map((s) => {
      if (s.capture) return `- capture d'écran « ${s.capture.title} » enregistrée dans la médiathèque (${displayUrl(s.capture.url)})`;
      if (s.ideas) return `- idées proposées : ${s.ideas.map((i) => `« ${i.title} »`).join(", ")}`;
      return `- ${s.label}`;
    });
  return lines.length ? `\n\n[Outils utilisés pour cette réponse :\n${lines.join("\n")}]` : "";
}

/** Historique de la discussion pour le modèle (les derniers messages). */
export function historyMessages(entries: readonly ChatEntry[]): AgentMessage[] {
  return entries.slice(-CHAT_HISTORY_LIMIT).flatMap((entry): AgentMessage[] => {
    if (entry.role === "user") return [{ role: "user", content: entry.content }];
    const content = `${entry.content.trim() || "(pas de texte)"}${describeSteps(entry.steps ?? [])}`;
    return [{ role: "assistant", content }];
  });
}

/* ------------------------------------------------------------------ */
/* Outils                                                             */
/* ------------------------------------------------------------------ */

export type ToolDefinition = {
  type: "function";
  function: { name: ChatToolName; description: string; parameters: Record<string, unknown> };
};

const WEB_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Recherche sur internet (résultats en français). Pour trouver des tendances, des exemples de posts, des chiffres sourcés ou des pages à lire ensuite avec read_page.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "La recherche, comme dans un moteur de recherche." } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_page",
      description:
        "Lit le texte d'une page web (le site de la marque, un article, une page trouvée avec web_search). Renvoie aussi les liens internes de la page.",
      parameters: {
        type: "object",
        properties: { url: { type: "string", description: "Adresse complète de la page, ex. https://tamarque.fr" } },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "take_screenshot",
      description:
        "Fait une capture d'écran d'une page web et l'enregistre dans la médiathèque, pour l'intégrer ensuite à un visuel (carrousel du Studio). À utiliser seulement quand l'utilisateur veut une capture.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "Adresse de la page à capturer." },
          device: {
            type: "string",
            enum: ["desktop", "mobile"],
            description: "desktop : écran d'ordinateur (à mettre dans un cadre de navigateur). mobile : écran de téléphone.",
          },
          mode: {
            type: "string",
            enum: ["page", "element"],
            description: "page : l'écran visible. element : seulement le bloc (carte, encadré) qui contient focus_text.",
          },
          focus_text: {
            type: "string",
            description: "Facultatif : un texte exact de la page. La capture fait défiler la page jusqu'à lui (ou capture son bloc en mode element).",
          },
          title: { type: "string", description: "Facultatif : titre de la capture dans la médiathèque." },
        },
        required: ["url"],
      },
    },
  },
];

const IDEAS_TOOL: ToolDefinition = {
  type: "function",
  function: {
    name: "propose_post_ideas",
    description:
      "Affiche des idées de posts sous forme de cartes, que l'utilisateur peut ajouter au tableau en un clic. À utiliser dès que tu proposes des idées de posts concrètes.",
    parameters: {
      type: "object",
      properties: {
        ideas: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string", description: "Titre court de l'idée." },
              hook: { type: "string", description: "L'accroche : première phrase du post." },
              format: { type: "string", enum: FORMATS.map((f) => f.id) },
              angle: { type: "string", description: "En 1 ou 2 phrases : ce que montre le post et pourquoi il intéresse la cible." },
            },
            required: ["title", "hook", "format", "angle"],
          },
        },
      },
      required: ["ideas"],
    },
  },
};

/** Outils de recherche seuls (recherche et lecture de pages), pour les recherches d'un post. */
export function researchTools(): ToolDefinition[] {
  return WEB_TOOLS.filter((t) => t.function.name !== "take_screenshot");
}

export function chatTools({ web }: { web: boolean }): ToolDefinition[] {
  return web ? [...WEB_TOOLS, IDEAS_TOOL] : [IDEAS_TOOL];
}

const toolInputs = {
  web_search: z.object({ query: z.string().trim().min(1).max(300) }),
  read_page: z.object({ url: z.string().trim().min(1).max(2_000) }),
  take_screenshot: z.object({
    url: z.string().trim().min(1).max(2_000),
    device: z.enum(["desktop", "mobile"]).catch("desktop").default("desktop"),
    mode: z.enum(["page", "element"]).catch("page").default("page"),
    focus_text: z.string().max(200).nullish(),
    title: z.string().max(120).nullish(),
  }),
  propose_post_ideas: z.object({ ideas: z.array(ideaSchema).min(1).max(15) }),
};

export type ToolInput<T extends ChatToolName> = z.output<(typeof toolInputs)[T]>;

export type ParsedToolCall =
  | { [T in ChatToolName]: { ok: true; name: T; input: ToolInput<T> } }[ChatToolName]
  | { ok: false; name: string; error: string };

/** Lit un appel d'outil du modèle (arguments JSON, parfois approximatifs). */
export function parseToolCall(name: string, rawArguments: string): ParsedToolCall {
  if (!(name in toolInputs)) return { ok: false, name, error: `Outil inconnu : ${name}` };
  let args: unknown;
  try {
    args = rawArguments.trim() ? JSON.parse(rawArguments) : {};
  } catch {
    return { ok: false, name, error: "Arguments invalides (JSON attendu)." };
  }
  const tool = name as ChatToolName;
  const parsed = toolInputs[tool].safeParse(args);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, name, error: `Arguments invalides : ${issue?.path.join(".") || "?"} ${issue?.message ?? ""}`.trim() };
  }
  return { ok: true, name: tool, input: parsed.data } as ParsedToolCall;
}

/* ------------------------------------------------------------------ */
/* Consignes                                                          */
/* ------------------------------------------------------------------ */

export type ChatContext = {
  brand: BrandContext;
  web: boolean;
  siteUrl: string;
  today: Date;
  pillars: string[];
  /** Posts déjà prévus, pour éviter les doublons (titre, statut, date éventuelle). */
  posts: { title: string; status: string; date: string | null; format: string }[];
  /** Réseaux utilisés par la marque, avec leurs consignes d'écriture. */
  platforms?: PlatformId[];
  /** Écrans de l'app rangés dans la médiathèque (titres). */
  screens?: string[];
};

export function buildChatSystemPrompt(context: ChatContext): string {
  const { brand, web, siteUrl, today, pillars, posts, platforms, screens } = context;
  const lines: (string | false)[] = [
    buildSystemPrompt(brand, null),
    "",
    "# Ton rôle dans cette discussion",
    `Tu es le partenaire de réflexion de l'équipe marketing de ${brand.name || "la marque"} : tu l'aides à trouver des idées de posts, à les affiner, à rédiger et à préparer les visuels.`,
    `Nous sommes le ${today.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.`,
    "- Réponds en français, de façon concrète et directe, comme un collègue expérimenté. Pose une question quand la demande est floue.",
    "- Mise en forme simple : paragraphes courts, listes à tirets, **gras** pour l'essentiel. Pas de tableaux.",
    "- Quand tu proposes des idées de posts, appelle l'outil propose_post_ideas (l'utilisateur pourra les ajouter au tableau), puis commente-les brièvement.",
  ];
  if (web) {
    lines.push(
      "- Tu as accès à internet avec les outils web_search, read_page et take_screenshot. Utilise-les quand ils apportent quelque chose (le site de la marque, une tendance, un fait à vérifier), pas par réflexe.",
      Boolean(siteUrl) && `- Site de la marque : ${siteUrl}. Lis-le avec read_page pour coller à ses messages.`,
      "- Cite tes sources (adresse des pages) quand tu t'appuies sur une page lue. N'invente jamais le contenu d'une page que tu n'as pas lue.",
      "- Les captures d'écran (take_screenshot) sont rangées dans la médiathèque : l'utilisateur peut les placer sur les slides de ses carrousels dans le Studio (cadre de navigateur ou de téléphone).",
    );
  } else {
    lines.push("- Tu n'as pas accès à internet dans cette discussion : appuie-toi sur ce que tu sais de la marque.");
  }
  lines.push(
    "- Quand tu rédiges pour un réseau (légende, bio, hashtags), suis les codes de ce réseau ci-dessous : on n'écrit pas de la même façon sur TikTok et sur LinkedIn.",
    "",
    "# Codes des réseaux de la marque",
    platformTips(platforms ?? [], brand, ["tone", "writing", "hashtags", "bio"]),
  );
  if (screens?.length) {
    lines.push(
      "",
      "# Écrans de l'app dans la médiathèque",
      "Captures de l'app (en construction, données de démonstration) prêtes à être posées sur les slides d'un carrousel dans le Studio. Quand tu proposes un carrousel, indique pour chaque slide l'écran à utiliser, par son titre. Les noms et chiffres visibles sont fictifs : ne les cite jamais comme réels.",
      ...screens.map((title) => `- ${title}`),
    );
  }
  if (pillars.length) lines.push("", "# Piliers de contenu", ...pillars.map((p) => `- ${p}`));
  if (posts.length) {
    lines.push(
      "",
      "# Posts déjà prévus (ne les propose pas à nouveau)",
      ...posts.map((p) => `- ${p.title} (${formatLabel(p.format)}, ${p.status}${p.date ? `, ${p.date}` : ""})`),
    );
  }
  return lines.filter((line) => line !== false).join("\n");
}
