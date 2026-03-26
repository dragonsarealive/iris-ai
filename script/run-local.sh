#!/usr/bin/env bash
# Run IRIS from this repo using a local config/cache/data dir so it doesn't
# mix with your global IRIS install. Requires: Bun 1.3+
#
# Usage: ./script/run-local.sh [args...]
# Example: ./script/run-local.sh .
# Example: ./script/run-local.sh serve --port 4097

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEV_ROOT="$REPO_ROOT/.iris-dev"

export XDG_DATA_HOME="$DEV_ROOT/share"
export XDG_CONFIG_HOME="$DEV_ROOT/config"
export XDG_CACHE_HOME="$DEV_ROOT/cache"
export XDG_STATE_HOME="$DEV_ROOT/state"

cd "$REPO_ROOT"
exec bun run dev "$@"
