import type { Metadata } from "next";

import { CarouselEditor } from "@/components/studio/carousel-editor";

export const metadata: Metadata = { title: "Carrousel · Studio" };

export default async function CarouselPage(props: PageProps<"/studio/[id]">) {
  const { id } = await props.params;
  return <CarouselEditor id={Number(id)} />;
}
