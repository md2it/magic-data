---
title: Extending the LLM engine · Magic-data
---

> [documentation](/documentation) / [developers](/documentation/developers) / [llm-engine](/documentation/developers/llm-engine) / [extending](/documentation/developers/llm-engine/extending)

# Extending the LLM engine

Use [implementation](/documentation/developers/llm-engine/implementation) to add an action, prompt, or capability.

## Add an action

1. **Describe the action declaratively.** Define its prompt template, default agent, and required context.
2. **Place a trigger in the interface.** Pass the relevant context when it is clicked.
3. **Customize per call if needed.** Override the agent, add extra instructions, or supply extra context for specific situations.

Use a minimal action to verify that a local agent responds. It needs no data context or side effects.

## Add or revise a prompt

Define the prompt template and its context in the action configuration. Require context without which the action cannot run; use optional parameters for values a user may adjust for one run.
