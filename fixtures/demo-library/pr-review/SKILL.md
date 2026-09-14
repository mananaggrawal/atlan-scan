---
name: pr-review
description: Review a pull request for correctness and missing tests. Use when the user asks for a code review on a diff or a PR.
allowed-tools: Bash(git diff:*), Bash(gh pr view:*), Read, Grep
---
# PR review

Walk the diff hunk by hunk. Flag behaviour changes with no test. Do not restate what the diff already says.
