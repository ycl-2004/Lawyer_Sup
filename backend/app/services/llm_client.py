"""LLM 客户端：OpenAI 兼容接口（DeepSeek 首选 / Qwen 备选），默认 mock 模式。

环境变量：
  LLM_PROVIDER  mock（默认）| deepseek | qwen | openai-compatible
  LLM_BASE_URL  如 https://api.deepseek.com
  LLM_API_KEY
  LLM_MODEL     如 deepseek-chat

换 provider 只改环境变量，业务代码不变（计划 §11.1）。
"""
from __future__ import annotations

import json
import os
from typing import Any


class LLMClient:
    def __init__(self) -> None:
        self.provider = os.getenv("LLM_PROVIDER", "mock")
        self.base_url = os.getenv("LLM_BASE_URL", "https://api.deepseek.com")
        self.api_key = os.getenv("LLM_API_KEY", "")
        self.model = os.getenv("LLM_MODEL", "deepseek-chat")

    @property
    def is_mock(self) -> bool:
        return self.provider == "mock" or not self.api_key

    def chat_json(
        self,
        system: str,
        user: str,
        mock_response: dict[str, Any] | None = None,
        temperature: float = 0.0,
    ) -> dict[str, Any]:
        """请求 LLM 并强制 JSON 输出；mock 模式直接返回预置响应。"""
        if self.is_mock:
            return mock_response if mock_response is not None else {}

        # 延迟导入：mock 模式不需要 openai 包
        from openai import OpenAI

        client = OpenAI(base_url=self.base_url, api_key=self.api_key)
        resp = client.chat.completions.create(
            model=self.model,
            temperature=temperature,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        )
        content = resp.choices[0].message.content or "{}"
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            # 不猜测：解析失败按空结果处理并由上层标记 needs_review
            return {"error": "llm_output_not_json", "raw": content[:2000]}


llm = LLMClient()
