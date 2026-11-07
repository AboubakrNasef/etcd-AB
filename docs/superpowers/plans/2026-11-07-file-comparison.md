# File comparison implementation plan

**Goal:** Compare two decoded files in a separate view with added, removed, changed, and unchanged records and before/after values.
**Architecture:** Pure record comparison in the browser; a React component selects two decoded results. Compare from configuration decodes selected files before opening the view. Inspection remains available.
**Tech stack:** Existing React, TypeScript, Zustand; Node test runner.

- [x] Add comparison tests for index alignment, stable object equality, duplicate records, database revision alignment, missing and changed records.
- [x] Implement comparison helper ignoring positional record numbers, preserving duplicates, matching WAL entries by index and database history by revision/subrevision/key.
- [x] Add ComparePanel with result selectors, counts, status filtering, and field-level before/after values.
- [x] Wire Compare action and Inspect/Compare navigation; clear comparison when selection changes.
- [x] Run comparison tests, TypeScript, production build, and diff checks.
