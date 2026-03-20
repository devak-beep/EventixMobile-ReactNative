#!/bin/bash

echo "🎯 Working System Test"
echo "====================="

BASE_URL="http://localhost:3000"
TIMESTAMP=$(date +%s)

echo -e "\n1. User Registration..."
USER_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d '{"name": "Working Test User", "email": "working@test.com", "password": "password123"}' "$BASE_URL/api/users/register")
echo "$USER_RESPONSE" | jq . 2>/dev/null || echo "$USER_RESPONSE"
USER_ID=$(echo "$USER_RESPONSE" | jq -r '.data._id // empty')

echo -e "\n2. Event Creation..."
EVENT_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d '{"name": "Working Test Event", "eventDate": "2026-03-15T18:00:00Z", "totalSeats": 100, "availableSeats": 100, "price": 500}' "$BASE_URL/api/events")
echo "$EVENT_RESPONSE" | jq . 2>/dev/null || echo "$EVENT_RESPONSE"
EVENT_ID=$(echo "$EVENT_RESPONSE" | jq -r '.data._id // empty')

echo -e "\n3. Seat Lock (with idempotencyKey)..."
LOCK_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d "{\"eventId\": \"$EVENT_ID\", \"userId\": \"$USER_ID\", \"seats\": 2, \"idempotencyKey\": \"lock-$TIMESTAMP\"}" "$BASE_URL/api/locks")
echo "$LOCK_RESPONSE" | jq . 2>/dev/null || echo "$LOCK_RESPONSE"
LOCK_ID=$(echo "$LOCK_RESPONSE" | jq -r '.data._id // empty')

echo -e "\n4. Booking Confirmation..."
BOOKING_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d "{\"lockId\": \"$LOCK_ID\"}" "$BASE_URL/api/bookings/confirm")
echo "$BOOKING_RESPONSE" | jq . 2>/dev/null || echo "$BOOKING_RESPONSE"
BOOKING_ID=$(echo "$BOOKING_RESPONSE" | jq -r '.booking._id // empty')

echo -e "\n5. Payment Processing..."
PAYMENT_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d "{\"bookingId\": \"$BOOKING_ID\", \"amount\": 1000, \"force\": \"success\", \"idempotencyKey\": \"payment-$TIMESTAMP\"}" "$BASE_URL/api/payments/intent")
echo "$PAYMENT_RESPONSE" | jq . 2>/dev/null || echo "$PAYMENT_RESPONSE"

echo -e "\n6. Verify Booking Status..."
if [ ! -z "$BOOKING_ID" ]; then
    echo "Checking booking status in database..."
    node -e "
    const mongoose = require('mongoose');
    const Booking = require('./src/models/Booking.model');
    mongoose.connect('mongodb://127.0.0.1:27017/event_booking')
      .then(async () => {
        const booking = await Booking.findById('$BOOKING_ID');
        console.log('Final booking status:', booking?.status);
        console.log('Final booking amount:', booking?.amount);
        process.exit(0);
      })
      .catch(err => {
        console.error('Error:', err.message);
        process.exit(1);
      });
    "
fi

echo -e "\n7. Test Cancellation..."
if [ ! -z "$BOOKING_ID" ]; then
    CANCEL_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d '{"reason": "Test cancellation"}' "$BASE_URL/api/cancellations/$BOOKING_ID/cancel")
    echo "$CANCEL_RESPONSE" | jq . 2>/dev/null || echo "$CANCEL_RESPONSE"
fi

echo -e "\n=== Final Results ==="
echo "✅ User ID: $USER_ID"
echo "✅ Event ID: $EVENT_ID"
echo "✅ Lock ID: $LOCK_ID"
echo "✅ Booking ID: $BOOKING_ID"
echo "✅ Timestamp: $TIMESTAMP"
