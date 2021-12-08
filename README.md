# Sin

![release](https://img.shields.io/badge/release-0.0.4-green)
![coverage](https://img.shields.io/badge/coverage-86%25-green)

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

Sin has been tested on a codebase with over 300k files:

-  Initial scan: ~6 hours.
-  Subsequent scans: ~10 minutes (assuming that not many files have changed).

Docker images available on Docker Hub:

-  https://hub.docker.com/repository/docker/khueue/sin

# Usage

## Prerequisites

-  Docker.
-  Everything you wish to scan, with all dependencies installed.

## Input to Sin

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

```
mkdir -p ./data/db
mkdir -p ./data/src
mkdir -p ./data/tmp
```

Then run a container with Sin:

```
docker run --interactive --tty --rm --init \
   --mount type="bind",source="$(PWD)/data/db",target="/data/db",consistency="delegated" \
   --mount type="bind",source="$(PWD)/data/src",target="/data/src",readonly \
   --mount type="bind",source="$(PWD)/data/tmp",target="/data/tmp",consistency="delegated" \
   khueue/sin:0.0.4
```

The above command will place you inside a bash shell, allowing you to run
the tool, `sin.ts`:

```
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

## Tips

-  The bulk of the scan time is spent running ScanCode. Give as many CPUs
   as you can to Docker, since ScanCode is very good at saturating every
   available CPU.
