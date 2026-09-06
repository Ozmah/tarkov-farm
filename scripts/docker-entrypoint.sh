#!/bin/sh
set -eu

if [ "$(id -u)" = "0" ]; then
	chown -R tarkov:tarkov /hideout
	exec gosu tarkov "$@"
fi

exec "$@"
