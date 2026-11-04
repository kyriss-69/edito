import { Video } from "lucide-react";

import type { AssetDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AssetThumb({ asset, className }: { asset: AssetDTO; className?: string }) {
  if (asset.mimeType.startsWith("video/")) {
    return (
      <div className={cn("relative bg-muted", className)}>
        <video src={`${asset.url}#t=0.1`} muted preload="metadata" className="size-full object-cover" />
        <Video className="absolute top-1.5 right-1.5 size-4 text-white drop-shadow" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- médias locaux servis par l'API
    <img src={asset.url} alt={asset.title} className={cn("bg-muted object-cover", className)} />
  );
}
