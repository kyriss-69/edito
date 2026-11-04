import type { Meta, PostDTO } from "./types";

export type OnboardingStep = {
  id: string;
  label: string;
  description: string;
  done: boolean;
  /** Page où faire l'étape (sinon : créer un post). */
  href?: string;
};

/** Étapes pour bien démarrer, cochées d'après ce qui est déjà rempli. */
export function onboardingSteps(meta: Pick<Meta, "ai" | "accounts">, posts: PostDTO[]): OnboardingStep[] {
  return [
    {
      id: "brand",
      label: "Présente ta marque",
      description: "Ce qu'elle est, à qui elle parle, son ton : l'assistant IA s'en sert pour chaque texte.",
      done: Boolean(meta.ai.brand.description.trim()),
      href: "/brand",
    },
    {
      id: "accounts",
      label: "Renseigne tes comptes",
      description: "Pseudo et bio de chaque réseau, pour l'aperçu des posts.",
      done: meta.accounts.some((a) => a.handle.trim()),
      href: "/brand/accounts",
    },
    {
      id: "rhythm",
      label: "Fixe ton rythme",
      description: "Le nombre de posts par semaine visé, pour repérer les semaines creuses.",
      done: meta.accounts.some((a) => a.postsPerWeek),
      href: "/brand/accounts",
    },
    {
      id: "ai",
      label: "Connecte l'assistant IA",
      description: "Un modèle local avec LM Studio pour rédiger légendes, hashtags et idées.",
      done: Boolean(meta.ai.model),
      href: "/settings/ai",
    },
    {
      id: "post",
      label: "Crée ton premier post",
      description: "Avec ses médias, sa légende et ses hashtags.",
      done: posts.length > 0,
    },
    {
      id: "schedule",
      label: "Planifie un post",
      description: "Donne-lui une date : il apparaît dans le calendrier.",
      done: posts.some((p) => p.scheduledAt !== null),
      href: "/calendar",
    },
  ];
}
