import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { defineCatalog } from '../src/catalog.js';
import { generatePrompt } from '../src/prompt.js';

describe('Prompt Generation', () => {
  const catalog = defineCatalog({
    catalogId: 'test-prompt',
    components: {
      Text: {
        props: z.object({
          text: z.union([
            z.object({ literalString: z.string() }),
            z.object({ path: z.string() }),
          ]),
        }),
        description: '文本组件',
        events: ['press'],
      },
      Button: {
        props: z.object({
          label: z.union([
            z.object({ literalString: z.string() }),
            z.object({ path: z.string() }),
          ]),
        }),
        description: '按钮组件',
        events: ['press'],
      },
    },
  });

  it('should generate prompt with system message', () => {
    const prompt = generatePrompt(catalog);
    expect(prompt).toContain('UI generation assistant');
    expect(prompt).toContain('A2UI v0.8');
  });

  it('should include component descriptions', () => {
    const prompt = generatePrompt(catalog);
    expect(prompt).toContain('Text');
    expect(prompt).toContain('Button');
    expect(prompt).toContain('文本组件');
    expect(prompt).toContain('按钮组件');
  });

  it('should include message type documentation', () => {
    const prompt = generatePrompt(catalog);
    expect(prompt).toContain('surfaceUpdate');
    expect(prompt).toContain('dataModelUpdate');
    expect(prompt).toContain('beginRendering');
    expect(prompt).toContain('deleteSurface');
  });

  it('should include bound value format', () => {
    const prompt = generatePrompt(catalog);
    expect(prompt).toContain('literalString');
    expect(prompt).toContain('literalNumber');
    expect(prompt).toContain('literalBoolean');
    expect(prompt).toContain('path');
  });

  it('should include example output', () => {
    const prompt = generatePrompt(catalog, { includeExamples: true });
    expect(prompt).toContain('EXAMPLE');
    expect(prompt).toContain('surfaceUpdate');
  });

  it('should skip examples when disabled', () => {
    const prompt = generatePrompt(catalog, { includeExamples: false });
    expect(prompt).not.toContain('EXAMPLE');
  });

  it('should include custom system message', () => {
    const prompt = generatePrompt(catalog, {
      system: 'Custom system message',
    });
    expect(prompt).toContain('Custom system message');
  });

  it('should include custom rules', () => {
    const prompt = generatePrompt(catalog, {
      customRules: ['Always use dark theme', 'Minimize component count'],
    });
    expect(prompt).toContain('Always use dark theme');
    expect(prompt).toContain('Minimize component count');
  });

  it('should support chat mode', () => {
    const prompt = generatePrompt(catalog, { mode: 'chat' });
    expect(prompt).toContain('对话');
    expect(prompt).toContain('JSONL');
  });

  it('should include rules section', () => {
    const prompt = generatePrompt(catalog);
    expect(prompt).toContain('RULES');
    expect(prompt).toContain('每条消息必须且只能包含一个顶层键');
  });
});
