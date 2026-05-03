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

  it('should update data model with standard JSON', () => {
    store.update('main', '/', { name: 'Alice', age: 30, isActive: true });
    const model = store.getModel('main');
    expect(model.name).toBe('Alice');
    expect(model.age).toBe(30);
    expect(model.isActive).toBe(true);
  });

  it('should update nested data model', () => {
    store.update('main', '/', {
      user: {
        name: 'Bob',
        address: {
          street: '123 Main St',
          city: 'Anytown',
        },
      },
    });
    const model = store.getModel('main');
    expect(model.user.name).toBe('Bob');
    expect(model.user.address.street).toBe('123 Main St');
    expect(model.user.address.city).toBe('Anytown');
  });

  it('should update at specific path', () => {
    store.update('main', 'user', { name: 'Charlie' });
    const model = store.getModel('main');
    expect(model.user.name).toBe('Charlie');
  });

  it('should get value by JSON Pointer path', () => {
    store.update('main', '/', {
      items: [{ name: 'Widget', price: 9.99 }],
    });

    expect(store.getValue('main', '/items/0/name')).toBe('Widget');
    expect(store.getValue('main', '/items/0/price')).toBe(9.99);
    expect(store.getValue('main', '/nonexistent')).toBeUndefined();
  });

  it('should resolve string literal DynamicValue', () => {
    const result = store.resolveDynamicValue('main', 'Hello');
    expect(result).toBe('Hello');
  });

  it('should resolve number literal DynamicValue', () => {
    const result = store.resolveDynamicValue('main', 42);
    expect(result).toBe(42);
  });

  it('should resolve boolean literal DynamicValue', () => {
    const result = store.resolveDynamicValue('main', true);
    expect(result).toBe(true);
  });

  it('should resolve {path} DynamicValue from data model', () => {
    store.update('main', '/', { username: 'test_user' });
    const result = store.resolveDynamicValue('main', { path: '/username' });
    expect(result).toBe('test_user');
  });

  it('should pass through {call} DynamicValue unchanged', () => {
    const fnCall = { call: 'formatDate', args: { date: '2026-01-01' } };
    const result = store.resolveDynamicValue('main', fnCall);
    expect(result).toBe(fnCall);
  });

  it('should set value at path with setValue', () => {
    store.setValue('main', '/user/name', 'Guest');
    expect(store.getValue('main', '/user/name')).toBe('Guest');
  });

  it('should delete model', () => {
    store.update('main', '/', { x: 1 });
    store.deleteModel('main');
    expect(store.getModel('main')).toEqual({});
  });
});
