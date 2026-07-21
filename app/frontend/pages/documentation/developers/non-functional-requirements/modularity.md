---
title: Modularity · Magic-data
---

> [documentation](/documentation) / [developers](/documentation/developers) / [non-functional-requirements](/documentation/developers/non-functional-requirements) / [modularity](/documentation/developers/non-functional-requirements/modularity)

# Modularity

Build the system from small, independent, replaceable parts, each with one goal.

## One goal per module

- Each distinct goal is realized by its own module. Do not combine unrelated
  goals in one module.
- A module is of the minimum size that fully satisfies its goal. Remove
  anything not required by that goal.
- When a module comes to serve more than one goal, split it. When two modules
  serve the same goal, merge them.
- The goal of a module must be stateable in one sentence. If it cannot be, the
  module is doing too much.

## Independence

- A module depends only on the explicit, declared interfaces of other modules,
  never on their internals, file layout, or incidental behavior.
- Minimize both the number and the breadth of a module's dependencies. Prefer
  zero dependencies where the goal allows it.
- Communication happens through declared interfaces. Do not couple modules
  through shared mutable global state or assumptions about structure a module
  does not own.
- A module must be understandable, and its correctness verifiable, without
  reading the internals of any other module.

## Replaceability

- A module must be replaceable by any alternative that honors the same
  interface, with no change to its consumers.
- Keep the public interface narrow, stable, and explicit. Everything else is
  internal and may change freely.
- No consumer may depend on undocumented behavior, internal names, or
  side effects of a module.
- A module must be removable when its goal is dropped, without leaving
  fragments in shared files or requiring edits scattered across the system.

## Portability

- A module carries everything it needs to fulfill its goal and makes no
  assumption about its host beyond its declared interface.
- A module owns its own assets — its styles, resources, and internal state —
  and must not deposit them into shared or host-owned files.
- A module must be movable into another context by supplying only its declared
  configuration. Lifting it must not require untangling it from the host.
- Anything host-specific is supplied at the boundary as configuration. Do not
  hardcode host-specific values, names, or structure inside a module.

## Integration surface

- The host connects a module through the smallest possible surface — ideally a
  single entry point.
- Host code contains no logic that belongs to the module. Integration is
  wiring and configuration only.
- Adding, removing, or replacing a module changes the host in as few places as
  possible. A change whose integration cost grows with the size of the host
  indicates a boundary in the wrong place.

## Robustness of boundaries

- The absence, failure, or misconfiguration of a module must not break the
  host beyond the module's own goal.
- A module validates its own inputs at its boundary and does not rely on
  callers to protect it.
- Prefer failing safely and locally over propagating a fault across a boundary.

## Quality gate

A change satisfies these requirements only when: each goal lives in one
minimal module; every dependency is explicit and narrow; the module could be
replaced or removed without touching consumers' internals; the module carries
its own assets and could be moved elsewhere with only its declared
configuration; and the host is wired to it through a minimal surface that
contains none of its logic.
