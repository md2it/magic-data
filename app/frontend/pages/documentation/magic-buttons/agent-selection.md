---
title: Magic buttons: agent selection and fallback · Magic-data
---

> [Documentation](../../documentation) / [Magic buttons](../magic-buttons) / Agent selection and fallback

# Agent selection and fallback

By default, an action selects an agent automatically and resiliently.

Selection is described declaratively as an ordered list of options — a *cascade*. Each option is an agent together with, optionally, a specific model and effort level. When an action runs, the engine tries the first option; if it fails, it moves on to the next option. The first successful option provides the result.

## Fallback strategy

- **Degrade from specific to general.** Within one agent, the cascade goes from a precise model down to that agent's default. A renamed or retired model falls through to the next option.
- **Fall back across agents.** The automatic cascade tries one agent's whole chain, then the next agent's. Only if every option fails does the user see an error, explaining what was tried.

The options live in [technical configuration](implementation), so cascades can be reordered and new agents or models added without changing application logic. A button may still pin a single agent or option; pinning uses a shorter cascade.

At least one configured CLI must be installed for Magic buttons to work. If none is available, the action fails with a clear message.
