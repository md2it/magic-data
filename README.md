# Magic-data

Magic-data is a simple local tool for collecting structured data with the help of AI.

## Implementation

### Core functionality
- **Data** is stored in JSON files,
- **LLM agents** work with the JSON files,
- **The user** can view and manually manage data and agents through a simple web interface.

### Optional functionality
Codex and Claude can be invoked from the UI via "Magic buttons" (if the user has the corresponding CLI installed).

## Local interface

The interface runs locally: it is launched with a single Python script and is available at `localhost`. This allows the tool to be used without a separate server or an external database.

Through the web interface, the user can:

- browse the list of available datasets;
- open a specific dataset as a table or a tree;
- sort data in the table view by column;
- search by substring in the table and tree;
- filter data by attributes available in a specific JSON file;
- manually manage the data.

## License

See the [LICENSE](LICENSE) file.
