#!/bin/sh
set -e

echo "Running migrations..."
uv run manage.py migrate --noinput

echo "Starting server..."
exec uv run daphne -b 0.0.0.0 -p 8000 config.asgi:application
