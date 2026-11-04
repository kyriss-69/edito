import type { Metadata } from "next";

import { AiSettingsForm } from "@/components/settings/ai-settings-form";

export const metadata: Metadata = { title: "Assistant IA · Réglages" };

export default function AiSettingsPage() {
  return <AiSettingsForm />;
}
