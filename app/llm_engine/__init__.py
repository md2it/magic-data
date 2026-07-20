"""Magic-data local LLM engine.

Loads YAML scenarios, renders prompts and runs them through a local CLI
provider (Codex or Claude). See ``app/llm-scenarios/*.yaml`` for scenarios and
``config.yaml`` for global defaults.
"""

from llm_engine.config import load_config
from llm_engine.providers import (
    SUPPORTED_PROVIDERS,
    ProviderError,
    resolve_steps,
    run_cascade,
    run_provider,
)
from llm_engine.scenarios import load_scenario, render_prompt

__all__ = [
    "load_config",
    "load_scenario",
    "render_prompt",
    "run_provider",
    "resolve_steps",
    "run_cascade",
    "ProviderError",
    "SUPPORTED_PROVIDERS",
]
