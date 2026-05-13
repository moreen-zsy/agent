import { runAgentStream } from './a2ui-agent/src/engine/agent.ts';

async function main() {
  const stream = runAgentStream({
    messages: [{ role: 'user', content: '介绍一下古典鸡尾酒' }],
    appType: 'food',
    forwardedProps: {},
  });

  for await (const event of stream) {
    if (event.type === 'ACTIVITY_SNAPSHOT') {
      const ops = (event as any).content?.a2ui_operations || [];
      for (const op of ops) {
        if (op.updateComponents) {
          console.log('[UI]', op.updateComponents.surfaceId, op.updateComponents.components?.length, 'components');
        }
        if (op.updateDataModel) {
          const data = op.updateDataModel.data;
          console.log('[DATA] keys:', Object.keys(data));
          if (data.dishes) console.log('[DATA] dishes:', data.dishes.length);
          if (data.dish) console.log('[DATA] dish:', data.dish.name);
        }
      }
    }
  }
}

main().catch(console.error);
