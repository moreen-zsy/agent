import { describe, it, expect } from 'vitest';
import { A2UIBuffer } from '../src/buffer.js';

const V09 = 'v0.9' as const;

describe('A2UIBuffer', () => {
  it('should buffer updateComponents messages', () => {
    const buffer = new A2UIBuffer();
    buffer.push({
      version: V09,
      updateComponents: {
        surfaceId: 'main',
        components: [
          { id: 'root', component: 'Column', children: ['title'] },
          { id: 'title', component: 'Text', text: 'Hello' },
        ],
      },
    });

    const components = buffer.getComponents('main');
    expect(components).toHaveLength(2);
    expect(components[0].id).toBe('root');
    expect(components[1].id).toBe('title');
  });

  it('should overwrite components with same id', () => {
    const buffer = new A2UIBuffer();
    buffer.push({
      version: V09,
      updateComponents: {
        surfaceId: 'main',
        components: [{ id: 'title', component: 'Text', text: 'Old' }],
      },
    });
    buffer.push({
      version: V09,
      updateComponents: {
        surfaceId: 'main',
        components: [{ id: 'title', component: 'Text', text: 'New' }],
      },
    });

    const components = buffer.getComponents('main');
    expect(components).toHaveLength(1);
  });

  it('should buffer updateDataModel', () => {
    const buffer = new A2UIBuffer();
    buffer.push({
      version: V09,
      updateDataModel: {
        surfaceId: 'main',
        path: 'user',
        value: { name: 'Alice' },
      },
    });

    const model = buffer.getDataModel('main');
    expect(model.user.name).toBe('Alice');
  });

  it('should mark surface ready on createSurface', () => {
    const buffer = new A2UIBuffer();
    expect(buffer.isReady('main')).toBe(false);

    buffer.push({
      version: V09,
      updateComponents: {
        surfaceId: 'main',
        components: [{ id: 'root', component: 'Column', children: [] }],
      },
    });
    buffer.push({
      version: V09,
      createSurface: { surfaceId: 'main', catalogId: 'test-catalog' },
    });

    expect(buffer.isReady('main')).toBe(true);
    expect(buffer.findRootId('main')).toBe('root');
  });

  it('should store catalogId from createSurface', () => {
    const buffer = new A2UIBuffer();
    const catalogId = 'https://a2ui.org/specification/v0_9/basic_catalog.json';
    buffer.push({
      version: V09,
      createSurface: { surfaceId: 'main', catalogId },
    });

    const state = buffer.getSurfaceState('main');
    expect(state?.catalogId).toBe(catalogId);
  });

  it('should delete surface', () => {
    const buffer = new A2UIBuffer();
    buffer.push({
      version: V09,
      updateComponents: {
        surfaceId: 'main',
        components: [{ id: 'root', component: 'Column', children: [] }],
      },
    });
    buffer.push({ version: V09, deleteSurface: { surfaceId: 'main' } });

    expect(buffer.getSurfaceState('main')).toBeUndefined();
  });

  it('should manage multiple surfaces', () => {
    const buffer = new A2UIBuffer();
    buffer.push({
      version: V09,
      updateComponents: {
        surfaceId: 'surface1',
        components: [{ id: 'root1', component: 'Text', text: 'A' }],
      },
    });
    buffer.push({
      version: V09,
      updateComponents: {
        surfaceId: 'surface2',
        components: [{ id: 'root2', component: 'Text', text: 'B' }],
      },
    });

    expect(buffer.getSurfaceIds()).toHaveLength(2);
    expect(buffer.getComponents('surface1')).toHaveLength(1);
    expect(buffer.getComponents('surface2')).toHaveLength(1);
  });

  it('should clear all surfaces', () => {
    const buffer = new A2UIBuffer();
    buffer.push({
      version: V09,
      updateComponents: {
        surfaceId: 'main',
        components: [{ id: 'root', component: 'Text', text: 'Test' }],
      },
    });
    buffer.clearAll();

    expect(buffer.getSurfaceIds()).toHaveLength(0);
    expect(buffer.getComponents('main')).toHaveLength(0);
  });
});
