/**
 * Formules d'accroche pour les réseaux sociaux, adaptées en français du pack
 * « instagram-agent-skill » de Jake Schincariol (licence MIT) : 26 formules, chacune avec
 * un modèle, un exemple et le piège qui la gâche. Les exemples respectent une règle simple
 * (aucun chiffre inventé : les nombres entre {accolades} sont à remplacer par des vrais).
 */

export type HookFormula = {
  id: number;
  name: string;
  template: string;
  example: string;
  /** Ce qui la fait rater. */
  trap: string;
};

export const HOOK_FORMULAS: HookFormula[] = [
  { id: 1, name: "L'aveu qui coûte", template: "{Montant précis}, c'est ce que {une erreur} m'a coûté.", example: "Accepter une collab « contre visibilité », c'est {X} € de travail offert.", trap: "Un coût flou (« ça m'a coûté ma tranquillité ») : il faut un vrai chiffre." },
  { id: 2, name: "L'ordre négatif", template: "Arrête de {habitude courante}. Fais plutôt {alternative}.", example: "Arrête d'envoyer ton media kit en PDF. Envoie un lien.", trap: "Interdire une habitude que personne n'a : le lecteur doit s'y reconnaître." },
  { id: 3, name: "Ce qu'on ne te dit pas", template: "Personne ne te dit que {vérité inconfortable}.", example: "Personne ne te dit que les marques regardent ton engagement avant tes abonnés.", trap: "Une « vérité » que tout le monde répète déjà." },
  { id: 4, name: "Le remplacement", template: "{Ceci} remplace {chose coûteuse ou pénible}.", example: "Un lien remplace le PDF que tu refais à chaque demande.", trap: "Exagérer : si ça remplace la moitié du travail, dis la moitié." },
  { id: 5, name: "Le temps qui fond", template: "Avant, {tâche} me prenait {long}. Maintenant, {court}.", example: "Refaire mon media kit : une soirée avant. Un lien à copier maintenant.", trap: "Un écart que personne ne croit." },
  { id: 6, name: "Les vrais chiffres", template: "J'ai {fait quelque chose} pendant {durée}. Voilà les vrais chiffres.", example: "On a lu toutes les réponses au sondage. Voilà ce qui revient le plus.", trap: "Ne pas montrer les chiffres (et ne jamais en inventer)." },
  { id: 7, name: "Tu le fais mal (et ce n'est pas ta faute)", template: "Tu {fais X} mal, et ce n'est pas ta faute. {La solution}.", example: "Tu fixes tes tarifs au hasard, et ce n'est pas ta faute : personne ne t'a montré comment.", trap: "Oublier le « ce n'est pas ta faute » : sans lui, ça sonne comme un reproche." },
  { id: 8, name: "Les coulisses d'un initié", template: "J'ai passé {durée} {dans ce milieu}. Voilà ce qu'on ne dit jamais.", example: "Ce que les marques regardent vraiment quand elles ouvrent ton profil.", trap: "Promettre un secret et livrer une banalité." },
  { id: 9, name: "Pique-le", template: "Pique-moi ce {modèle / outil}. Il m'a fallu {temps} pour le mettre au point.", example: "Pique-moi ce message pour relancer une facture sans être gênant.", trap: "Que le modèle ne soit pas visible : il faut pouvoir le copier ou le capturer." },
  { id: 10, name: "Si tu…, regarde", template: "Si tu {situation précise}, {ce post} règle ça.", example: "Si les marques te proposent du troc au lieu d'un vrai budget, lis la suite.", trap: "Une situation trop large (« si tu veux grandir »)." },
  { id: 11, name: "La liste avec une préférée", template: "{N} {choses} qui {résultat}. La n°{k} est celle que personne n'utilise.", example: "4 choses à mettre dans ton media kit. La 3e, presque personne ne le fait.", trap: "Plus de 7 éléments : personne n'y croit." },
  { id: 12, name: "L'objection", template: "« {Objection réellement entendue}. » OK. Voilà comment faire quand même.", example: "« Je suis trop petit pour être payé. » OK. Voilà pourquoi c'est faux.", trap: "Inventer l'objection : reprends-la mot pour mot d'un commentaire ou d'un DM." },
  { id: 13, name: "Avant / après", template: "{L'ancien}. {Le nouveau}. {La seule chose qui a changé}.", example: "Mon media kit avant : un PDF de 2023. Maintenant : un lien toujours à jour.", trap: "Trois changements à la fois : n'en cite qu'un." },
  { id: 14, name: "L'interpellation", template: "{Groupe précis}, celui-là est pour toi.", example: "Créatrices skincare sous 10k abonnés : celui-là est pour vous.", trap: "Un groupe trop large (« les entrepreneurs »)." },
  { id: 15, name: "Les échecs d'abord", template: "Mes {N} premiers {essais} n'ont rien donné. Voilà ce qui a changé au suivant.", example: "Mes premiers messages aux marques sont restés sans réponse. Voilà ce que j'ai changé.", trap: "Faire passer le changement pour de la chance." },
  { id: 16, name: "La question telle quelle", template: "« {Question exactement comme on te la pose} » On me la pose chaque semaine.", example: "« Combien je facture un Reel avec 5 000 abonnés ? »", trap: "Reformuler la question : sa force, c'est d'être dans les mots du public (c'est ce qu'on tape dans la recherche)." },
  { id: 17, name: "Le match", template: "{A} ou {B} ? {Un des deux gagne nettement}.", example: "Tarif fixe ou commission sur les ventes ? Pour un petit créateur, la réponse est claire.", trap: "Refuser de trancher." },
  { id: 18, name: "La démo à froid", template: "{Commencer en pleine action.} Regarde ce que ça fait.", example: "Regarde : je colle le lien de mon media kit dans un DM.", trap: "Un résultat qui met trop longtemps à arriver." },
  { id: 19, name: "L'échéance", template: "{Chose} change {quand}. Fais {action} avant.", example: "Avant ta prochaine collab, vérifie ces 3 lignes du brief.", trap: "Une urgence fabriquée (jamais de fausse date ni de « places limitées »)." },
  { id: 20, name: "La permission", template: "Tu n'as pas besoin de {ce que tout le monde dit qu'il faut}.", example: "Tu n'as pas besoin de 100k abonnés pour être payé.", trap: "Enlever le frein sans rien proposer à la place." },
  { id: 21, name: "En pleine phrase", template: "« …et c'est là que {le tournant}. »", example: "…et là, la marque m'a répondu : « on peut t'envoyer le produit ».", trap: "Ne jamais revenir sur le début de l'histoire." },
  { id: 22, name: "Le contre-pied", template: "{Dicton connu, retourné.}", example: "La visibilité ne paie pas le loyer.", trap: "Retourner une phrase que personne ne dit." },
  { id: 23, name: "La statistique", template: "{N} % des {groupe} {fait surprenant}.", example: "Une agence prend 20 à 35 % de la rémunération d'une collab.", trap: "Un chiffre sans source : n'utilise que des chiffres vrais et sourcés." },
  { id: 24, name: "Le dévoilement", template: "Voici le nouveau {chose}.", example: "Voici à quoi ressemblera ton nouvel espace client (aperçu).", trap: "Montrer sans dire ce que ça change." },
  { id: 25, name: "Le résultat de quelqu'un d'autre", template: "Une {personne} a {résultat} en {temps}.", example: "(Seulement avec un exemple réel, nommé et vérifiable.)", trap: "Un exemple anonyme ou inventé : à éviter tant qu'on n'a pas de vrai témoignage." },
  { id: 26, name: "Le superlatif", template: "La façon la plus {rapide / simple} de {résultat}, c'est {réponse}.", example: "La façon la plus simple de savoir quoi facturer : partir de ton engagement, pas de tes abonnés.", trap: "Une réponse molle (« la régularité »)." },
];

/** Formules proposées à l'IA (une ligne chacune, pour rester compact avec un petit modèle). */
export function hookGuide(): string {
  return [
    "# Formules d'accroche",
    "Choisis la formule qui colle au sujet (jamais une accroche qui marcherait pour n'importe qui). Chaque accroche promet quelque chose que la suite tient.",
    ...HOOK_FORMULAS.map((f) => `${f.id}. ${f.name} : ${f.template} Ex. : ${f.example} Piège : ${f.trap}`),
  ].join("\n");
}
