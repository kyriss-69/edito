import { brandKitSchema, type BrandKit } from "@/lib/brand";

// Chartes d'exemple pour les tests.
/** Charte claire d'exemple. */
export const LUMEN_KIT: BrandKit = brandKitSchema.parse({
  slogan: "Créateurs × Entreprises",
  positioning: "Plateforme de mise en relation entre petits créateurs et entreprises.",
  palettes: [
    {
      name: "Palette principale",
      colors: [
        { name: "Crème", hex: "#FFF1DF", role: "Fond principal : clarté et respiration", share: 45 },
        { name: "Orange chaleureux", hex: "#E96932", role: "Couleur principale, boutons et appels à l'action", share: 20 },
        { name: "Pêche", hex: "#F5A06A", role: "Éléments secondaires, cartes, illustrations", share: 10 },
        { name: "Jaune miel", hex: "#F3C65B", role: "Highlights et badges", share: 10 },
        { name: "Bordeaux", hex: "#8F3040", role: "Contraste et sections", share: 10 },
        { name: "Brun cacao", hex: "#3B211B", role: "Textes et footer", share: 5 },
      ],
    },
    {
      name: "Couleurs du logo",
      colors: [
        { name: "Crème de fond", hex: "#FBF6EF", role: "Fond derrière le logo" },
        { name: "Marron Lumen", hex: "#3D2721", role: "Logotype « umen » et slogan" },
        { name: "Corail Créateur", hex: "#EA7E60", role: "Dégradé du K" },
        { name: "Bordeaux Entreprise", hex: "#8D3C54", role: "Dégradé du K" },
      ],
    },
  ],
  gradient: ["#F3C65B", "#EA7E60", "#8D3C54"],
  fonts: {
    heading: "Outfit Bold",
    headingFallback: "Poppins",
    body: "Plus Jakarta Sans Regular",
    bodyFallback: "Inter",
  },
  guidelines: [
    "Logo : K en dégradé (jaune miel → corail → bordeaux) suivi de « umen » en marron, slogan « Créateurs × Entreprises » en capitales espacées.",
    "Zone de protection : laisser autour du logo un espace au moins égal à la hauteur du « o ».",
    "Ne pas déformer, étirer ni recolorer le logo.",
    "Sur fond clair : logo marron. Sur fond foncé (brun cacao) : logo crème ou blanc.",
    "Répartition indicative des couleurs : beaucoup de crème, l'orange pour les appels à l'action, le jaune miel pour souligner, le bordeaux pour le contraste.",
    "Titres en Outfit Bold, légèrement resserrés (substitut : Poppins), textes en Plus Jakarta Sans Regular (substitut : Inter), comme sur lumen.fr.",
  ].join("\n"),
  studio: { background: "#FFF1DF", title: null, text: "#3B211B", accent: "#E96932", titleTracking: -0.025 },
});

/** Charte sombre d'exemple. */
export const NUIT_KIT: BrandKit = brandKitSchema.parse({
  slogan: "Astuces et outils IA, testés pour toi",
  positioning:
    "Compte d'astuces tech, fond sombre et accent lime.",
  palettes: [
    {
      name: "Nuit",
      colors: [
        { name: "Nuit", hex: "#0A0A12", role: "Fond principal", share: 50 },
        { name: "Indigo nuit", hex: "#17142E", role: "Haut du dégradé de fond", share: 15 },
        { name: "Carte", hex: "#15152A", role: "Cartes et blocs", share: 10 },
        { name: "Blanc", hex: "#FFFFFF", role: "Titres et texte", share: 10 },
        { name: "Gris lavande", hex: "#A3A3C2", role: "Texte secondaire et notes", share: 5 },
        { name: "Lime", hex: "#C8FF3D", role: "Accent : mots-clés, chiffres, chips", share: 5 },
        { name: "Violet", hex: "#7C5CFF", role: "2e accent : barres, CTA", share: 4 },
        { name: "Rouge", hex: "#FF4D5E", role: "Alerte, « trop gros », barré", share: 1 },
      ],
    },
    {
      name: "Swiss",
      colors: [
        { name: "Papier", hex: "#F1EEE6", role: "Fond clair" },
        { name: "Encre", hex: "#111111", role: "Texte" },
        { name: "Rouge suisse", hex: "#E63022", role: "Seul accent (le point rouge)" },
      ],
    },
  ],
  gradient: ["#7C5CFF", "#A48BFF"],
  fonts: {
    heading: "Inter ExtraBold",
    headingFallback: "Inter Tight",
    body: "Inter SemiBold",
    bodyFallback: "system-ui",
  },
  guidelines: [
    "Fond sombre en dégradé radial (indigo nuit #17142E en haut vers nuit #0A0A12), avec un halo violet flou en haut à gauche et un halo lime discret en bas à droite.",
    "Un seul accent fort : le lime #C8FF3D, réservé aux mots-clés du titre, aux chiffres importants, au kicker et aux chips. Le violet #7C5CFF sert aux barres de données et au bouton d'appel à l'action.",
    "Titres en Inter ExtraBold, très serrés (-0,04 em), gros (84 à 124 px sur un carrousel 1080 × 1350). Texte en Inter SemiBold gris lavande. Kicker en capitales espacées, lime.",
    "Chaque slide prouve ce qu'elle dit : vraie capture de la source, recadrée sur la ligne utile, surlignée en jaune #FFD60A, dans une carte blanche arrondie avec une grande ombre, et son origine écrite au-dessus. Une citation en anglais est traduite en français, avec « traduit de l'anglais ».",
    "Logos des marques en blanc, à gauche du nom.",
    "Couverture : une question ou une promesse de 6 mots maximum. Une idée par slide. Dernière slide : résumé et une question pour faire commenter.",
    "Pied de slide : « @nuit · nom de la série » en gris à gauche, pagination à droite (point actif lime).",
    "Note de source en petit gris en bas de slide, avec la date de vérification. Aucun chiffre sans source.",
    "Rien d'important sous y = 1150 sur un carrousel (interface TikTok), ni collé au bord droit.",
    "Avatar cartoon de Nuit en bas des vidéos. Pas d'emoji en guise d'illustration : du motion design et de vraies captures.",
    "Tutoiement, apostrophes typographiques, espace avant « : ? ! ». Mots interdits : incroyable, révolutionnaire, incontournable, game changer.",
  ].join("\n"),
  studio: {
    background: "#0A0A12",
    title: "#FFFFFF",
    text: "#A3A3C2",
    accent: "#C8FF3D",
    titleTracking: -0.04,
    gradientTop: "#17142E",
    halos: ["#7C5CFF", "#C8FF3D"],
    footer: "@nuit · Ton IA en local",
    pagination: true,
    kickers: true,
  },
});

