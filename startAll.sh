#!/bin/bash

set -e

LOG_DIR="logs"

echo "Creating logs directory..."
mkdir -p $LOG_DIR

echo "Freeing required ports..."

PORTS=(5432 6379 3001 5173)

for PORT in "${PORTS[@]}"; do
  echo "Checking port $PORT..."

  PIDS=$(sudo ss -lptn "sport = :$PORT" | awk 'NR>1 {gsub(/pid=/,"",$6); gsub(/,.*/,"",$6); print $6}' | sort -u)

  if [ -n "$PIDS" ]; then
    for PID in $PIDS; do
      echo "Killing process on port $PORT (PID: $PID)"
      sudo kill -9 $PID || true
    done
  else
    echo "Port $PORT is already free"
  fi
done

echo "Stopping local PostgreSQL service (if running)..."
sudo systemctl stop postgresql 2>/dev/null || true

echo "Removing old Docker containers (if any)..."

docker rm -f alumniconnect_pg 2>/dev/null || true
docker rm -f alumniconnect_redis 2>/dev/null || true

echo "Starting fresh Docker containers..."

echo "Starting PostgreSQL..."
docker run --name alumniconnect_pg \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  -d postgres:15

echo "Starting Redis..."
docker run --name alumniconnect_redis \
  -p 6379:6379 \
  -d redis:7

echo "Waiting for PostgreSQL to initialize..."
for i in {1..30}; do
  if docker exec alumniconnect_pg pg_isready -U postgres >/dev/null 2>&1; then
    echo "PostgreSQL is ready!"
    break
  fi
  echo "Waiting..."
  sleep 1
done

echo "Starting backend..."

cd backend
echo "Synchronizing Prisma schema..."
npx prisma db push --accept-data-loss
npx prisma generate

echo "Seeding Admin user and Test Data..."
npx ts-node seed_admin.ts

echo "Booting backend server..."
export NO_COLOR=1
export FORCE_COLOR=0
npm run dev > ../$LOG_DIR/backend.log 2>&1 &
BACKEND_PID=$!

echo "Starting frontend..."

cd ../frontend
npm run dev > ../$LOG_DIR/frontend.log 2>&1 &
FRONTEND_PID=$!

cd ..

echo "All services started!"
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo "Logs:"
echo "  Backend  $LOG_DIR/backend.log"
echo "  Frontend  $LOG_DIR/frontend.log"

wait