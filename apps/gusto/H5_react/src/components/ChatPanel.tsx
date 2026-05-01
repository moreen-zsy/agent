/**
 * 点餐 Chat 面板
 * 复用 campus-web 的 ChatPanel，固定为 food 模式
 */

import { ChatPanel as CampusChatPanel } from '../../../campus-web/src/components/ChatPanel.js';

export function ChatPanel() {
  return <CampusChatPanel appType="food" />;
}
