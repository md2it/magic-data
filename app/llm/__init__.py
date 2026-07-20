"""Magic-data local LLM engine.

Loads YAML scenarios, renders prompts and runs them through a local CLI
provider (Codex or Claude). See ``app/llm-scenarios/*.yaml`` for scenarios and
``config.yaml`` for global defaults.
"""

from llm.config import load_config
from llm.providers import SUPPORTED_PROVIDERS, ProviderError, run_provider
from llm.scenarios import load_scenario, render_prompt

__all__ = [
    "load_config",
    "load_scenario",
    "render_prompt",
    "run_provider",
    "ProviderError",
    "SUPPORTED_PROVIDERS",
]
