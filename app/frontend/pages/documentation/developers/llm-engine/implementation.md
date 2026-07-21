---
title: LLM engine: technical implementation · Magic-data
---

> [documentation](/documentation) / [developers](/documentation/developers) / [llm-engine](/documentation/developers/llm-engine) / [implementation](/documentation/developers/llm-engine/implementation)

# LLM engine: technical implementation

The engine uses shared declarative configuration and per-call customization.

## Execution flow

Each action follows this process:

1. **Trigger.** The user clicks an action in the interface.
2. **Prepare the request.** The application combines the prompt template, context, and per-call instructions.
3. **Run a local agent.** The finished request is sent to a local AI CLI in an isolated session.
4. **Return the result.** The answer is shown to the user or applied to the data, depending on the action.

The agent runs locally and can access the project when required; no external server or database is used.

## Declarative configuration

Configuration, not code, defines reusable behavior:

- **Per-action configuration.** Each action has its own definition: the prompt template, a human-readable label, which agent or cascade it selects by default, and which pieces of context it requires or accepts.
- **Global defaults.** Shared settings that apply to every action, such as the default selection (a single agent or a cascade), time limits, and how each CLI is invoked.

## Per-call customization

An action can be tailored for one run:

- **Pin an agent (optional).** By default an action does not choose an agent — selection is automatic. A button may still pin a specific agent when deliberately required.
- **Call-site context (automatic).** The interface passes in where the action was launched from. For example, an action triggered from a document supplies that document's location and name.
- **Optional parameters.** An action may declare fields that a person can adjust before the run. Empty fields fall back to sensible defaults.
- **Extra instructions.** Free-form text can be appended for one run without changing the shared definition.

## Prompt assembly

The prompt template uses context placeholders. Missing required context stops the run; missing optional values are empty. Each run has a separate session marker.

See [agent-selection](/documentation/developers/llm-engine/agent-selection).
