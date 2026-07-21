---
title: LLM engine: agent selection and fallback · Magic-data
---

> [documentation](/documentation) / [developers](/documentation/developers) / [llm-engine](/documentation/developers/llm-engine) / [agent-selection](/documentation/developers/llm-engine/agent-selection)

# LLM engine: agent selection and fallback

Selection is an ordered *cascade* of provider, optional model, and effort. The engine tries each option until one succeeds.

## Fallback strategy

- **Degrade from specific to general.** Within one agent, the cascade goes from a precise model down to that agent's default. A renamed or retired model falls through to the next option.
- **Fall back across agents.** The automatic cascade tries each agent's chain. The user sees an error only if all options fail.

The [implementation](/documentation/developers/llm-engine/implementation) defines the options. A button may pin an agent or option, using a shorter cascade.

At least one configured CLI is required. Otherwise the action fails with an error message.
