import type { Metadata } from "next";

import { KanbanBoard } from "@/components/board/kanban-board";

export const metadata: Metadata = { title: "Tableau" };

export default function BoardPage() {
  return <KanbanBoard />;
}
