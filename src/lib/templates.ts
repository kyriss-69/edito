import type { PlatformId } from "./platforms";

export type TemplateSeed = {
  name: string;
  description: string;
  title: string;
  caption: string;
  format: string;
  platforms: PlatformId[];
  /** Nom du pilier de contenu à associer, s'il existe. */
  pillar: string | null;
  cta: string;
  checklist: string[];
};

/** Modèles proposés au premier lancement, à adapter à ta marque. */
export const DEFAULT_TEMPLATES: TemplateSeed[] = [
  {
    name: "Annonce de fonctionnalité",
    description: "Présenter une nouveauté et ses bénéfices.",
    title: "Nouveauté : [fonctionnalité]",
    caption:
      "🚀 Nouveau : [fonctionnalité] !\n\n[Le problème que ça règle, en une phrase]\n\n✅ [Bénéfice 1]\n✅ [Bénéfice 2]\n✅ [Bénéfice 3]\n\nC'est dispo dès maintenant 👆",
    format: "carousel",
    platforms: ["instagram", "tiktok"],
    pillar: "Promo",
    cta: "Lien en bio",
    checklist: ["Captures d'écran de la fonctionnalité", "Visuel aux couleurs de la charte", "Légende relue", "Hashtags ajoutés"],
  },
  {
    name: "Astuce de la semaine",
    description: "Un conseil concret pour ton public.",
    title: "Astuce : [sujet]",
    caption:
      "💡 L'astuce de la semaine : [titre de l'astuce]\n\n[Explication en 2 ou 3 phrases]\n\n[Exemple concret]\n\nEnregistre ce post pour le retrouver 📌",
    format: "carousel",
    platforms: ["instagram", "tiktok"],
    pillar: "Éducatif",
    cta: "Enregistre ce post",
    checklist: ["Slides rédigées", "Visuel aux couleurs de la charte", "Légende relue", "Hashtags ajoutés"],
  },
  {
    name: "Coulisses",
    description: "Montrer l'équipe, la fabrication ou une journée type.",
    title: "Coulisses : [sujet]",
    caption:
      "On t'emmène dans les coulisses 👀\n\n[Ce qu'on montre et pourquoi]\n\nTu veux voir quoi la prochaine fois ? Dis-le en commentaire 👇",
    format: "video",
    platforms: ["instagram", "tiktok"],
    pillar: "Coulisses",
    cta: "Dis-le en commentaire",
    checklist: ["Vidéo tournée", "Montage et sous-titres", "Musique choisie", "Légende relue"],
  },
  {
    name: "Membre à l'honneur",
    description: "Mettre en avant un membre de la communauté ou un client.",
    title: "À l'honneur : @[pseudo]",
    caption:
      "✨ À l'honneur cette semaine : @[pseudo]\n\n[Présentation : ce qu'il ou elle fait, son univers]\n\n[Ce que vous avez fait ensemble]\n\nToi aussi, rejoins-nous 👆",
    format: "carousel",
    platforms: ["instagram"],
    pillar: "Communauté",
    cta: "Rejoins-nous, lien en bio",
    checklist: ["Accord de la personne", "Visuels récupérés", "Personne identifiée dans le post", "Légende relue"],
  },
  {
    name: "Collab du mois",
    description: "Raconter une collaboration réussie.",
    title: "Collab du mois : [partenaire]",
    caption:
      "🤝 La collab du mois\n\nAvec @[partenaire]\n\n[Le projet en 2 phrases]\n[Le résultat]\n\nTu veux la prochaine ? Écris-nous 👆",
    format: "carousel",
    platforms: ["instagram", "tiktok"],
    pillar: "Communauté",
    cta: "Lien en bio",
    checklist: ["Accord du partenaire", "Visuels de la collab", "Comptes identifiés", "Légende relue"],
  },
];

/** Lit une liste JSON stockée en texte, sans planter si elle est invalide. */
export function parseJsonList(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}
