import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Inter_Tight, Outfit, Plus_Jakarta_Sans } from "next/font/google";
import { cookies } from "next/headers";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PRODUCT } from "@/lib/product";
import { parseTheme, THEME_COOKIE } from "@/lib/preferences";

import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Polices proposées pour les slides du Studio carrousel (choisies dans la charte,
// voir `src/lib/slide-fonts.ts`) : celles de tamarque.fr (Outfit, Plus Jakarta Sans)
// et Inter. Polices variables : toutes les graisses sont disponibles.
// (next/font n'accepte que des options écrites en toutes lettres.)
const slideOutfit = Outfit({ variable: "--font-slide-outfit", subsets: ["latin", "latin-ext"], preload: false });
const slideJakarta = Plus_Jakarta_Sans({
  variable: "--font-slide-jakarta",
  subsets: ["latin", "latin-ext"],
  preload: false,
});
const slideInter = Inter({ variable: "--font-slide-inter", subsets: ["latin", "latin-ext"], preload: false });
const slideInterTight = Inter_Tight({
  variable: "--font-slide-inter-tight",
  subsets: ["latin", "latin-ext"],
  preload: false,
});
const slideFonts = [slideOutfit, slideJakarta, slideInter, slideInterTight].map((f) => f.variable).join(" ");

export const metadata: Metadata = {
  title: { default: PRODUCT.name, template: `%s · ${PRODUCT.name}` },
  description: PRODUCT.tagline,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html
      lang="fr"
      data-theme={theme}
      className={`${geistSans.variable} ${geistMono.variable} ${slideFonts} h-full antialiased`}
    >
      <body className="h-full font-sans">
        <ThemeProvider initial={theme}>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
