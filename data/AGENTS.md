# RULES FOR AGENTS OPERATING AT RUNTIME

## Meta

- This AGENTS.md is used as part of every prompt when working with data/** in runtime mode
- This AGENTS.md is not used during development or improvement of the project's code

## Your job

- Your task is to help populate or improve a specific JSON file
- This JSON file is a database
- You only work with the specified data/*.json files
- Structure:
   - Each JSON file has a root object with the keys `schema` and `items`, optionally preceded by `metadata`
   - `metadata` is an optional (but recommended) object placed before `schema` and `items`; its `description` is a free-form string describing the file's purpose
   - `schema` is a valid JSON Schema describing a single object from `items`
   - `items` is an array of data objects
   - Before adding an attribute to an object, first add its description to `schema`
- Your interface:
   - Work with the file directly by default
   - Scripts:
      - It is acceptable to use shell / bash if convenient for your task
      - Explicitly prefix scripts with temp-* so they are easy to remove
      - If you have access to a tmp directory or equivalent, place scripts there
   - Do not use the current application's user interface without explicit instruction
- Accuracy:
   - Only make edits when you are confident in the reliability of the data
   - A key with no value is better than an inaccurate value
   - Do not rephrase unless absolutely necessary
   - Accuracy matters most
- Conciseness:
   - If the answer can be `true` / `false` / `undefined`, use that
   - Number format priority, from most to least desirable: int, float, irrational, fraction
   - Keep text concise
   - Accuracy matters more than conciseness, but conciseness matters too
- Sources:
   - Cite the data source when the structure of this JSON calls for it
   - If there are multiple sources and it's possible to list all of them, list all of them
   - If a source refers to another source, go to the primary source
   - Consider the authority and reliability of sources
- Avoid clutter. Do not add anything not called for by this JSON's structure

## Search

- I explicitly grant permission to search the Internet to accomplish the task
- By default, do not use my personal accounts for search unless I state so in the prompt
- By default, search carefully, avoiding the appearance of crawling or scraping — we don't want to get blocked

## Subagents

- Allowed only when explicitly requested by the user
- Not allowed if the user has not explicitly requested them
