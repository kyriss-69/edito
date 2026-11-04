import { Database, FolderOpen, Images } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { formatBytes } from "@/lib/utils";
import { getDataInfo } from "@/server/data-info";

export const metadata: Metadata = { title: "Données · Réglages" };

const nf = new Intl.NumberFormat("fr-FR");

function Row({ icon: Icon, label, value, detail }: { icon: typeof Database; label: string; value: string; detail: string }) {
  return (
    <li className="flex items-start gap-3 py-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-sm text-muted-foreground tabular-nums">{value}</span>
        </div>
        <code className="block text-xs break-all text-muted-foreground">{detail}</code>
      </div>
    </li>
  );
}

/** Réglages › Données : où sont les données et comment les sauvegarder. */
export default async function DataSettingsPage() {
  await connection();
  const info = getDataInfo();
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
      <div>
        <h2 className="font-semibold">Données</h2>
        <p className="text-sm text-muted-foreground">
          Tout est enregistré sur cet ordinateur : rien n&apos;est envoyé en ligne (l&apos;assistant IA tourne lui
          aussi en local avec LM Studio).
        </p>
      </div>
      <ul className="divide-y">
        <Row icon={FolderOpen} label="Dossier des données" value="" detail={info.dataDir} />
        <Row
          icon={Database}
          label="Base de données"
          value={`${nf.format(info.posts)} posts · ${formatBytes(info.dbSize)}`}
          detail={info.dbFile}
        />
        <Row
          icon={Images}
          label="Médias"
          value={`${nf.format(info.media + info.library)} fichiers · ${formatBytes(info.uploadsSize)}`}
          detail={info.uploadsDir}
        />
      </ul>
      <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
        Pour sauvegarder ou changer d&apos;ordinateur, copie tout le dossier des données app fermée : il contient la
        base et les médias. Il n&apos;est pas dans le dépôt git.
      </p>
    </section>
  );
}
