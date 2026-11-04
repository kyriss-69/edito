import type { Metadata } from "next";

import { HashtagGroups } from "@/components/library/hashtag-groups";
import { TemplatesTabs } from "@/components/library/templates-tabs";
import { PageBody, PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Groupes de hashtags" };

export default function HashtagsPage() {
  return (
    <>
      <PageHeader title="Modèles & hashtags" nav={<TemplatesTabs />} />
      <PageBody>
        <HashtagGroups />
      </PageBody>
    </>
  );
}
