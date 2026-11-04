import { z } from "zod";

import { PLATFORMS, type PlatformId } from "@/lib/platforms";

/**
 * Façon de s'exprimer de l'assistant sur chaque réseau (ton, écriture, hashtags, bio).
 * Les valeurs par défaut résument les bonnes pratiques 2026 (accroche avant la coupure « plus »,
 * mots-clés pour la recherche interne des réseaux, peu de hashtags ciblés) ; chaque champ
 * peut être réécrit dans Marque › Identité (clé `ai.voices`, vide = valeur par défaut).
 */
export type PlatformVoice = {
  /** Ton et registre de langue. */
  tone: string;
  /** Structure, longueur, accroche, appel à l'action. */
  writing: string;
  /** Nombre et choix des hashtags. */
  hashtags: string;
  /** Bio / présentation du profil. */
  bio: string;
};

export const VOICE_FIELDS = [
  { id: "tone", label: "Ton", hint: "Registre, personnalité, façon de parler au public." },
  { id: "writing", label: "Écriture", hint: "Accroche, longueur, structure, appel à l'action." },
  { id: "hashtags", label: "Hashtags", hint: "Combien, lesquels, où les placer." },
  { id: "bio", label: "Bio du profil", hint: "Ce que doit dire la bio et comment." },
] as const satisfies readonly { id: keyof PlatformVoice; label: string; hint: string }[];

export const VOICE_FIELD_MAX = 1_500;

export const DEFAULT_VOICES: Record<PlatformId, PlatformVoice> = {
  instagram: {
    tone: "Inspirant, proche et visuel : on parle comme à une amie ou un ami, avec de l'énergie positive. Phrases simples, vocabulaire du quotidien, une touche d'humour bienvenue. On montre plus qu'on ne vend.",
    writing:
      "Accroche dans les 125 premiers caractères (seuls visibles avant « plus ») : une promesse, une question ou un chiffre. Puis 2 à 5 paragraphes courts et aérés (idéalement 300 à 1 000 caractères) qui apportent de la valeur : astuce, coulisse, mini-histoire. Glisse naturellement les mots-clés que le public taperait dans la recherche Instagram (la légende compte plus que les hashtags). Termine par un seul appel à l'action clair : enregistrer, partager, commenter ou « lien en bio ».",
    hashtags:
      "3 à 5 hashtags maximum, ciblés et en rapport direct avec le sujet : 1 ou 2 de niche, 1 ou 2 plus larges, et éventuellement celui de la marque. Pas de hashtags génériques (#love, #instagood). En fin de légende.",
    bio: "2 ou 3 lignes courtes : ce que fait la marque et pour qui, le bénéfice principal, puis une invitation à cliquer sur le lien. Mots-clés recherchables, 1 ou 2 emojis comme repères visuels. Le lien est affiché à part, ne l'écris pas dans la bio.",
  },
  tiktok: {
    tone: "Spontané, direct et authentique, comme si on parlait face caméra. Langage oral, phrases très courtes, humour et autodérision bienvenus. Surtout pas de ton corporate ni publicitaire : on partage, on ne vend pas.",
    writing:
      "C'est la vidéo qui porte le message : légende courte (idéalement 100 à 150 caractères) qui complète la vidéo sans la répéter. Mets le mot-clé principal dans les 80 premiers caractères, car TikTok est utilisé comme un moteur de recherche. Une question ou une phrase qui donne envie de regarder jusqu'au bout ou de commenter (« Et toi, tu fais comment ? »). Suggère aussi un texte à afficher à l'écran dans les 3 premières secondes quand c'est utile.",
    hashtags:
      "3 à 5 hashtags : 1 ou 2 de niche, 1 ou 2 du domaine et éventuellement un hashtag tendance pertinent. Jamais de #fyp / #pourtoi, qui n'apportent rien. Trop de hashtags brouille le sujet.",
    bio: "Une seule phrase percutante (80 caractères) : ce qu'on trouve sur le compte et pourquoi s'abonner, avec un ton décontracté. Pas de lien dans le texte.",
  },
  youtube: {
    tone: "Pédagogue et enthousiaste : on explique clairement, on partage son expertise sans jargon, avec une vraie personnalité. Le public vient pour apprendre ou se divertir : on tient la promesse du titre.",
    writing:
      "La légende est la description de la vidéo, lue aussi par le moteur de recherche de YouTube et Google. Les 100 à 150 premiers caractères (visibles sous la vidéo) résument la promesse avec le mot-clé principal. Puis 2 ou 3 paragraphes qui détaillent le contenu en reprenant les mots-clés naturellement, les liens utiles, et un appel à l'action (s'abonner, commenter, regarder une autre vidéo). Pour une vidéo longue, propose des chapitres (00:00 Intro…).",
    hashtags:
      "3 hashtags suffisent (les 3 premiers s'affichent au-dessus du titre), au maximum 5. Les mots-clés de la description comptent bien plus que les hashtags.",
    bio: "Description de la chaîne en 2 ou 3 phrases : ce qu'on y trouve, pour qui, à quel rythme, avec les mots-clés que le public cherche. Termine par une invitation à s'abonner.",
  },
  linkedin: {
    tone: "Professionnel mais humain : on parle à la première personne, avec des retours d'expérience concrets, des chiffres et des enseignements. Expert et accessible, jamais arrogant ni « corporate ». Pas d'humour lourd ni d'abus d'emojis (0 à 3, comme puces ou repères).",
    writing:
      "Accroche dans les 2 premières lignes (environ 200 caractères, avant « voir plus ») : une affirmation forte, un chiffre surprenant ou une situation vécue, jamais une formule générique. Puis phrases courtes, une idée par paragraphe, beaucoup d'espace, listes à puces pour les étapes. Apporte une vraie valeur (leçon, méthode, coulisse) : le post doit se suffire à lui-même. Idéalement 800 à 1 500 caractères. Termine par une question précise qui appelle des commentaires argumentés (pas « Vous en pensez quoi ? »). Évite de mettre un lien dans le texte : propose plutôt de le mettre en commentaire.",
    hashtags:
      "0 à 3 hashtags, précis et liés au métier ou au secteur, en toute fin de post. Ils servent surtout à classer le sujet, pas à gagner de la portée.",
    bio: "Présentation de la page entreprise en quelques paragraphes courts : le problème résolu, pour qui, ce qui distingue la marque, quelques preuves (chiffres, clients), puis comment la contacter ou l'essayer. Ton professionnel, mots-clés du secteur pour la recherche LinkedIn.",
  },
  facebook: {
    tone: "Chaleureux, convivial et communautaire : on parle à sa communauté comme à des voisins, on raconte, on remercie, on implique. Ton simple et accessible à tous les âges.",
    writing:
      "L'essentiel dans les 250 premiers caractères (avant « Voir plus »). Texte court à moyen, conversationnel, qui raconte une petite histoire ou partage une actualité. Une question ouverte ou un choix à faire pour lancer les commentaires. Un lien peut être ajouté en fin de post.",
    hashtags: "0 à 2 hashtags, seulement s'ils sont vraiment utiles (événement, campagne, marque).",
    bio: "Intro de la page en une phrase courte : ce que fait la marque et pour qui, avec un ton accueillant.",
  },
  x: {
    tone: "Direct, vif et concis, avec du caractère : une opinion, une observation ou un trait d'esprit. Réactif à l'actualité du domaine, conversationnel, jamais publicitaire.",
    writing:
      "Une seule idée par post, l'accroche dès les premiers mots. Coupe tout ce qui n'est pas indispensable (280 caractères maximum, hashtags compris). Formats efficaces : un constat tranché, une astuce, une question, une liste ultra-courte. Pour un sujet plus long, propose plutôt un fil (thread) de posts numérotés.",
    hashtags: "0 à 2 hashtags, intégrés dans la phrase quand c'est naturel ; aucun vaut mieux qu'un hashtag forcé.",
    bio: "Une ou deux phrases (160 caractères) : ce que fait la marque, pour qui, avec un ton direct et un brin de personnalité.",
  },
};

