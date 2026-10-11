import { useEffect, useState } from "react";
import { ActionMenu } from "../ux";
import {
  captureTextContext,
  replaceTextSelection,
  type TextContext,
} from "../ux/textActions";
import { useMusicAppContext } from "./MusicAppContext";

export default function AppContextMenu() {
  const {
    t,
    act,
    setSection,
    closeGroup,
    setSearchOpen,
    setModal,
    dismissModals,
    setMenu,
    setSelectionMode,
    setSelectedIds,
    menu,
    modal,
    searchOpen,
  } = useMusicAppContext();
  const [context, setContext] = useState<{
    anchor: HTMLElement;
    point?: { x: number; y: number };
    text: TextContext;
    card: HTMLButtonElement | null;
  } | null>(null);
  useEffect(() => {
    const open = (event: MouseEvent) => {
      if (event.defaultPrevented || !(event.target instanceof Element)) return;
      event.preventDefault();
      const target =
        event.target instanceof HTMLElement
          ? event.target
          : (event.target.closest<HTMLElement>("button,[tabindex],div") ??
            document.body);
      if (target.closest(".action-menu,[inert]")) return;
      const anchor =
        target.closest<HTMLElement>("button,input,textarea,[tabindex]") ??
        (document.activeElement instanceof HTMLElement
          ? document.activeElement
          : target);
      setMenu(null);
      setContext({
        anchor,
        point:
          event.clientX || event.clientY
            ? { x: event.clientX, y: event.clientY }
            : undefined,
        text: captureTextContext(target),
        card: target.closest<HTMLButtonElement>(
          "button.album-card,button.playlist-tile",
        ),
      });
    };
    document.addEventListener("contextmenu", open);
    return () => document.removeEventListener("contextmenu", open);
  }, [setMenu]);
  useEffect(() => {
    if (menu) setContext(null);
  }, [menu]);
  if (!context) return null;
  const navigate = (tab: "library" | "year") => {
    dismissModals();
    setSearchOpen(false);
    setSelectionMode(false);
    setSelectedIds([]);
    closeGroup();
    setSection(tab === "year" ? "year" : "songs");
  };
  const clipboard = async (operation: () => Promise<void>) => {
    try {
      await operation();
    } catch {
      throw new Error(t.clipboardHint);
    }
  };
  const editor = context.text.editor;
  const textItems = [
    {
      label: t.copyText,
      disabled: !context.text.text || !navigator.clipboard?.writeText,
      action: () =>
        void act(() =>
          clipboard(() => navigator.clipboard.writeText(context.text.text)),
        ),
    },
    ...(editor
      ? [
          {
            label: t.cutText,
            disabled:
              !context.text.text ||
              editor.readOnly ||
              editor.disabled ||
              !navigator.clipboard?.writeText,
            action: () =>
              void act(() =>
                clipboard(async () => {
                  await navigator.clipboard.writeText(context.text.text);
                  replaceTextSelection(context.text, "");
                }),
              ),
          },
          {
            label: t.pasteText,
            disabled:
              editor.readOnly ||
              editor.disabled ||
              !navigator.clipboard?.readText,
            action: () =>
              void act(() =>
                clipboard(async () =>
                  replaceTextSelection(
                    context.text,
                    await navigator.clipboard.readText(),
                  ),
                ),
              ),
          },
          {
            label: t.selectAllText,
            action: () => {
              editor.focus({ preventScroll: true });
              editor.select();
            },
          },
        ]
      : []),
  ];
  return (
    <ActionMenu
      anchor={context.anchor}
      point={context.point}
      label={editor ? t.textActions : t.appActions}
      onClose={() => setContext(null)}
      items={[
        ...(editor || context.text.text ? textItems : []),
        ...(context.card
          ? [{ label: t.openItem, action: () => context.card?.click() }]
          : []),
        ...(!modal && !searchOpen
          ? [
              { label: t.library, action: () => navigate("library") },
              { label: t.year, action: () => navigate("year") },
              { label: t.search, action: () => setSearchOpen(true) },
              { label: t.settings, action: () => setModal("settings") },
            ]
          : []),
        { label: t.close, action: () => {} },
      ]}
    />
  );
}
