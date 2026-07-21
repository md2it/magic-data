---
title: Working with data · Magic-data
---

> [documentation](/documentation) / [users](/documentation/users) / [working-with-data](/documentation/users/working-with-data)

# Working with data

Data is stored in JSON files. Manage data and agents through the web interface.

The interface runs locally at `localhost`. It does not require a separate server or an external database.

You can:

- browse the list of available datasets;
- open a dataset as a table or a tree;
- sort data in the table view by column;
- search by substring in the table and tree;
- filter data by attributes available in a specific JSON file;
- manually manage the data.

## Archiving and deletion

The interface intentionally does not provide an option to delete a document. To remove a document from active work while preserving it, move it to the default `data/_archive` folder.

The `data/_archive` folder itself is tracked and indexed by Git, while its contents are ignored. If a document must be permanently removed from the filesystem, delete it through the file tree.

To use AI-assisted actions, see [magic-buttons](/documentation/users/magic-buttons).
