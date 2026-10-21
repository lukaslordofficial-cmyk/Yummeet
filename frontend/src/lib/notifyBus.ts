type Listener = () => void;
const listeners = new Set<Listener>();

export function onNotificationsChanged(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitNotificationsChanged(): void {
  listeners.forEach((fn) => {
    try { fn(); } catch { /* ignore */ }
  });
}
