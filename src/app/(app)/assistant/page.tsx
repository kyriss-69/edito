import type { Metadata } from "next";

import { AssistantView } from "@/components/assistant/assistant-view";
import { getChat, listChats } from "@/server/ai/chats";

export const metadata: Metadata = { title: "Assistant" };

export default async function AssistantPage(props: PageProps<"/assistant">) {
  const { chat } = await props.searchParams;
  const id = Number(Array.isArray(chat) ? chat[0] : chat);
  return <AssistantView chats={listChats()} chat={Number.isInteger(id) && id > 0 ? getChat(id) : null} />;
}
