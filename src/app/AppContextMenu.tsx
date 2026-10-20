import { useEffect, useState } from "react";
import { ActionMenu } from "../ux";
import {
  captureTextContext,
  replaceTextSelection,
  type TextContext,
} from "../ux/textActions";
import { useMusicAppContext } from "./MusicAppContext";

export default function AppContextMenu() {
  const { t, act, setMenu, menu, modal, searchOpen } = useMusicAppContext();
  const [context, setContext] = useState<{
    anchor: HTMLElement;
    point?: { x: number; y: number };
    text: TextContext;
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
      const text = captureTextContext(target);
      setContext(
        text.editor || text.text
          ? {
              anchor,
              point:
                event.clientX || event.clientY
                  ? { x: event.clientX, y: event.clientY }
                  : undefined,
              text,
            }
          : null,
      );
    };
    document.addEventListener("contextmenu", open);
    return () => document.removeEventListener("contextmenu", open);
  }, [setMenu]);
  useEffect(() => {
    if (menu) setContext(null);
  }, [menu]);
  useEffect(() => setContext(null), [modal, searchOpen]);
  if (!context) return null;
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
      id: "copy",
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
            id: "cut",
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
            id: "paste",
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
            id: "select-all",
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
      label={t.textActions}
      onClose={() => setContext(null)}
      items={textItems}
    />
  );
}
