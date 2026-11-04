import { PLATFORMS, type PlatformId } from "@/lib/platforms";
import { cn } from "@/lib/utils";

/** Logos des réseaux, en SVG (24 × 24, couleur du texte). */
const GLYPHS: Record<PlatformId, React.ReactNode> = {
  instagram: (
    <>
      <rect x="2.75" y="2.75" width="18.5" height="18.5" rx="5.25" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4.25" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.4" cy="6.6" r="1.25" fill="currentColor" />
    </>
  ),
  tiktok: (
    <path
      fill="currentColor"
      d="M16.6 2.5c.3 2.4 1.7 4.1 4.2 4.3v3.1c-1.5.1-2.9-.3-4.2-1.1v6.4c0 4.4-3.6 6.9-7.2 6.3-3.3-.5-5.6-3.8-4.8-7.3.7-2.9 3.5-4.9 6.6-4.5v3.3c-.4-.1-.8-.2-1.3-.1-1.4.2-2.4 1.5-2.2 2.9.2 1.4 1.4 2.4 2.8 2.2 1.3-.1 2.2-1.2 2.2-2.6V2.5h3.9z"
    />
  ),
  youtube: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M10 9.2v5.6l4.8-2.8z" fill="currentColor" />
    </>
  ),
  linkedin: (
    <>
      <rect x="2.75" y="2.75" width="18.5" height="18.5" rx="3.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="8" cy="8" r="1.3" fill="currentColor" />
      <path
        d="M8 11v6M11.5 17v-6m0 3c0-1.7 1.1-3 2.6-3s2.4 1.1 2.4 2.8V17"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </>
  ),
  facebook: (
    <>
      <circle cx="12" cy="12" r="9.25" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        d="M15.5 7.5h-1.6a2.4 2.4 0 0 0-2.4 2.4V21M9.2 12.6h5.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </>
  ),
  x: (
    <>
      <path d="M3.5 3.5h5l12 17h-5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M20 3.5 13.6 10.8M10.4 13.2 4 20.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
};

/** Couleur d'accent du logo (TikTok et X gardent la couleur du texte, leur couleur de marque étant le noir). */
const TINT: Record<PlatformId, string | undefined> = {
  instagram: PLATFORMS.instagram.color,
  tiktok: undefined,
  youtube: PLATFORMS.youtube.color,
  linkedin: PLATFORMS.linkedin.color,
  facebook: PLATFORMS.facebook.color,
  x: undefined,
};

export function PlatformIcon({
  platform,
  colored = false,
  className,
}: {
  platform: PlatformId;
  /** Logo dans la couleur du réseau plutôt que celle du texte. */
  colored?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("size-4 shrink-0", className)}
      style={colored && TINT[platform] ? { color: TINT[platform] } : undefined}
    >
      {GLYPHS[platform]}
    </svg>
  );
}
