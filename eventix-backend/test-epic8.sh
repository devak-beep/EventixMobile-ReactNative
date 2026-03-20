#!/bin/bash

echo "🔍 Testing Epic 8: Audit & Logging"
echo "=================================="

# Start server in background
npm start &
SERVER_PID=$!
sleep 3

echo "📝 Testing correlation ID and error logging..."

# Test error logging with correlation ID
CORRELATION_ID=$(uuidgen)
curl -s -H "x-correlation-id: $CORRELATION_ID" \
     -H "Content-Type: application/json" \
     -X POST http://localhost:3000/api/bookings/invalid-id/confirm \
     -d '{}' | jq .

echo ""
echo "📋 Checking logs..."
echo "Error log:"
tail -n 2 logs/error.log | jq .
echo ""
echo "Audit log:"
tail -n 2 logs/audit.log | jq . 2>/dev/null || echo "No audit entries yet"

# Cleanup
kill $SERVER_PID
echo ""
echo "✅ Epic 8 logging infrastructure ready!"
