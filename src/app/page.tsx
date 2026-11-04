import { redirect } from "next/navigation";
import { connection } from "next/server";

import { LANDING_PAGES } from "@/lib/preferences";
import { getUiPreferences } from "@/server/settings";

export default async function Home() {
  await connection();
  const { landing } = getUiPreferences();
  redirect(LANDING_PAGES.find((p) => p.id === landing)?.href ?? "/board");
}
