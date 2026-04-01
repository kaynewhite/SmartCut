#!/bin/bash
# Start both server and client
cd /home/runner/workspace/server && node index.js &
cd /home/runner/workspace/client && npx vite --host 0.0.0.0 --port 5000
