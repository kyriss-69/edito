import type { Metadata } from "next";

import { BrandBriefForm } from "@/components/library/brand-brief-form";
import { PlatformVoiceForm } from "@/components/library/platform-voice-form";
import { BrandTabs } from "@/components/library/templates-tabs";
import { PageBody, PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Identité de la marque" };

export default function BrandPage() {
  return (
    <>
      <PageHeader title="Identité & charte" nav={<BrandTabs />} />
      <PageBody>
        <div className="flex flex-col gap-4 pb-20">
          <BrandBriefForm />
          <PlatformVoiceForm />
        </div>
      </PageBody>
    </>
  );
}
