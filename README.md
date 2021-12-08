# Sin

Sin (**s**ource **in**ventory) collects license information from all input files
using [ScanCode](https://github.com/nexB/scancode-toolkit) and saves the
results to a local database for further analysis.

Features:

-  **Incremental processing** - Saves state in a local SQLite database to
   make sure to only process new/moved/modified files, which greatly speeds up
   subsequent scans. Suitable for CI/CD.
-  **Tool for manual investigation** - CLI tool to show suspicious files
   and "accept" them to the database, either using global rules or specific
   exceptions.
-  **Simple database** - Manages a simple SQLite database that can be easily
   browsed or consumed by other tools.
