import type { Metadata } from "next";

import { PostsTable } from "@/components/list/posts-table";

export const metadata: Metadata = { title: "Liste" };

export default function ListPage() {
  return <PostsTable />;
}
