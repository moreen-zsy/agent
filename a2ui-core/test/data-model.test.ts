import { describe, it, expect, beforeEach } from 'vitest';
import { DataModelStore } from '../src/data-model.js';

describe('DataModelStore', () => {
  let store: DataModelStore;

  beforeEach(() => {
    store = new DataModelStore();
  });

  it('should get empty model', () => {
    const model = store.getModel('main');
    expect(model).toEqual({});
  });

  it('should update data model with contents', () => {
    store.update('main', '/', [
      { key: 'name', valueString: 'Alice' },
      { key: 'age', valueNumber: 30 },
      { key: 'isActive', valueBoolean: true },
    ]);
    const model = store.getModel('main');
    expect(model.name).toBe('Alice');
    expect(model.age).toBe(30);
    expect(model.isActive).toBe(true);
  });

  it('should update nested data model', () => {
    store.update('main', '/', [
      {
        key: 'user',
        valueMap: [
          { key: 'name', valueString: 'Bob' },
          {
            key: 'address',
            valueMap: [
              { key: 'street', valueString: '123 Main St' },
              { key: 'city', valueString: 'Anytown' },
            ],
          },
        ],
      },
    ]);
    const model = store.getModel('main');
    expect(model.user.name).toBe('Bob');
    expect(model.user.address.street).toBe('123 Main St');
    expect(model.user.address.city).toBe('Anytown');
  });

  it('should update at specific path', () => {
    store.update('main', 'user', [
      { key: 'name', valueString: 'Charlie' },
    ]);
    const model = store.getModel('main');
    expect(model.user.name).toBe('Charlie');
  });

  it('should get value by JSON Pointer path', () => {
    store.update('main', '/', [
      {
        key: 'items',
        valueMap: [
          {
            key: '0',
            valueMap: [
              { key: 'name', valueString: 'Widget' },
              { key: 'price', valueNumber: 9.99 },
            ],
          },
        ],
      },
    ]);

    expect(store.getValue('main', '/items/0/name')).toBe('Widget');
    expect(store.getValue('main', '/items/0/price')).toBe(9.99);
    expect(store.getValue('main', '/nonexistent')).toBeUndefined();
  });

  it('should resolve literalString bound value', () => {
    const result = store.resolveBoundValue('main', { literalString: 'Hello' });
    expect(result).toBe('Hello');
  });

  it('should resolve literalNumber bound value', () => {
    const result = store.resolveBoundValue('main', { literalNumber: 42 });
    expect(result).toBe(42);
  });

  it('should resolve literalBoolean bound value', () => {
    const result = store.resolveBoundValue('main', { literalBoolean: true });
    expect(result).toBe(true);
  });

  it('should resolve path bound value', () => {
    store.update('main', '/', [{ key: 'username', valueString: 'test_user' }]);
    const result = store.resolveBoundValue('main', { path: '/username' });
    expect(result).toBe('test_user');
  });

  it('should resolve initialization shorthand (path + literal)', () => {
    const result = store.resolveBoundValue('main', {
      path: '/user/name',
      literalString: 'Guest',
    });
    expect(result).toBe('Guest');
    expect(store.getValue('main', '/user/name')).toBe('Guest');
  });

  it('should delete model', () => {
    store.update('main', '/', [{ key: 'x', valueNumber: 1 }]);
    store.deleteModel('main');
    expect(store.getModel('main')).toEqual({});
  });
});
