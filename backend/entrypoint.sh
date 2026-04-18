#!/bin/sh
# DrillBit Backend Entrypoint
# 1. Seeds permanent users (admin + any configured users) on first run
# 2. Starts Uvicorn

echo "[Entrypoint] Seeding database users..."
python /app/seed_users.py

echo "[Entrypoint] Starting Uvicorn..."
exec uvicorn main:app --host 0.0.0.0 --port 8000
