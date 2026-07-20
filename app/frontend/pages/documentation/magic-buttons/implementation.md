---
title: Magic buttons: technical implementation · Magic-data
---

> [Documentation](../../documentation) / [Magic buttons](../magic-buttons) / Technical implementation

# Technical implementation

The behavior of a Magic button is defined on two levels. This keeps common, reusable behavior declarative and shared, while one-off adjustments stay at the point of the click.

## Execution flow

Every Magic button follows the same technical process:

1. **Trigger.** The user clicks an action in the interface.
2. **Prepare the request.** The application combines a prompt template with the context of the current action and any one-off instructions.
3. **Run a local agent.** The finished request is sent to a local AI CLI in an isolated session.
4. **Return the result.** The answer is shown to the user or applied to the data, depending on the action.

The agent works locally and can access the project when the action requires it; no external server or database is needed.

## Declarative configuration

Reusable behavior is described in configuration, not in code. There are two kinds:

- **Per-action configuration.** Each action has its own definition: the prompt template, a human-readable label, which agent or cascade it selects by default, and which pieces of context it requires or accepts.
- **Global defaults.** Shared settings that apply to every action, such as the default selection (a single agent or a cascade), time limits, and how each CLI is invoked.

Because this level is declarative and version-controlled, actions are easy to review, copy, and adjust without changing application logic.

## Per-call customization

At the moment of the click, an action can be tailored for that single invocation:

- **Pin an agent (optional).** By default an action does not choose an agent — selection is automatic. A button may still pin a specific agent when deliberately required.
- **Call-site context (automatic).** The interface passes in where the action was launched from. For example, an action triggered from a document supplies that document's location and name.
- **Optional parameters.** An action may declare fields that a person can adjust before the run. Empty fields fall back to sensible defaults.
- **Extra instructions.** Free-form text can be appended for one run without changing the shared definition.

Per-call customization layers on top of the declarative definition. The automatic call-site context and optional parameters become part of the context used to build the prompt.

## Prompt assembly

The prompt template contains placeholders filled from the provided context. If a required piece of context is missing, the run stops before an agent is launched. Optional values that were not supplied resolve to empty. Each run also gets its own session marker so repeated runs stay independent.

For the fallback mechanism used when an agent cannot run, see [Agent selection and fallback](agent-selection).
