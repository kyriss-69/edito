import type { Metadata } from "next";

import { WorkflowSettings } from "@/components/settings/settings-view";

export const metadata: Metadata = { title: "Workflow · Réglages" };

export default function SettingsPage() {
  return <WorkflowSettings />;
}
