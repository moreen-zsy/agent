async function testAgent(message: string, history: any[] = []) {
  const res = await fetch('http://localhost:3000/api/agent/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [...history, { role: 'user', content: message }],
      appType: 'food',
      forwardedProps: {
        appType: 'food',
        conversationHistory: history,
      }
    })
  });

  const text = await res.text();
  const lines = text.split('\n').filter(l => l.trim());

  // Extract key events
  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      if (event.type === 'TOOL_CALL_START') {
        console.log(`[TOOL_CALL] ${event.toolCallName}`);
      }
      if (event.type === 'TOOL_CALL_ARGS') {
        console.log(`[ARGS] ${event.delta}`);
      }
      if (event.type === 'ACTIVITY_SNAPSHOT') {
        const ops = event.content?.a2ui_operations || [];
        for (const op of ops) {
          if (op.updateComponents) {
            console.log(`[UI] surfaceId: ${op.updateComponents.surfaceId}, components: ${op.updateComponents.components?.length || 0}`);
            const comps = op.updateComponents.components;
            for (const c of comps) {
              console.log(`  - ${c.component}${c.id ? ` (id: ${c.id})` : ''}`);
            }
          }
          if (op.updateDataModel) {
            const data = op.updateDataModel.data;
            console.log(`[DATA] keys: ${Object.keys(data).join(', ')}`);
          }
        }
      }
      if (event.type === 'TEXT_MESSAGE_CONTENT') {
        process.stdout.write(event.delta);
      }
    } catch {
      // ignore
    }
  }
  console.log('\n--- done ---\n');
  return lines;
}

async function main() {
  console.log('=== Test 1: 介绍古典鸡尾酒 ===');
  await testAgent('介绍一下古典鸡尾酒');

  console.log('=== Test 2: 查看我的订单 ===');
  const h1 = await testAgent('查看我的订单');

  // Build history for next turn
  const history = [
    { role: 'user', content: '查看我的订单' },
    { role: 'assistant', content: '为您查看订单列表' },
  ];

  console.log('=== Test 3: 浏览菜单 (after orders) ===');
  await testAgent('浏览菜单', history);
}

main().catch(console.error);
