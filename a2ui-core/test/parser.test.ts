import { describe, it, expect } from 'vitest';
import { A2UIParser } from '../src/parser.js';

describe('A2UIParser', () => {
  const parser = new A2UIParser();

  it('should parse updateComponents message', () => {
    const line = JSON.stringify({
      version: 'v0.9',
      updateComponents: {
        surfaceId: 'main',
        components: [{ id: 'root', component: 'Column', children: ['title'] }],
      },
    });
    const result = parser.parseLine(line);
    expect(result.type).toBe('updateComponents');
    expect(result.message).toBeDefined();
  });

  it('should parse updateDataModel message', () => {
    const line = JSON.stringify({
      version: 'v0.9',
      updateDataModel: {
        surfaceId: 'main',
        path: 'user',
        value: { name: 'Alice', age: 30 },
      },
    });
    const result = parser.parseLine(line);
    expect(result.type).toBe('updateDataModel');
    expect(result.message).toBeDefined();
  });

  it('should parse createSurface message', () => {
    const line = JSON.stringify({
      version: 'v0.9',
      createSurface: {
        surfaceId: 'main',
        catalogId: 'https://a2ui.org/specification/v0_9/basic_catalog.json',
      },
    });
    const result = parser.parseLine(line);
    expect(result.type).toBe('createSurface');
    expect(result.message).toBeDefined();
  });

  it('should parse deleteSurface message', () => {
    const line = JSON.stringify({
      version: 'v0.9',
      deleteSurface: { surfaceId: 'main' },
    });
    const result = parser.parseLine(line);
    expect(result.type).toBe('deleteSurface');
    expect(result.message).toBeDefined();
  });

  it('should handle invalid JSON', () => {
    const result = parser.parseLine('not json');
    expect(result.type).toBe('error');
    expect(result.error).toContain('Invalid JSON');
  });

  it('should handle empty line', () => {
    const result = parser.parseLine('   ');
    expect(result.type).toBe('error');
    expect(result.error).toBe('Empty line');
  });

  it('should reject missing version', () => {
    const result = parser.parseLine('{"updateComponents": {}}');
    expect(result.type).toBe('error');
    expect(result.error).toContain('version');
  });

  it('should handle unknown message type', () => {
    const result = parser.parseLine('{"version":"v0.9","unknownKey": {}}');
    expect(result.type).toBe('error');
    expect(result.error).toContain('Unknown message type');
  });

  it('should reject multiple keys in message', () => {
    const result = parser.parseLine(
      '{"version":"v0.9","updateComponents": {}, "updateDataModel": {}}'
    );
    expect(result.type).toBe('error');
    expect(result.error).toContain('exactly one key');
  });

  it('should parse chunk with incomplete line', () => {
    const p = new A2UIParser();
    const chunk =
      '{"version":"v0.9","updateComponents": {"surfaceId": "main", "components": []}}\n{"version":"v0.9","updateDataModel": {"surfaceId": "m';
    const results = p.parseChunk(chunk);
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('updateComponents');
    expect(p.getPendingBuffer()).toContain('"updateDataModel"');
  });

  it('should flush pending buffer', () => {
    const p = new A2UIParser();
    p.parseChunk(
      '{"version":"v0.9","createSurface": {"surfaceId": "main", "catalogId": "c"}}'
    );
    const result = p.flush();
    expect(result).not.toBeNull();
    expect(result!.type).toBe('createSurface');
  });

  it('should parse standard protocol example - profile card stream', () => {
    const stream = [
      '{"version":"v0.9","updateComponents": {"surfaceId": "main", "components": [{"id": "root", "component": "Column", "children": ["profile_card"]}]}}',
      '{"version":"v0.9","updateComponents": {"surfaceId": "main", "components": [{"id": "profile_card", "component": "Card", "child": "card_content"}]}}',
      '{"version":"v0.9","updateComponents": {"surfaceId": "main", "components": [{"id": "card_content", "component": "Column", "children": ["header_row", "bio_text"]}]}}',
      '{"version":"v0.9","updateComponents": {"surfaceId": "main", "components": [{"id": "header_row", "component": "Row", "alignment": "center", "children": ["avatar", "name_column"]}]}}',
      '{"version":"v0.9","updateComponents": {"surfaceId": "main", "components": [{"id": "avatar", "component": "Image", "url": "https://example.com/profile.jpg"}]}}',
      '{"version":"v0.9","updateDataModel": {"surfaceId": "main", "value": {}}}',
      '{"version":"v0.9","createSurface": {"surfaceId": "main", "catalogId": "test"}}',
    ];

    const p = new A2UIParser();
    const results: any[] = [];
    for (const line of stream) {
      results.push(p.parseLine(line));
    }

    expect(results.filter((r) => r.type === 'error')).toHaveLength(0);
    expect(results.filter((r) => r.type === 'updateComponents')).toHaveLength(5);
    expect(results.filter((r) => r.type === 'updateDataModel')).toHaveLength(1);
    expect(results.filter((r) => r.type === 'createSurface')).toHaveLength(1);
  });
});
