import { describe, it, expect } from 'vitest';
import { TreeBuilder } from '../src/tree-builder.js';
import type { ComponentDef } from '../src/types.js';

function makeComp(id: string, type: string, props: Record<string, any> = {}): ComponentDef {
  return { id, component: { [type]: props } };
}

describe('TreeBuilder', () => {
  it('should build simple tree', () => {
    const components = new Map<string, ComponentDef>([
      ['root', makeComp('root', 'Column', { children: { explicitList: ['title', 'btn'] } })],
      ['title', makeComp('title', 'Text', { text: { literalString: 'Hello' } })],
      ['btn', makeComp('btn', 'Button', { child: 'btn_text' })],
      ['btn_text', makeComp('btn_text', 'Text', { text: { literalString: 'Click' } })],
    ]);

    const tree = TreeBuilder.build(components, 'root');
    expect(tree).not.toBeNull();
    expect(tree!.type).toBe('Column');
    expect(tree!.children).toHaveLength(2);
    expect(tree!.children[0].type).toBe('Text');
    expect(tree!.children[1].type).toBe('Button');
    expect(tree!.children[1].children).toHaveLength(1);
    expect(tree!.children[1].children[0].type).toBe('Text');
  });

  it('should build Card tree', () => {
    const components = new Map<string, ComponentDef>([
      ['root', makeComp('root', 'Card', { child: 'content' })],
      ['content', makeComp('content', 'Column', { children: { explicitList: ['title'] } })],
      ['title', makeComp('title', 'Text', { text: { literalString: 'Card Title' } })],
    ]);

    const tree = TreeBuilder.build(components, 'root');
    expect(tree).not.toBeNull();
    expect(tree!.type).toBe('Card');
    expect(tree!.children).toHaveLength(1);
    expect(tree!.children[0].type).toBe('Column');
  });

  it('should build Row tree', () => {
    const components = new Map<string, ComponentDef>([
      ['root', makeComp('root', 'Row', { children: { explicitList: ['a', 'b'] }, alignment: 'center' })],
      ['a', makeComp('a', 'Text', { text: { literalString: 'A' } })],
      ['b', makeComp('b', 'Text', { text: { literalString: 'B' } })],
    ]);

    const tree = TreeBuilder.build(components, 'root');
    expect(tree).not.toBeNull();
    expect(tree!.type).toBe('Row');
    expect(tree!.children).toHaveLength(2);
  });

  it('should handle missing component gracefully', () => {
    const components = new Map<string, ComponentDef>([
      ['root', makeComp('root', 'Column', { children: { explicitList: ['missing'] } })],
    ]);

    const tree = TreeBuilder.build(components, 'root');
    expect(tree).not.toBeNull();
    expect(tree!.children).toHaveLength(0);
  });

  it('should detect circular references', () => {
    const components = new Map<string, ComponentDef>([
      ['a', makeComp('a', 'Column', { children: { explicitList: ['b'] } })],
      ['b', makeComp('b', 'Column', { children: { explicitList: ['a'] } })],
    ]);

    const tree = TreeBuilder.build(components, 'a');
    expect(tree).not.toBeNull();
    expect(tree!.children).toHaveLength(1);
    expect(tree!.children[0].id).toBe('b');
    // 'b' 的子 'a' 应该被检测到循环引用，不展开
    expect(tree!.children[0].children).toHaveLength(0);
  });

  it('should respect max depth', () => {
    const components = new Map<string, ComponentDef>();
    for (let i = 0; i < 10; i++) {
      components.set(`node${i}`, makeComp(`node${i}`, 'Column', { children: { explicitList: [`node${i + 1}`] } }));
    }

    // maxDepth 为 5，应该截断
    const tree = TreeBuilder.build(components, 'node0', { maxDepth: 5 });
    expect(tree).not.toBeNull();
  });

  it('should handle Tabs children', () => {
    const components = new Map<string, ComponentDef>([
      ['root', makeComp('root', 'Tabs', { tabItems: [{ title: 'Tab 1', child: 'tab1' }, { title: 'Tab 2', child: 'tab2' }] })],
      ['tab1', makeComp('tab1', 'Text', { text: { literalString: 'Content 1' } })],
      ['tab2', makeComp('tab2', 'Text', { text: { literalString: 'Content 2' } })],
    ]);

    const tree = TreeBuilder.build(components, 'root');
    expect(tree).not.toBeNull();
    expect(tree!.children).toHaveLength(2);
  });

  it('should handle Modal children', () => {
    const components = new Map<string, ComponentDef>([
      ['root', makeComp('root', 'Modal', { entryPointChild: 'trigger', contentChild: 'dialog' })],
      ['trigger', makeComp('trigger', 'Button', { child: 'trigger_text' })],
      ['trigger_text', makeComp('trigger_text', 'Text', { text: { literalString: 'Open' } })],
      ['dialog', makeComp('dialog', 'Text', { text: { literalString: 'Dialog Content' } })],
    ]);

    const tree = TreeBuilder.build(components, 'root');
    expect(tree).not.toBeNull();
    expect(tree!.children).toHaveLength(2);
  });
});