export const voiceOverrideSchema = z.object({
  tone: z.string().max(VOICE_FIELD_MAX).default(""),
  writing: z.string().max(VOICE_FIELD_MAX).default(""),
  hashtags: z.string().max(VOICE_FIELD_MAX).default(""),
  bio: z.string().max(VOICE_FIELD_MAX).default(""),
});
export type VoiceOverride = z.infer<typeof voiceOverrideSchema>;

/** Consignes d'un réseau : réglages de la marque, sinon valeurs par défaut. */
export function resolveVoice(platform: PlatformId, override?: Partial<VoiceOverride> | null): PlatformVoice {
  const base = DEFAULT_VOICES[platform];
  const pick = (key: keyof PlatformVoice) => override?.[key]?.trim() || base[key];
  return { tone: pick("tone"), writing: pick("writing"), hashtags: pick("hashtags"), bio: pick("bio") };
}

/** Bloc de consignes envoyé à l'assistant pour un réseau. */
export function describeVoice(platform: PlatformId, voice: PlatformVoice, fields: readonly (keyof PlatformVoice)[]) {
  const config = PLATFORMS[platform];
  const limits = [`légende : ${config.captionLimit} caractères maximum`];
  if (config.hashtagLimit !== null) limits.push(`hashtags : ${config.hashtagLimit} maximum`);
  const labels: Record<keyof PlatformVoice, string> = {
    tone: "Ton",
    writing: "Écriture",
    hashtags: "Hashtags",
    bio: "Bio",
  };
  return [
    `## ${config.label}`,
    ...fields.map((field) => `- ${labels[field]} : ${voice[field]}`),
    fields.includes("writing") ? `- Limites : ${limits.join(" ; ")}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
