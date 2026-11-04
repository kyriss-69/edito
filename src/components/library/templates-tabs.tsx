import { PageTabs } from "@/components/page-tabs";

/** Onglets de la page « Modèles & hashtags ». */
export function TemplatesTabs() {
  return (
    <PageTabs
      label="Modèles et hashtags"
      tabs={[
        { href: "/brand/templates", label: "Modèles de posts" },
        { href: "/brand/hashtags", label: "Groupes de hashtags" },
      ]}
    />
  );
}

/** Onglets de la page « Identité & charte ». */
export function BrandTabs() {
  return (
    <PageTabs
      label="Identité et charte"
      tabs={[
        { href: "/brand", label: "Identité" },
        { href: "/brand/kit", label: "Charte graphique" },
      ]}
    />
  );
}
