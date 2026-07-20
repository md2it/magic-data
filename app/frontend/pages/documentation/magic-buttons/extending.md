---
title: Extending Magic buttons · Magic-data
---

> [Documentation](../../documentation) / [Magic buttons](../magic-buttons) / Extending Magic buttons

# Extending Magic buttons

This section describes how to add an action, prompt, or new capability using the [technical implementation model](implementation).

## Add an action

1. **Describe the action declaratively.** Define its prompt template, default agent, and required context.
2. **Place a trigger in the interface.** Pass the relevant context when it is clicked.
3. **Customize per call if needed.** Override the agent, add extra instructions, or supply extra context for specific situations.

A minimal example action can be used to confirm that a local agent is reachable and responding. It needs no data context or side effects: it sends a prompt and returns a short message. Real actions extend the same shape.

## Add or revise a prompt

Define the prompt template in the action configuration and specify the context it needs. Use required context for information without which the action must not run; use optional parameters for values that a user may adjust for one invocation.

## Design principles

- **Native and simple for the user.** Hide the terminal, CLI, and prompt. A magic button is just an action that works.
- **One local process.** The engine runs inside the same local application, in keeping with the tool's single-process, no-database design.
- **Cross-platform.** Agents are launched directly, so the same approach works across operating systems.
- **Declarative where it can be, ad hoc where it must be.** Common behavior lives in shared configuration; per-click tweaks live at the call site.
- **Fail clearly.** Missing context, a missing CLI, or a failed run produces an explicit message rather than silent or surprising behavior.
