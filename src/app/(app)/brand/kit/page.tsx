import type { Metadata } from "next";

import { BrandKitForm } from "@/components/library/brand-kit-form";
import { BrandTabs } from "@/components/library/templates-tabs";
import { PageBody, PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Charte graphique" };

export default function BrandKitPage() {
  return (
    <>
      <PageHeader title="Identité & charte" nav={<BrandTabs />} />
      <PageBody>
        <BrandKitForm />
      </PageBody>
    </>
  );
}
