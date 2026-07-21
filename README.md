# Magic-data

Magic-data is a simple local tool for collecting structured data with the help of AI.

## Launch

Python 3.9 or later must be installed before launching the application. The launcher creates an application-local Python environment and installs the pinned dependencies automatically on its first launch.

- macOS: double-click `macos.command`;
- Windows: double-click `windows.bat`;
- Linux: run `linux.sh` (make it executable first).

After the first launch, the launcher does not run `pip` or access the network. For a fully offline first launch, include the prepared `.venv` directory or the required wheel files with the application.

## Implementation

### Core functionality
- **Data** is stored in JSON files,
- **LLM agents** work with the JSON files,
- **The user** can view and manually manage data and agents through a simple web interface.

### Optional functionality
Codex and Claude can be invoked from the UI via "Magic buttons" (if the user has the corresponding CLI installed).

### User interface

The interface runs locally: it is launched with a single Python script and is available at `localhost`. This allows the tool to be used without a separate server or an external database.

Through the web interface, the user can:

- browse the list of available datasets;
- open a specific dataset as a table or a tree;
- sort data in the table view by column;
- search by substring in the table and tree;
- filter data by attributes available in a specific JSON file;
- manually manage the data.

## Static pages

Pages are stored in `app/frontend/pages`. HTML pages are inserted into the shared layout as-is; Markdown pages are converted to HTML first and receive the standard Markdown stylesheet. The shared layout is stored in `app/frontend/layout/page.html` and adds the standard header and footer to every page.

The file layout determines page URLs: `pages/index.html` is available at `/`, `pages/documentation/index.md` at `/documentation`, `pages/documentation/users/magic-buttons.md` at `/documentation/users/magic-buttons`, and `pages/documentation/developers/ui/index.md` at `/documentation/developers/ui`. Pages can define a title and additional CSS or JavaScript files in their front matter.

```text
---
title: Example · Magic-data
styles:
  - /assets/css/example.css
scripts:
  - /assets/js/example.js
---
```

## License

See the [LICENSE](LICENSE) file.
