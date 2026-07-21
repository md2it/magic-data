---
title: Magic buttons · Magic-data
---

> [documentation](/documentation) / [users](/documentation/users) / [magic-buttons](/documentation/users/magic-buttons)

# Magic buttons

Magic buttons run an AI-assisted action from the interface. Select an action to receive its result without using a terminal or writing a prompt.

Install the Codex or Claude CLI to use Magic buttons.

## Magic log

Every Magic run is recorded in the persistent Magic log. Open **Magic log** in the header to view runs from the current application session and archived runs from earlier sessions.

The three counters next to **Magic log** in the header show only runs from the current session: in progress, successful, and unsuccessful. Archived runs are intentionally excluded from these counters.

The log is stored locally in `.user/magic-log.jsonl`. Its file and the `.user/` directory are created automatically when the first Magic run is recorded. There is intentionally no delete button in the interface. If you physically delete `.user/magic-log.jsonl`, the application creates a new log automatically when the next Magic run starts.
