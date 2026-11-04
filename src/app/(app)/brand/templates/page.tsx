import type { Metadata } from "next";

import { TemplatesTabs } from "@/components/library/templates-tabs";
import { TemplatesView } from "@/components/library/templates-view";
import { PageBody, PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Modèles de posts" };

export default function TemplatesPage() {
  return (
    <>
      <PageHeader title="Modèles & hashtags" nav={<TemplatesTabs />} />
      <PageBody>
        <TemplatesView />
      </PageBody>
    </>
  );
}
