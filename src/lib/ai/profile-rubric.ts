/**
 * Grille d'audit d'un profil Instagram sur 100, adaptée en français (et à un compte de marque)
 * du pack « instagram-agent-skill » (Jake Schincariol, licence MIT). Le profil est un écran de
 * décision : quelqu'un arrive depuis un Reel et a trois secondes pour savoir si la suite est pour lui.
 */

export type RubricItem = {
  id: string;
  label: string;
  points: number;
  /** À quoi ressemble la note maximale. */
  full: string;
  /** L'erreur la plus courante. */
  fail: string;
};

export const PROFILE_RUBRIC: RubricItem[] = [
  { id: "name_field", label: "Champ « Nom »", points: 12, full: "Le nom affiché en gras (30 caractères, ce n'est pas le pseudo) contient le nom et ce que fait le compte, avec les mots que le public tape dans la recherche : « Atelier Lumen | Bougies artisanales Lyon ». Ce champ est lu par la recherche Instagram.", fail: "Juste le nom, ou le nom avec un emoji." },
  { id: "bio_first_line", label: "1re ligne de la bio", points: 12, full: "Dit à qui s'adresse le compte et ce qui change pour lui, avec ses mots. Pas un titre, pas une liste d'adjectifs, pas trois emojis séparés par des barres.", fail: "« Créateurs x Entreprises | Collab | 🚀 »." },
  { id: "bio_body", label: "Reste de la bio", points: 8, full: "Le reste des 150 caractères apporte une preuve ou une offre précise, en phrases, et invite à cliquer sur le lien.", fail: "Une soupe de mots-clés, ou du vide." },
  { id: "pinned_three", label: "Les 3 posts épinglés", points: 10, full: "Trois posts épinglés en haut de la grille, avec trois rôles différents : ce que fait la marque, la meilleure preuve ou le meilleur conseil, l'offre ou l'appel à l'action.", fail: "Rien d'épinglé : le haut de la grille est le dernier post publié, au hasard." },
  { id: "link", label: "Lien", points: 8, full: "Une seule destination, qui tient la promesse de la bio. Plus de deux liens, c'est un menu, et un menu convertit moins bien qu'une porte.", fail: "Un arbre de liens avec dix options, ou pas de lien." },
  { id: "highlights", label: "Stories à la une", points: 8, full: "4 à 6 « à la une » nommées selon les questions que se pose le public (C'est quoi ?, Créateurs, Marques, Fondateurs, FAQ), avec des couvertures cohérentes.", fail: "« Divers », « Vie », ou aucune." },
  { id: "grid_legibility", label: "Lisibilité de la grille", points: 8, full: "Les 9 premières vignettes sont lisibles en petit et disent de quoi parle le compte sans cliquer ; les couvertures de Reels sont choisies, avec quelques mots de texte.", fail: "Neuf images sans texte, ou des couvertures de Reels prises au hasard." },
  { id: "photo", label: "Photo de profil", points: 6, full: "Pour une marque : le logo (ou le symbole) bien centré, lisible dans un rond de 40 pixels, sur un fond qui ne le gêne pas.", fail: "Un logo trop long, illisible en petit." },
  { id: "handle", label: "Pseudo", points: 6, full: "Lisible, prononçable, le même que sur les autres réseaux. Pas de tirets bas en série ni de chiffres.", fail: "Un pseudo qu'on ne sait pas écrire après l'avoir entendu." },
  { id: "category_contact", label: "Compte pro, catégorie, contact", points: 6, full: "Compte professionnel avec une catégorie qui correspond et un bouton de contact qui marche (adresse e-mail suivie).", fail: "Compte personnel : pas de statistiques ni de bouton de contact." },
  { id: "recent_activity", label: "Activité récente", points: 10, full: "Un post dans les 7 derniers jours et des réponses aux commentaires du dernier post.", fail: "Plusieurs semaines sans post, ou des commentaires sans réponse." },
  { id: "story_presence", label: "Stories", points: 6, full: "Une story en ligne, ou presque tous les jours.", fail: "Jamais de story." },
];

export const PROFILE_RUBRIC_TOTAL = PROFILE_RUBRIC.reduce((sum, item) => sum + item.points, 0);
