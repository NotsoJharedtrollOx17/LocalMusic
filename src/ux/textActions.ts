/** Snapshot the selection before a menu moves focus away from an editor. */
export function captureTextContext(target: HTMLElement) {
  if (
    (target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement) &&
    target.selectionStart !== null
  ) {
    return {
      editor: target,
      value: target.value,
      start: target.selectionStart,
      end: target.selectionEnd ?? target.selectionStart,
      text: target.value.slice(
        target.selectionStart,
        target.selectionEnd ?? target.selectionStart,
      ),
    };
  }
  return { editor: null, text: window.getSelection()?.toString() ?? "" };
}
export type TextContext = ReturnType<typeof captureTextContext>;

export function replaceTextSelection(
  context: TextContext,
  replacement: string,
) {
  if (
    !context.editor ||
    !context.editor.isConnected ||
    context.editor.value !== context.value ||
    context.editor.readOnly ||
    context.editor.disabled
  )
    return;
  const editor = context.editor;
  const value =
    context.value.slice(0, context.start) +
    replacement +
    context.value.slice(context.end);
  const prototype =
    editor instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(editor, value);
  editor.dispatchEvent(new Event("input", { bubbles: true }));
  editor.focus({ preventScroll: true });
  const caret = context.start + replacement.length;
  editor.setSelectionRange(caret, caret);
}
