#!/bin/sh
# Runs `npm run gates` before a commit, merge or push lands on main, so main
# cannot go red silently (it did on 12 and 16 October, docs/reports/2026-10-17-rigour-audit.md).
# Other branches pass straight through; their gates are the slice's (RUNBOOK §5.3).
# Wired by `git config core.hooksPath .githooks`. Skip only on the owner's word: --no-verify.
branch=$(git symbolic-ref --short HEAD 2>/dev/null)
[ "$1" = "push" ] && branch=main # a push carries main to the public snapshot
[ "$branch" = "main" ] || exit 0
echo "[gates hook] npm run gates on main, before this lands..."
# git exports these to a hook; tests that build throwaway repos would inherit them and use this repo's index (19 Oct)
unset GIT_INDEX_FILE GIT_DIR GIT_WORK_TREE GIT_PREFIX GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES
npm run gates --silent > .git/gates-hook.log 2>&1
status=$?
if [ $status -ne 0 ]; then
  tail -20 .git/gates-hook.log
  echo "[gates hook] RED: npm run gates failed; nothing landed. Full log: .git/gates-hook.log"
  exit 1
fi
echo "[gates hook] green"
