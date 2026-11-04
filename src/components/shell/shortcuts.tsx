"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";

/** Raccourcis clavier (les touches seules sont ignorées pendant la saisie). */
export const SHORTCUTS = [
  { keys: ["⌘", "K"], label: "Rechercher, aller à une page, lancer une action" },
  { keys: ["N"], label: "Nouveau post" },
  { keys: ["/"], label: "Rechercher dans le planning" },
  { keys: ["1"], label: "Planning : Tableau" },
  { keys: ["2"], label: "Planning : Calendrier" },
  { keys: ["3"], label: "Planning : Liste" },
  { keys: ["?"], label: "Afficher les raccourcis" },
  { keys: ["⌘", "S"], label: "Enregistrer tout de suite (fiche d'un post, formulaires)" },
  { keys: ["Échap"], label: "Fermer une fenêtre, vider la sélection" },
  { keys: ["Entrée"], label: "Tableau : ouvrir le post sélectionné" },
  { keys: ["Espace"], label: "Tableau : saisir un post pour le déplacer au clavier" },
  { keys: ["⌘", "clic"], label: "Tableau : sélectionner plusieurs posts" },
];

export function ShortcutList() {
  return (
    <ul className="flex flex-col divide-y text-sm">
      {SHORTCUTS.map((s) => (
        <li key={s.label} className="flex items-center justify-between gap-4 py-2">
          <span>{s.label}</span>
          <span className="flex shrink-0 gap-1">
            {s.keys.map((key) => (
              <Kbd key={key}>{key}</Kbd>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Raccourcis clavier</DialogTitle>
          <DialogDescription>Sur Windows, remplace ⌘ par Ctrl.</DialogDescription>
        </DialogHeader>
        <ShortcutList />
      </DialogContent>
    </Dialog>
  );
}
