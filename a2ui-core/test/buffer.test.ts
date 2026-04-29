import { describe, it, expect } from 'vitest';
import { A2UIBuffer } from '../src/buffer.js';

describe('A2UIBuffer', () => {
  it('should buffer surfaceUpdate messages', () => {
    const buffer = new A2UIBuffer();
    buffer.push({
      surfaceUpdate: {
        surfaceId: 'main',
        components: [
          { id: 'root', component: { Column: { children: { explicitList: ['title'] } } } },
          { id: 'title', component: { Text: { text: { literalString: 'Hello' } } } },
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
      surfaceUpdate: {
        surfaceId: 'main',
        components: [{ id: 'title', component: { Text: { text: { literalString: 'Old' } } } }],
      },
    });
    buffer.push({
      surfaceUpdate: {
        surfaceId: 'main',
        components: [{ id: 'title', component: { Text: { text: { literalString: 'New' } } } }],
      },
    });

    const components = buffer.getComponents('main');
    expect(components).toHaveLength(1);
  });

  it('should buffer dataModelUpdate', () => {
    const buffer = new A2UIBuffer();
    buffer.push({
      dataModelUpdate: {
        surfaceId: 'main',
        path: 'user',
        contents: [{ key: 'name', valueString: 'Alice' }],
      },
    });

    const model = buffer.getDataModel('main');
    expect(model.user.name).toBe('Alice');
  });

  it('should mark surface ready on beginRendering', () => {
    const buffer = new A2UIBuffer();
    expect(buffer.isReady('main')).toBe(false);

    buffer.push({
      surfaceUpdate: {
        surfaceId: 'main',
        components: [{ id: 'root', component: { Column: { children: { explicitList: [] } } } }],
      },
    });
    buffer.push({ beginRendering: { surfaceId: 'main', root: 'root' } });

    expect(buffer.isReady('main')).toBe(true);
    expect(buffer.getRootId('main')).toBe('root');
  });

  it('should store catalogId from beginRendering', () => {
    const buffer = new A2UIBuffer();
    buffer.push({
      beginRendering: {
        surfaceId: 'main',
        root: 'root',
        catalogId: 'https://a2ui.org/specification/v0_8/standard_catalog_definition.json',
      },
    });

    const state = buffer.getSurfaceState('main');
    expect(state?.catalogId).toBe('https://a2ui.org/specification/v0_8/standard_catalog_definition.json');
  });

  it('should delete surface', () => {
    const buffer = new A2UIBuffer();
    buffer.push({
      surfaceUpdate: {
        surfaceId: 'main',
        components: [{ id: 'root', component: { Column: { children: { explicitList: [] } } } }],
      },
    });
    buffer.push({ deleteSurface: { surfaceId: 'main' } });

    expect(buffer.getSurfaceState('main')).toBeUndefined();
  });

  it('should manage multiple surfaces', () => {
    const buffer = new A2UIBuffer();
    buffer.push({
      surfaceUpdate: {
        surfaceId: 'surface1',
        components: [{ id: 'root1', component: { Text: { text: { literalString: 'A' } } } }],
      },
    });
    buffer.push({
      surfaceUpdate: {
        surfaceId: 'surface2',
        components: [{ id: 'root2', component: { Text: { text: { literalString: 'B' } } } }],
      },
    });

    expect(buffer.getSurfaceIds()).toHaveLength(2);
    expect(buffer.getComponents('surface1')).toHaveLength(1);
    expect(buffer.getComponents('surface2')).toHaveLength(1);
  });

  it('should clear all surfaces', () => {
    const buffer = new A2UIBuffer();
    buffer.push({
      surfaceUpdate: {
        surfaceId: 'main',
        components: [{ id: 'root', component: { Text: { text: { literalString: 'Test' } } } }],
      },
    });
    buffer.clearAll();

    expect(buffer.getSurfaceIds()).toHaveLength(0);
    expect(buffer.getComponents('main')).toHaveLength(0);
  });
});
