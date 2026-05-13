async function callAgent(message: string, history: any[] = [], token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch('http://localhost:3000/api/agent/stream', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      messages: [...history, { role: 'user', content: message }],
      appType: 'food',
    }),
  });

  const text = await res.text();
  const lines = text.split('\n').filter(l => l.trim().startsWith('data:'));

  const tools: string[] = [];
  let surfaceId = '';
  let components: string[] = [];
  let dataKeys: string[] = [];
  let dishCount = 0;
  let orderCount = 0;
  let textContent = '';

  for (const line of lines) {
    try {
      const event = JSON.parse(line.slice(5).trim());
      if (event.type === 'TOOL_CALL_START') tools.push(event.toolCallName);
      if (event.type === 'TEXT_MESSAGE_CONTENT') textContent += event.delta;
      if (event.type === 'ACTIVITY_SNAPSHOT') {
        const ops = event.content?.a2ui_operations || [];
        for (const op of ops) {
          if (op.createSurface) surfaceId = op.createSurface.surfaceId;
          if (op.updateComponents) {
            components = (op.updateComponents.components || []).map((c: any) => c.component);
          }
          if (op.updateDataModel) {
            dataKeys = Object.keys(op.updateDataModel.data);
            if (op.updateDataModel.data.dishes) dishCount = op.updateDataModel.data.dishes.length;
            if (op.updateDataModel.data.orders) orderCount = op.updateDataModel.data.orders.length;
          }
        }
      }
    } catch {}
  }

  return { tools, surfaceId, components, dataKeys, dishCount, orderCount, textContent: textContent.slice(0, 100) };
}

async function main() {
  console.log('=== 测试 1: 浏览菜单 ===');
  const r1 = await callAgent('有什么好吃的');
  console.log(`  工具: [${r1.tools.join(', ')}]`);
  console.log(`  Surface: ${r1.surfaceId}, 组件: [${r1.components.join(', ')}]`);
  console.log(`  数据键: [${r1.dataKeys.join(', ')}], 菜品数: ${r1.dishCount}`);
  console.log(`  结果: ${r1.dishCount >= 10 ? '✅ 通过' : '❌ 失败'}`);

  console.log('\n=== 测试 2: 搜索特定菜品 ===');
  const r2 = await callAgent('介绍一下古典鸡尾酒');
  console.log(`  工具: [${r2.tools.join(', ')}]`);
  console.log(`  Surface: ${r2.surfaceId}, 组件: [${r2.components.join(', ')}]`);
  console.log(`  数据键: [${r2.dataKeys.join(', ')}]`);
  console.log(`  结果: ${r2.components.includes('DishDetail') ? '✅ 通过' : '❌ 失败'}`);

  console.log('\n=== 测试 3: 多轮对话 - 先订单后菜单 ===');
  const r3a = await callAgent('查看我的订单');
  console.log(`  第1轮(订单) 工具: [${r3a.tools.join(', ')}], Surface: ${r3a.surfaceId}`);
  const history = [
    { role: 'user', content: '查看我的订单' },
    { role: 'assistant', content: r3a.textContent },
  ];
  const r3b = await callAgent('浏览菜单', history);
  console.log(`  第2轮(菜单) 工具: [${r3b.tools.join(', ')}], Surface: ${r3b.surfaceId}`);
  console.log(`  结果: ${r3b.surfaceId.includes('menu') && r3b.dishCount >= 10 ? '✅ 通过' : '❌ 失败'}`);

  console.log('\n=== 测试 4: 多轮对话 - 先菜单后搜索菜品 ===');
  const r4a = await callAgent('有什么好吃的');
  const history4 = [
    { role: 'user', content: '有什么好吃的' },
    { role: 'assistant', content: r4a.textContent },
  ];
  const r4b = await callAgent('介绍一下和牛芝士汉堡', history4);
  console.log(`  第1轮(菜单) 工具: [${r4a.tools.join(', ')}]`);
  console.log(`  第2轮(搜索) 工具: [${r4b.tools.join(', ')}], Surface: ${r4b.surfaceId}, 组件: [${r4b.components.join(', ')}]`);
  console.log(`  结果: ${r4b.components.includes('DishDetail') ? '✅ 通过' : '❌ 失败'}`);
}

main().catch(console.error);
