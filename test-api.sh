#!/bin/bash
# 测试 Agent SSE 接口

curl -s -N -X POST http://localhost:3000/api/agent/stream \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{
    "messages": [{"id":"msg-1","role":"user","content":"有什么好吃的"}],
    "forwardedProps": {"appType":"food"},
    "tools": [{
      "name": "render_a2ui",
      "description": "Render a dynamic A2UI v0.9 surface with structured parameters. Follow the A2UI render tool usage guide provided in context.",
      "parameters": {
        "type": "object",
        "properties": {
          "surfaceId": {"type":"string","description":"Unique surface identifier."},
          "catalogId": {"type":"string","description":"The catalog ID for the component catalog."},
          "components": {"type":"array","description":"A2UI v0.9 component array (flat format). The root component must have id root.","items":{"type":"object"}},
          "data": {"type":"object","description":"Initial data model for the surface."}
        },
        "required": ["surfaceId","components"]
      }
    }],
    "context": [
      {
        "description": "A2UI Component Schema",
        "value": "{\"catalogId\":\"https://a2ui.org/specification/v0_9/basic_catalog.json\",\"components\":{\"Text\":{\"description\":\"文本组件\"},\"Column\":{\"description\":\"垂直布局\"},\"Row\":{\"description\":\"水平布局\"},\"List\":{\"description\":\"列表\"},\"Card\":{\"description\":\"卡片\"},\"Button\":{\"description\":\"按钮组件\"},\"Image\":{\"description\":\"图片组件\"}}}"
      },
      {
        "description": "A2UI render tool usage guide",
        "value": "## How to call render_a2ui\n\nYou MUST provide ALL required arguments:\n- surfaceId (string, required): Unique ID for the surface.\n- components (array, required): A2UI v0.9 component array (flat format). The root component must have id root.\n- catalogId (string): The catalog ID.\n- data (object): Initial data model for the surface."
      }
    ]
  }' | while read line; do
  echo "$line"
done
