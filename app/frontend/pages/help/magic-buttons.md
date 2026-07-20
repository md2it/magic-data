---
title: Magic buttons · Magic-data
---

# Magic buttons

Magic buttons let a person trigger an AI agent from the interface with a single
click. The person does not need to know that, behind the click, a prompt is
assembled and a local AI CLI is launched in a terminal. They press a button,
wait briefly, and see a result. This page explains the principles and the flow,
not the exact names of files, buttons, or code.

## The idea

Useful AI actions should feel native and effortless. Instead of asking the user
to open a terminal, write a prompt, and copy the answer back, the interface
offers a ready action in the place where it makes sense. The machinery stays
hidden: assembling the prompt, choosing an agent, running it, and returning the
result are all handled for the user.

## The flow

Every magic button follows the same path:

1. **Trigger.** The user clicks an action somewhere in the interface.
2. **Assemble the prompt.** A predefined prompt template is combined with the
   context of the current action (for example, which piece of data is being
   worked on) and any last-minute customization.
3. **Run a local agent.** The finished prompt is sent to a local AI CLI, which
   runs in a fresh, isolated session so one run never leaks into another.
4. **Return the result.** The agent's plain-text answer comes back and is shown
   to the user, or applied to the data, depending on the action.

Nothing here depends on an external server or database. The agent runs locally
and is given access to the project so it can read or change the data when the
action calls for it.

## Two levels of configuration

The behavior of a magic button is defined on two levels. This split is the core
design decision: keep the common, reusable behavior declarative and shared, and
keep one-off adjustments at the point of the click.

### Level 1 — declarative configuration

Reusable behavior is described in configuration, not in code. There are two
kinds:

- **Per-action configuration.** Each action has its own definition: the prompt
  template, a human-readable label, which agent it uses by default, and which
  pieces of context it requires or accepts. One definition describes one task.
- **Global defaults.** Shared settings that apply to every action, such as the
  default agent, time limits, and how each CLI is invoked.

Because this level is declarative and version-controlled, actions are easy to
review, copy, and adjust without touching application logic.

### Level 2 — per-call customization

At the moment of the click, an action can be tailored for that single
invocation. Three kinds of customization are possible:

- **Choose the agent.** The same action can be run through a different local
  agent than its default.
- **Provide context.** The interface passes in what the action is operating on,
  so the prompt can be about the right data.
- **Add extra instructions.** Free-form text can be appended for this one run,
  without changing the shared definition.

Level 2 always layers on top of Level 1: the declarative definition provides the
defaults and the shape, and the call fills in or overrides the specifics.

## Prompt assembly

The prompt template contains placeholders that are filled from the provided
context. If a required piece of context is missing, the run is stopped before an
agent is ever launched — a missing input is treated as an error, not guessed.
Each run also gets its own session marker so repeated runs stay independent.

## Agents are interchangeable

The system talks to more than one local AI CLI. Any supported agent can run any
action, which is why the same task can be sent to one agent or another. Support
for a new agent means teaching the system how to invoke that CLI; the actions
themselves do not change.

To use magic buttons at all, the corresponding CLI must be installed on the
machine. If it is missing, the action fails with a clear message instead of
doing anything unexpected.

## How to add a new magic action

Adding an action is meant to follow the two levels above:

1. **Describe the action declaratively** — write its prompt template, its
   default agent, and the context it needs.
2. **Place a trigger in the interface** where the action is useful, and have it
   pass the relevant context when clicked.
3. **Customize per call if needed** — override the agent, add extra
   instructions, or supply extra context for specific situations.

A minimal example action exists purely to confirm that a local agent is
reachable and responding. It is the simplest possible case: no data context, no
side effects, just a prompt in and a short message out. New, real actions extend
from the same shape.

## Design principles

- **Native and simple for the user.** Hide the terminal, the CLI, and the
  prompt. A magic button is just an action that works.
- **One local process.** The engine runs inside the same local application, in
  keeping with the tool's single-process, no-database design.
- **Cross-platform.** Agents are launched directly, so the same approach works
  across operating systems.
- **Declarative where it can be, ad hoc where it must be.** Common behavior
  lives in shared configuration; per-click tweaks live at the call site.
- **Fail clearly.** Missing context, a missing CLI, or a failed run produces an
  explicit message rather than silent or surprising behavior.
