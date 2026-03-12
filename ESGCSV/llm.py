# ingestion/llm.py
# ──────────────────────────────────────────────────────────────────────────────
# Lightweight LLM adapter for ingestion scripts.
# Supports Anthropic and Ollama (local) using the same interface.
#
# Env:
#   LLM_PROVIDER=anthropic|ollama
#   ANTHROPIC_API_KEY, ANTHROPIC_MODEL
#   OLLAMA_BASE_URL, OLLAMA_MODEL
# ──────────────────────────────────────────────────────────────────────────────

from __future__ import annotations
import json
import os
from dataclasses import dataclass

import requests

try:
    import anthropic
except Exception:  # pragma: no cover - anthropic is optional when using Ollama
    anthropic = None


DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5-20251001"
DEFAULT_OLLAMA_MODEL = "llama3"
DEFAULT_OLLAMA_BASE = "http://localhost:11434"
DEFAULT_OLLAMA_TIMEOUT = 180


@dataclass
class LLMClient:
    provider: str
    anthropic_client: object | None = None
    anthropic_model: str | None = None
    ollama_base_url: str | None = None
    ollama_model: str | None = None
    ollama_timeout: int | None = None

    @classmethod
    def from_env(cls) -> "LLMClient":
        provider_env = os.environ.get("LLM_PROVIDER")
        provider = provider_env.strip().lower() if provider_env else ""
        anthropic_key = (os.environ.get("ANTHROPIC_API_KEY") or "").strip()
        anthropic_key_valid = anthropic_key and anthropic_key != "your-anthropic-api-key-here"

        if not provider:
            if anthropic_key_valid:
                provider = "anthropic"
            elif os.environ.get("OLLAMA_MODEL") or os.environ.get("OLLAMA_BASE_URL"):
                provider = "ollama"
            else:
                provider = "anthropic"

        if provider == "anthropic":
            if anthropic is None:
                raise RuntimeError("anthropic package not installed. pip install -r requirements.txt")
            api_key = os.environ.get("ANTHROPIC_API_KEY")
            if not api_key or api_key.strip() == "your-anthropic-api-key-here":
                raise RuntimeError("ANTHROPIC_API_KEY is not set.")
            model = os.environ.get("ANTHROPIC_MODEL", DEFAULT_ANTHROPIC_MODEL)
            return cls(
                provider="anthropic",
                anthropic_client=anthropic.Anthropic(api_key=api_key),
                anthropic_model=model,
            )

        if provider == "ollama":
            base_url = os.environ.get("OLLAMA_BASE_URL", DEFAULT_OLLAMA_BASE).rstrip("/")
            model = os.environ.get("OLLAMA_MODEL", DEFAULT_OLLAMA_MODEL)
            timeout = int(os.environ.get("OLLAMA_TIMEOUT", DEFAULT_OLLAMA_TIMEOUT))
            return cls(
                provider="ollama",
                ollama_base_url=base_url,
                ollama_model=model,
                ollama_timeout=timeout,
            )

        raise RuntimeError("LLM_PROVIDER must be 'anthropic' or 'ollama'")

    def generate(
        self,
        system: str,
        prompt: str,
        max_tokens: int = 120,
        temperature: float | None = None,
    ) -> str:
        if self.provider == "anthropic":
            message = self.anthropic_client.messages.create(
                model=self.anthropic_model,
                max_tokens=max_tokens,
                system=system,
                temperature=temperature,
                messages=[{"role": "user", "content": prompt}],
            )
            return message.content[0].text.strip()

        if self.provider == "ollama":
            url = f"{self.ollama_base_url}/api/chat"
            options: dict[str, object] = {"num_predict": max_tokens}
            if temperature is not None:
                options["temperature"] = temperature
            payload = {
                "model": self.ollama_model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt},
                ],
                "stream": False,
                "options": options,
            }
            response = requests.post(url, json=payload, timeout=self.ollama_timeout or DEFAULT_OLLAMA_TIMEOUT)
            response.raise_for_status()
            data = response.json()
            message = data.get("message", {}).get("content")
            if not message:
                raise RuntimeError(f"Ollama response missing content: {json.dumps(data)[:200]}")
            return str(message).strip()

        raise RuntimeError("Unsupported LLM provider")
