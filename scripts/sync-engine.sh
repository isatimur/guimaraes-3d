#!/usr/bin/env bash
# Port engine updates from braga-3d into this fork, hash-guarded (3-way).
# The logic lives in scripts/sync-engine.mjs; see the header there.
#
#   scripts/sync-engine.sh [--dry-run]   table: file, state (same|behind|ahead|diverged)
#   scripts/sync-engine.sh --apply       copy 'behind' files, write *.conflict for 'diverged'
#   scripts/sync-engine.sh --record      set the base to braga's committed HEAD
set -euo pipefail
exec node "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/sync-engine.mjs" "$@"
