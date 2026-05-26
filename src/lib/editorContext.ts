import { useEditorStore } from "@/state/editorStore";
import { useReflowStore } from "@/state/reflowStore";

/** Visible canvas page id: active page → first page. */
export function getVisiblePageId(): string | undefined {
  const activePageId = useEditorStore.getState().activePageId;
  const pages = useReflowStore.getState().pages;
  return activePageId ?? pages[0]?.id;
}

/** Page id for scoped ops: selection → visible canvas page → first page. */
export function getContextPageId(): string | undefined {
  const selection = useEditorStore.getState().selection;
  return selection?.pageId ?? getVisiblePageId();
}
