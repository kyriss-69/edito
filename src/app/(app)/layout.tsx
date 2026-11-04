import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";

import { AppProvider } from "@/components/app-provider";
import { AppFrame } from "@/components/shell/app-frame";
import { SIDEBAR_COOKIE } from "@/lib/preferences";
import { getMeta, getPosts } from "@/server/queries";

async function AppShell({ children }: { children: React.ReactNode }) {
  // Les données viennent d'une base SQLite locale : rendu à chaque requête.
  await connection();
  const meta = getMeta();
  const posts = getPosts();
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed";

  return (
    <AppProvider meta={meta} posts={posts}>
      <AppFrame initialCollapsed={collapsed}>{children}</AppFrame>
    </AppProvider>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
