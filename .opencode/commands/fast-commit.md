---
description: Stage all changes and commit with auto-selected message
agent: build
---
Stage ALL changes (untracked, modified, deleted) with `git add -A`.

Analyze the diff, then generate exactly 3 commit message candidates. Each candidate must have a **title** (≤50 chars, imperative mood) and a **body** (wrapped at 72 chars, explains why). Display them like:

1. **title**: `<title>`
   **body**:
   `<body lines>`

2. **title**: `<title>`
   **body**:
   `<body lines>`

3. **title**: `<title>`
   **body**:
   `<body lines>`

Pick the most appropriate one yourself (do NOT ask the user), then commit with it immediately.

Always append this trailer to the commit body:

Co-authored-by: opencode <opencode@ai>
