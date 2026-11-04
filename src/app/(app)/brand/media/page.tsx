import type { Metadata } from "next";

import { MediaLibrary } from "@/components/library/media-library";
import { PageBody, PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Médiathèque" };

export default function MediaPage() {
  return (
    <>
      <PageHeader title="Médiathèque" description="Logos, visuels, mockups, photos et vidéos réutilisables" />
      <PageBody>
        <MediaLibrary />
      </PageBody>
    </>
  );
}
