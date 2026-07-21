---
title: Getting started with the LLM engine · Magic-data
---

> [documentation](/documentation) / [developers](/documentation/developers) / [llm-engine](/documentation/developers/llm-engine) / [getting-started](/documentation/developers/llm-engine/getting-started)

# Getting started with the LLM engine

The LLM engine runs AI-assisted actions locally. UI controls provide context and start a run; provider logic and prompt assembly stay in the engine.

## Design principles

- **Native and simple for the user.** Hide the terminal, CLI, and prompt.
- **One local process.** Run the engine in the application process; do not add a database.
- **Cross-platform.** Agents are launched directly, so the same approach works across operating systems.
- **Declarative where it can be, ad hoc where it must be.** Common behavior lives in shared configuration; per-call tweaks live at the call site.
- **Fail clearly.** Missing context, a missing CLI, or a failed run produces an explicit message rather than silent or surprising behavior.

## Architecture at a glance

1. A caller selects a scenario and supplies the context of the current task.
2. The scenario defines the prompt template, UI metadata, and required or optional context in `app/llm-scenarios/`.
3. The engine validates the context and renders the prompt. Per-call instructions apply to that run only.
4. Global configuration in `app/llm_engine/config.yaml` resolves the requested provider, profile, or fallback cascade.
5. A provider adapter runs the selected local CLI. The run registry tracks its status and result.

Keep responsibilities separate: scenarios describe an action; configuration selects its execution; provider adapters run a CLI; the UI starts a run and shows its status or result.

## Where to start

For a new action, add or revise a scenario, then connect a UI trigger that supplies its context. Change global configuration only for a new selection or execution policy; add a provider adapter only for a new CLI.

See [implementation](/documentation/developers/llm-engine/implementation) and [extending](/documentation/developers/llm-engine/extending).
