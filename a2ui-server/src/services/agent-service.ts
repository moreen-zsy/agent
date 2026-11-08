import { runAgentStream } from "@a2ui/agent";
import type { AgentInput } from "@a2ui/agent";
import type { BaseEvent } from "@ag-ui/core";

/**
 * Agent 流服务
 * 将 AGUI RunAgentInput 转发给 Agent 引擎
 *
 * 迁移自 `a2ui-server/src/services/agent-service.ts`
 */
export async function* streamAgent(input: AgentInput): AsyncGenerator<BaseEvent> {
  yield* runAgentStream(input);
}
