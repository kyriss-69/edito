import type { Metadata } from "next";

import { PreferencesSettings } from "@/components/settings/preferences-settings";

export const metadata: Metadata = { title: "Préférences · Réglages" };

export default function PreferencesPage() {
  return <PreferencesSettings />;
}
