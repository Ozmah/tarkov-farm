#!/bin/sh
set -eu

if [ "$(id -u)" = "0" ]; then
	chown -R tarkov:tarkov /data
	exec gosu tarkov "$@"
fi

exec "$@"
