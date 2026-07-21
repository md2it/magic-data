---
title: Dependencies and environment · Magic-data
---

> [documentation](/documentation) / [developers](/documentation/developers) / [non-functional-requirements](/documentation/developers/non-functional-requirements) / [dependencies-and-environment](/documentation/developers/non-functional-requirements/dependencies-and-environment)

# Dependencies and environment

- Python 3.9 or later is required.
- `requirements.txt` pins `markdown-it-py` and `mdurl`.
- The launchers create `.venv` and install dependencies on the first run or when `requirements.txt` changes.
- The application runs locally at `http://localhost:57214`.
- macOS, Windows, and Linux launchers are included.
- Codex CLI or Claude CLI is required only for AI actions.
