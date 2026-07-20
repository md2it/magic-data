---
title: Help · Magic-data
---

# Help

Magic-data is a simple local tool for collecting structured data with the help of AI.

## Getting started

Python 3.9 or later must be installed before launching the application. On the first launch, the launcher creates an application-local Python environment and installs the pinned dependencies automatically.

- macOS: double-click `macos.command`.
- Windows: double-click `windows.bat`.
- Linux: run `linux.sh` after making it executable.

After the first launch, the launcher does not run `pip` or access the network. For a fully offline first launch, include the prepared `.venv` directory or the required wheel files with the application.

## Working with data

Data is stored in JSON files. LLM agents work with these JSON files, and you can view and manually manage the data and agents through the web interface.

The interface runs locally at `localhost`. It does not require a separate server or an external database.

Through the interface, you can:

- browse the list of available datasets;
- open a dataset as a table or a tree;
- sort data in the table view by column;
- search by substring in the table and tree;
- filter data by attributes available in a specific JSON file;
- manually manage the data.

## Magic buttons

Magic buttons let you invoke an AI agent from the interface:

- **Create a new document** — the agent helps configure its schema.
- **Fill a document** — the agent searches for data on the web and fills the document.

To use Magic buttons, install a CLI for Codex or Claude. A CLI is a program that runs from the command line and lets Magic-data invoke the corresponding agent on your computer.

- [Install Codex CLI](https://developers.openai.com/codex/cli/)
- [Install Claude Code](https://code.claude.com/docs/en/getting-started)
