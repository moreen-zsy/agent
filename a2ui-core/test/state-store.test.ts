import { describe, it, expect, vi } from 'vitest';
import {
  createZustandNotifier,
  createMemoryNotifier,
  createAdapterNotifier,
  createZustandStoreAdapter,
  type StoreAdapterConfig,
} from '../src/state-store.js';

describe('State Store Notifiers', () => {
  describe('createZustandNotifier', () => {
    it('should start with version 0', () => {
      const notifier = createZustandNotifier();
      expect(notifier.getSnapshot()).toBe(0);
    });

    it('should increment version on notify', () => {
      const notifier = createZustandNotifier();
      notifier.notify();
      expect(notifier.getSnapshot()).toBe(1);
      notifier.notify();
      expect(notifier.getSnapshot()).toBe(2);
    });

    it('should notify subscribers', () => {
      const notifier = createZustandNotifier();
      const listener = vi.fn();
      const unsubscribe = notifier.subscribe(listener);

      notifier.notify();
      expect(listener).toHaveBeenCalledTimes(1);

      notifier.notify();
      expect(listener).toHaveBeenCalledTimes(2);

      unsubscribe();
      notifier.notify();
      expect(listener).toHaveBeenCalledTimes(2); // no more calls after unsubscribe
    });

    it('should support multiple subscribers', () => {
      const notifier = createZustandNotifier();
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      notifier.subscribe(listener1);
      notifier.subscribe(listener2);

      notifier.notify();
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });
  });

  describe('createMemoryNotifier', () => {
    it('should start with version 0', () => {
      const notifier = createMemoryNotifier();
      expect(notifier.getSnapshot()).toBe(0);
    });

    it('should increment version on notify', () => {
      const notifier = createMemoryNotifier();
      notifier.notify();
      expect(notifier.getSnapshot()).toBe(1);
    });

    it('should notify subscribers', () => {
      const notifier = createMemoryNotifier();
      const listener = vi.fn();
      const unsubscribe = notifier.subscribe(listener);

      notifier.notify();
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      notifier.notify();
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('createAdapterNotifier', () => {
    it('should delegate to adapter config', () => {
      const subscribe = vi.fn(() => vi.fn());
      const getSnapshot = vi.fn(() => 42);
      const notify = vi.fn();

      const adapter: StoreAdapterConfig = {
        subscribe,
        getSnapshot,
        notify,
      };

      const notifier = createAdapterNotifier(adapter);

      expect(notifier.getSnapshot()).toBe(42);

      const listener = vi.fn();
      notifier.subscribe(listener);
      expect(subscribe).toHaveBeenCalledWith(listener);

      notifier.notify();
      expect(notify).toHaveBeenCalledTimes(1);
    });
  });

  describe('createZustandStoreAdapter', () => {
    it('should create adapter from external zustand-like store', () => {
      let version = 0;
      const listeners = new Set<() => void>();

      const externalStore = {
        getState: () => ({ version }),
        setState: (updater: (state: { version: number }) => { version: number }) => {
          const newState = updater({ version });
          version = newState.version;
          for (const l of listeners) l();
        },
        subscribe: (listener: () => void) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      };

      const adapter = createZustandStoreAdapter(
        externalStore,
        (state) => state.version
      );

      expect(adapter.getSnapshot()).toBe(0);

      const listener = vi.fn();
      adapter.subscribe(listener);

      adapter.notify();
      expect(listener).toHaveBeenCalled();
    });
  });
});

describe('A2UIStore with notifiers', () => {
  it('should use zustand notifier by default', async () => {
    const { A2UIStore } = await import('../src/store.js');
    const store = new A2UIStore();

    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.processMessage({
      surfaceUpdate: {
        surfaceId: 'test',
        components: [{ id: 'a', component: { Text: { text: { literalString: 'hi' } } } }],
      },
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toBe(1);

    unsubscribe();
  });

  it('should use adapter when provided', async () => {
    const { A2UIStore } = await import('../src/store.js');
    let version = 0;
    const listeners = new Set<() => void>();

    const store = new A2UIStore({
      adapter: {
        subscribe: (l) => {
          listeners.add(l);
          return () => listeners.delete(l);
        },
        getSnapshot: () => version,
        notify: () => {
          version++;
          for (const l of listeners) l();
        },
      },
    });

    const listener = vi.fn();
    store.subscribe(listener);

    store.processMessage({
      surfaceUpdate: {
        surfaceId: 'test',
        components: [{ id: 'a', component: { Text: { text: { literalString: 'hi' } } } }],
      },
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toBe(1);
  });

  it('should maintain existing API with zustand backend', async () => {
    const { A2UIStore } = await import('../src/store.js');
    const store = new A2UIStore();

    // processMessage
    store.processMessage({
      surfaceUpdate: {
        surfaceId: 'main',
        components: [
          { id: 'root', component: { Column: { children: { explicitList: ['text1'] } } } },
          { id: 'text1', component: { Text: { text: { literalString: 'Hello' } } } },
        ],
      },
    });

    store.processMessage({
      beginRendering: { surfaceId: 'main', root: 'root' },
    });

    // query APIs
    expect(store.isReady('main')).toBe(true);
    expect(store.getRootId('main')).toBe('root');
    expect(store.getSurfaceIds()).toContain('main');
    expect(store.getComponents('main').size).toBe(2);

    // snapshot API for React useSyncExternalStore
    expect(typeof store.getSnapshot()).toBe('number');
  });
});
