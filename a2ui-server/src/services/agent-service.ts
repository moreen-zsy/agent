/**
 * Agent 流服务
 * 将 AGUI RunAgentInput 转发给 Agent 引擎
 */

import { runAgentStream } from '@a2ui/agent';
import type { AgentInput } from '@a2ui/agent';
import type { BaseEvent } from '@ag-ui/core';

export async function* streamAgent(input: AgentInput): AsyncGenerator<BaseEvent> {
  yield* runAgentStream(input);
}
