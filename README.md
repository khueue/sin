# Sin

![release](https://img.shields.io/badge/release-1.0.0-green)
![coverage](https://img.shields.io/badge/coverage-91%25-green)

_Keep track of sinful license usage._

Sin (**s**ource **in**ventory) collects **license information** from all input
files using [ScanCode](https://github.com/nexB/scancode-toolkit) and saves the
results to a local database for incremental updates and further analysis. Sin
helps you keep track of the licenses that your dependencies use, to make sure
that you're not using anything unacceptable.

Features:

-  **Incremental processing** - Maintains a local SQLite database to
   make sure to only process new/moved/modified files, which greatly speeds up
   subsequent scans. Suitable for CI/CD.
-  **Tool for investigation** - CLI tool to show suspicious files
   and "accept" them to the database, either using global rules or specific
   exceptions.
-  **Simple database** - Manages a simple SQLite database that can be easily
   browsed or consumed by other tools.

Sin has been tested on a multi-repo codebase with over 300k files:

-  Initial scan: ~6 hours.
-  Subsequent scans: ~10 minutes (assuming that not many files have changed).

Docker images available on Docker Hub:

-  https://hub.docker.com/repository/docker/khueue/sin


# Usage

## Prerequisites

-  Docker.
-  Everything you wish to scan, with all dependencies installed.

## Input to Sin

Sin runs in a docker container, and uses the following directories:

-  `/data/src`. Sin assumes that this dir contains all files that you wish to
   scan, **including installed dependencies**. Make sure everything is
   installed and available in this dir. Can be mounted read-only. You could
   organize your files like this:
   -  `/data/src/repo1`
   -  `/data/src/repo2`
   -  etc.
-  `/data/db`. Sin will maintain a file called `db.sqlite` in this dir. It will
   be created if it does not exist. It's a good idea to keep this file backed
   up, since the point is to use it over time.
-  `/data/tmp` _(optional)_. Sin creates a timestamped workspace inside this dir
   every time it's invoked, where all temporary files and reports are stored.
   Mount this folder if you wish to expose these files to your host (useful
   for debugging etc.).

## Example

Make sure the dirs to be mounted exist on the host:

```bash
# For the sake of the example, we create this. In a real world scenario, this
# might be the (existing) root of your source code.
mkdir -p ./sin-data/src

# Database will be stored here.
mkdir -p ./sin-data/db

# All temp files will be stored here.
mkdir -p ./sin-data/tmp
```

Then run a container with Sin:

```bash
docker run --interactive --tty --rm --init \
   --mount type="bind",source="$(PWD)/sin-data/db",target="/data/db",consistency="delegated" \
   --mount type="bind",source="$(PWD)/sin-data/tmp",target="/data/tmp",consistency="delegated" \
   --mount type="bind",source="$(PWD)/sin-data/src",target="/data/src",readonly \
   khueue/sin:1.0.0-beta
```

The above command will place you inside a bash shell, allowing you to run
the tool, `sin.ts`:

```bash
$ sin.ts
Usage: sin.ts [options] [command]

Collects license information from all input files using ScanCode
and saves the results to a local database for further analysis

Options:
  -h, --help                 display help for command

Commands:
  scan [options] [pattern]   Scan input and update database with license findings
  audit [options]            Generate report of suspicious files
  view <file_path>           View contents of a file
  accepted [options]         Generate report of all manually accepted files
  accept <pattern> <reason>  Mark suspicious files as accepted
  unaccept <pattern>         Un-mark previously accepted files so they appear suspicious again
  licenses                   Manage globally allowed licenses (applied on every audit)
  help [command]             display help for command
```

## Limitations

-  There is currently no ARM support (because ScanCode does not support it).

## Tips

-  The bulk of the scan time is spent running ScanCode. Give as many CPUs
   as you can to Docker, since ScanCode is very good at saturating every
   available CPU.

# Auditing

The `sin.ts audit` tool gathers a report according to the following:

-  Fetch all files (from the database) that **might mention** licenses in
   any way:
   -  When a license file is found (e.g. `LICENSE`), and it mentions
      **only accepted** licenses, then that whole folder (including subfolders)
      is excluded.  The idea is: "this project seems to have an okay license,
      allow it."
   -  When a non-license file is found, and it mentions **only accepted**
      licenses, exclude it.
-  The remainder is a set of files that needs looking into.

## Automatic Acceptance

XXX Wrong since 1.0.0:

The engine is configured to accept licenses using two settings:

-  By name, allowing specific licenses such as "Ruby License".

These acceptances are stored in the database, applied on-the-fly on every
`sin.ts audit`, and managed by `sin.ts licenses`. This means that it's
simple to go back and forth with accepting and unaccepting licenses and then
re-auditing as needed.

Refer to "Key" in:

-  https://scancode-licensedb.aboutcode.org/

## Manual Acceptance

When rules are not enough, we need to inspect individual projects and files,
and take decisions from there. For these situations, files can be marked as
"accepted" using the `sin.ts accept` tool.

Marking as "accepted" essentially sets a flag in the database for a particular
file, omitting it from future audits. Important to know is that if a file
that has been marked as accepted _changes_, that flag will be removed so that
the file can start showing up in reports again. It is possible to revert
accepts by running `sin.ts unaccept`.
