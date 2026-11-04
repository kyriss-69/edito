"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { IdeasDialog } from "@/components/ai/ideas-dialog";
import { PostEditor, type NewPostDefaults } from "@/components/posts/post-editor";
import type { Meta, PostDTO } from "@/lib/types";

type EditorTarget =
  | { session: number; postId: number }
  | { session: number; postId: null; defaults: NewPostDefaults };

type AppContextValue = {
  meta: Meta;
  posts: PostDTO[];
  openPost: (postId: number) => void;
  newPost: (defaults?: NewPostDefaults) => void;
  /** Ouvre la fenêtre « Idées de posts » (vérifier d'abord que l'IA est configurée). */
  openIdeas: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp doit être utilisé dans <AppProvider>");
  return value;
}

export function AppProvider({
  meta,
  posts,
  children,
}: {
  meta: Meta;
  posts: PostDTO[];
  children: React.ReactNode;
}) {
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [ideasOpen, setIdeasOpen] = useState(false);

  const openPost = useCallback((postId: number) => {
    setEditor((prev) => ({ session: (prev?.session ?? 0) + 1, postId }));
    setEditorOpen(true);
  }, []);

  const newPost = useCallback((defaults: NewPostDefaults = {}) => {
    setEditor((prev) => ({ session: (prev?.session ?? 0) + 1, postId: null, defaults }));
    setEditorOpen(true);
  }, []);

  const openIdeas = useCallback(() => setIdeasOpen(true), []);

  const value = useMemo(
    () => ({ meta, posts, openPost, newPost, openIdeas }),
    [meta, posts, openPost, newPost, openIdeas],
  );

  return (
    <AppContext.Provider value={value}>
      {children}
      {editor && (
        <PostEditor
          key={editor.session}
          open={editorOpen}
          onOpenChange={setEditorOpen}
          postId={editor.postId}
          defaults={"defaults" in editor ? editor.defaults : undefined}
        />
      )}
      {ideasOpen && <IdeasDialog onClose={() => setIdeasOpen(false)} />}
    </AppContext.Provider>
  );
}
