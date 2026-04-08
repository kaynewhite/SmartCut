#!/bin/bash
# Start MongoDB and ensure it's running

echo "Starting MongoDB..."
mkdir -p /tmp/mongodb-data
mongod --dbpath /tmp/mongodb-data --fork --logpath /tmp/mongodb.log

sleep 3

# Check if running
if pgrep -x "mongod" > /dev/null; then
  echo "✓ MongoDB started successfully"
  echo "Database: smartcut"
  echo "Connection: mongodb://127.0.0.1:27017/smartcut"
else
  echo "✗ Failed to start MongoDB"
  tail -20 /tmp/mongodb.log
  exit 1
fi
