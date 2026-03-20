#!/bin/bash

echo "🎯 Manual System Verification"
echo "============================="

BASE_URL="http://localhost:3000"

echo -e "\n1. Testing User Registration (with password)..."
USER_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d '{"name": "Test User", "email": "test@example.com", "password": "password123"}' "$BASE_URL/api/users/register")
echo "$USER_RESPONSE" | jq . 2>/dev/null || echo "$USER_RESPONSE"
USER_ID=$(echo "$USER_RESPONSE" | jq -r '.user._id // empty')

echo -e "\n2. Testing Event Creation..."
EVENT_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d '{"name": "Test Event", "eventDate": "2026-03-15T18:00:00Z", "totalSeats": 100, "availableSeats": 100, "price": 500}' "$BASE_URL/api/events")
echo "$EVENT_RESPONSE" | jq . 2>/dev/null || echo "$EVENT_RESPONSE"
EVENT_ID=$(echo "$EVENT_RESPONSE" | jq -r '.data._id // empty')

echo -e "\n3. Testing Seat Lock..."
LOCK_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d "{\"eventId\": \"$EVENT_ID\", \"userId\": \"$USER_ID\", \"seats\": 2}" "$BASE_URL/api/locks")
echo "$LOCK_RESPONSE" | jq . 2>/dev/null || echo "$LOCK_RESPONSE"
LOCK_ID=$(echo "$LOCK_RESPONSE" | jq -r '.data._id // empty')

echo -e "\n4. Testing Booking Confirmation..."
BOOKING_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d "{\"lockId\": \"$LOCK_ID\"}" "$BASE_URL/api/bookings/confirm")
echo "$BOOKING_RESPONSE" | jq . 2>/dev/null || echo "$BOOKING_RESPONSE"
BOOKING_ID=$(echo "$BOOKING_RESPONSE" | jq -r '.booking._id // empty')

echo -e "\n5. Testing Payment Processing..."
PAYMENT_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d "{\"bookingId\": \"$BOOKING_ID\", \"amount\": 1000, \"force\": \"success\", \"idempotencyKey\": \"test-$(date +%s)\"}" "$BASE_URL/api/payments/intent")
echo "$PAYMENT_RESPONSE" | jq . 2>/dev/null || echo "$PAYMENT_RESPONSE"

echo -e "\n6. Testing Health Check..."
HEALTH_RESPONSE=$(curl -s "$BASE_URL/health")
echo "$HEALTH_RESPONSE"

echo -e "\n7. Testing Reports..."
REPORTS_RESPONSE=$(curl -s "$BASE_URL/api/reports/booking-summary")
echo "$REPORTS_RESPONSE" | jq . 2>/dev/null || echo "$REPORTS_RESPONSE"

echo -e "\n=== Test Results ==="
echo "User ID: $USER_ID"
echo "Event ID: $EVENT_ID"
echo "Lock ID: $LOCK_ID"
echo "Booking ID: $BOOKING_ID"
