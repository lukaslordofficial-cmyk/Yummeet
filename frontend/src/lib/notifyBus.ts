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

const chatListeners = new Set<Listener>();

export function onChatsChanged(fn: Listener): () => void {
  chatListeners.add(fn);
  return () => chatListeners.delete(fn);
}

export function emitChatsChanged(): void {
  chatListeners.forEach((fn) => {
    try { fn(); } catch { /* ignore */ }
  });
}
