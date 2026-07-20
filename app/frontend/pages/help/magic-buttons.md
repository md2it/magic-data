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
invocation. Several kinds of customization are possible:

- **Pin an agent (optional).** By default an action does not choose an agent at
  all — selection is automatic (see below). A button may still pin a specific
  agent when that is deliberately wanted.
- **Call-site context (automatic).** The interface passes in where the action
  was launched from, without the user doing anything. For example, an action
  triggered from inside a document supplies that document's location and name,
  so the prompt can be about exactly the data the user is looking at.
- **Optional parameters (only for some actions).** An action may declare a few
  optional fields. When it does, a small form appears before the run so the user
  can adjust the request; when it does not, there is no form and the click runs
  immediately. Left empty, the fields fall back to sensible defaults, so the
  form is a convenience, never an obstacle.
- **Extra instructions.** Free-form text can be appended for this one run,
  without changing the shared definition.

Level 2 always layers on top of Level 1: the declarative definition provides the
defaults and the shape, and the call fills in or overrides the specifics. The
automatic call-site context and the optional parameters both become part of the
context that the prompt is built from.

## Prompt assembly

The prompt template contains placeholders that are filled from the provided
context — which includes the call-site information and any optional parameters.
If a required piece of context is missing, the run is stopped before an agent is
ever launched: a missing required input is treated as an error, not guessed.
Optional values that were not supplied simply resolve to empty. Each run also
gets its own session marker so repeated runs stay independent.

## Choosing an agent automatically

The user should not have to think about which agent runs an action. By default,
selection is automatic and resilient.

Selection is described declaratively as an ordered list of options — a
*cascade*. Each option is an agent together with, optionally, a specific model
and effort level. When an action runs, the engine tries the first option; if it
fails for any reason — the CLI is missing, there is no connection, a model is
unavailable or deprecated, a limit is hit, the run errors or times out — the
engine moves on to the next option. The first option that succeeds provides the
result; the user simply gets an answer.

Two ideas keep this robust:

- **Degrade from specific to general.** Within one agent, the cascade goes from a
  precise model down to that agent's default. A renamed or retired model just
  falls through to the next option instead of breaking the action.
- **Then fall back across agents.** The automatic cascade tries one agent's whole
  chain, then the next agent's. Only if every option fails does the user see an
  error, and then it explains what was tried.

The set of options lives in configuration, so cascades can be reordered, or new
agents and models added, without touching application logic. A button may still
pin a single agent or a single option when that is intended; pinning simply uses
a shorter cascade.

At least one of the configured CLIs must be installed for magic buttons to work.
If none is available, the action fails with a clear message rather than doing
anything unexpected.

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
