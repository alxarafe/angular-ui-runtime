import type { ThemeNavigationItem } from './theme-ports.js';

/** Link intent only; cancellation is supported exclusively during the synchronous callback. */
export interface ThemeLinkActivation {
  readonly itemId: string;
  readonly href: string;
  readonly defaultPrevented: boolean;
  preventDefault(): void;
}
export type ThemeLinkActivationHandler = (activation: ThemeLinkActivation) => void;

/** Call once on an anchor's click. Modified clicks, other targets and downloads stay native. */
export function activateThemeLink(item: ThemeNavigationItem, event: MouseEvent, handler?: ThemeLinkActivationHandler): void {
  const anchor = event.currentTarget as HTMLAnchorElement | null;
  const target = anchor?.getAttribute('target') || anchor?.ownerDocument.querySelector('base[target]')?.getAttribute('target');
  if (!handler || item.disabled || !item.href || !event.cancelable || event.defaultPrevented ||
      event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey ||
      anchor?.hasAttribute('download') || (target && target.toLowerCase() !== '_self')) return;
  let dispatching = true;
  const activation: ThemeLinkActivation = Object.freeze({
    itemId: item.id, href: item.href,
    get defaultPrevented() { return event.defaultPrevented; },
    preventDefault() { if (dispatching) event.preventDefault(); },
  });
  try { handler(activation); } finally { dispatching = false; }
}
