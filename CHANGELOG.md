# Changelog

## 1.0.0 (2023-XXXXX) (UNRELEASED)

This is a very breaking release and you are encouraged to scrap your existing
Sin databases.

-  BREAKING: Database schema has vastly changed.
-  BREAKING: License category is no longer stated by ScanCode, so it only uses
   specific license accepts now.
-  BREAKING: `sin.ts audit` now returns non-zero upon findings.
-  ScanCode has been updated to 32.0.8.

## 0.0.6 (2022-01-21)

-  Remove nonsensical print after running accept/unaccept commands.

## 0.0.5 (2021-12-09)

-  Don't run `audit` as part of a scan. This is a separate command and should
   be run separately.

## 0.0.4 (2021-12-08)

Initial release.
