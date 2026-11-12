import { afterNextRender, type AfterRenderRef, type Injector, type ViewContainerRef } from '@angular/core';

// Shell and nested panel replacements can retain the same application-owned node.
// Keep only one pending restoration for that node, without extending its lifetime.
const pending = new WeakMap<HTMLElement, AfterRenderRef>();

/** Internal native-node policy; never maps focus to a replacement control. */
export function captureRetainedFocus(target: ViewContainerRef, roots: readonly Node[], injector: Injector): () => void {
  const document = target.element.nativeElement.ownerDocument as Document | undefined;
  const focused = document?.activeElement as HTMLElement | null;
  if (!focused || !roots.some(root => root.contains(focused))) return () => {};
  return () => {
    pending.get(focused)?.destroy();
    const ref = afterNextRender(() => {
      pending.delete(focused);
      const active = document?.activeElement;
      if (focused.isConnected && typeof focused.focus === 'function' &&
          (!active || active === document?.body)) focused.focus({ preventScroll: true });
    }, { injector });
    pending.set(focused, ref);
  };
}
