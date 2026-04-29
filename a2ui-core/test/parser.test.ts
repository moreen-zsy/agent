import { describe, it, expect } from 'vitest';
import { A2UIParser } from '../src/parser.js';

describe('A2UIParser', () => {
  const parser = new A2UIParser();

  it('should parse surfaceUpdate message', () => {
    const line = JSON.stringify({
      surfaceUpdate: {
        surfaceId: 'main',
        components: [{ id: 'root', component: { Column: { children: { explicitList: ['title'] } } } }],
      },
    });
    const result = parser.parseLine(line);
    expect(result.type).toBe('surfaceUpdate');
    expect(result.message).toBeDefined();
  });

  it('should parse dataModelUpdate message', () => {
    const line = JSON.stringify({
      dataModelUpdate: {
        surfaceId: 'main',
        path: 'user',
        contents: [
          { key: 'name', valueString: 'Alice' },
          { key: 'age', valueNumber: 30 },
        ],
      },
    });
    const result = parser.parseLine(line);
    expect(result.type).toBe('dataModelUpdate');
    expect(result.message).toBeDefined();
  });

  it('should parse beginRendering message', () => {
    const line = JSON.stringify({
      beginRendering: {
        surfaceId: 'main',
        root: 'root',
        catalogId: 'https://a2ui.org/specification/v0_8/standard_catalog_definition.json',
      },
    });
    const result = parser.parseLine(line);
    expect(result.type).toBe('beginRendering');
    expect(result.message).toBeDefined();
  });

  it('should parse deleteSurface message', () => {
    const line = JSON.stringify({ deleteSurface: { surfaceId: 'main' } });
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

  it('should handle unknown message type', () => {
    const result = parser.parseLine('{"unknownKey": {}}');
    expect(result.type).toBe('error');
    expect(result.error).toContain('Unknown message type');
  });

  it('should reject multiple keys in message', () => {
    const result = parser.parseLine('{"surfaceUpdate": {}, "dataModelUpdate": {}}');
    expect(result.type).toBe('error');
    expect(result.error).toContain('exactly one key');
  });

  it('should parse chunk with incomplete line', () => {
    const p = new A2UIParser();
    const chunk = '{"surfaceUpdate": {"surfaceId": "main", "components": []}}\n{"dataModelUpdate": {"surfaceId": "m';
    const results = p.parseChunk(chunk);
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('surfaceUpdate');
    expect(p.getPendingBuffer()).toContain('{"dataModelUpdate"');
  });

  it('should flush pending buffer', () => {
    const p = new A2UIParser();
    p.parseChunk('{"beginRendering": {"surfaceId": "main", "root": "root"}}');
    const result = p.flush();
    expect(result).not.toBeNull();
    expect(result!.type).toBe('beginRendering');
  });

  it('should parse standard protocol example - profile card stream', () => {
    const stream = [
      '{"surfaceUpdate": {"surfaceId": "main", "components": [{"id": "root", "component": {"Column": {"children": {"explicitList": ["profile_card"]}}}}]}}',
      '{"surfaceUpdate": {"surfaceId": "main", "components": [{"id": "profile_card", "component": {"Card": {"child": "card_content"}}}]}}',
      '{"surfaceUpdate": {"surfaceId": "main", "components": [{"id": "card_content", "component": {"Column": {"children": {"explicitList": ["header_row", "bio_text"]}}}}]}}',
      '{"surfaceUpdate": {"surfaceId": "main", "components": [{"id": "header_row", "component": {"Row": {"alignment": "center", "children": {"explicitList": ["avatar", "name_column"]}}}}]}}',
      '{"surfaceUpdate": {"surfaceId": "main", "components": [{"id": "avatar", "component": {"Image": {"url": {"literalString": "https://example.com/profile.jpg"}}}}]}}',
      '{"dataModelUpdate": {"surfaceId": "main", "contents": []}}',
      '{"beginRendering": {"surfaceId": "main", "root": "root"}}',
    ];

    const p = new A2UIParser();
    const results: any[] = [];
    for (const line of stream) {
      results.push(p.parseLine(line));
    }

    expect(results.filter((r) => r.type === 'error')).toHaveLength(0);
    expect(results.filter((r) => r.type === 'surfaceUpdate')).toHaveLength(5);
    expect(results.filter((r) => r.type === 'dataModelUpdate')).toHaveLength(1);
    expect(results.filter((r) => r.type === 'beginRendering')).toHaveLength(1);
  });
});
