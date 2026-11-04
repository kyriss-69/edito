"use client";

import { useApp } from "@/components/app-provider";
import { PageHeader } from "@/components/page-header";

import { AccountCard } from "./account-card";

export function AccountsView() {
  const { meta } = useApp();
  const used = meta.accounts.filter((account) => account.status !== "unused");
  const unused = meta.accounts.filter((account) => account.status === "unused");
  return (
    <>
      <PageHeader title="Réseaux sociaux" description="Tes comptes, leur rythme de publication et leur checklist" />
      <div className="flex-1 overflow-y-auto p-4 md:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <p className="text-sm text-muted-foreground">
            Un réseau que tu n&apos;utilises pas ? Passe son statut à « Non utilisé » : il disparaît du planning, des
            filtres et de l&apos;Accueil.
          </p>
          <div className="grid items-start gap-4 xl:grid-cols-2">
            {used.map((account) => (
              // La clé force la réinitialisation du brouillon si le compte change ailleurs.
              <AccountCard key={account.id} account={account} />
            ))}
          </div>
          {unused.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-muted-foreground">Réseaux non utilisés</h2>
              <div className="grid items-start gap-4 opacity-75 transition-opacity focus-within:opacity-100 hover:opacity-100 xl:grid-cols-2">
                {unused.map((account) => (
                  <AccountCard key={account.id} account={account} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
