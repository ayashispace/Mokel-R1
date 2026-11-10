#!/bin/zsh
set -eu
cd -- "${0:A:h}"
if ! command -v node >/dev/null 2>&1; then
  print 'Install Node.js 22.13 or later from https://nodejs.org, then reopen this launcher.'
  read '?Press Return to close.'
  exit 1
fi
exec node companion.mjs
