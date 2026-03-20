#!/bin/bash

echo "🎯 Complete End-to-End Booking Flow Test"
echo "========================================"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

BASE_URL="http://localhost:3000"
CORRELATION_ID="e2e-test-$(date +%s)"

# Test function
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    echo -e "\n${BLUE}Testing: $description${NC}"
    echo "Endpoint: $method $endpoint"
    if [ ! -z "$data" ]; then
        echo "Data: $data"
    fi
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -H "x-correlation-id: $CORRELATION_ID" "$BASE_URL$endpoint")
    else
        response=$(curl -s -X $method -H "Content-Type: application/json" -H "x-correlation-id: $CORRELATION_ID" -d "$data" "$BASE_URL$endpoint")
    fi
    
    echo "$response" | jq . 2>/dev/null || echo "$response"
    
    # Extract ID from response if it's a creation endpoint
    if [[ "$endpoint" == *"/users/register"* ]]; then
        USER_ID=$(echo "$response" | jq -r '.user._id // .user.id // empty')
    elif [[ "$endpoint" == *"/events"* && "$method" == "POST" ]]; then
        EVENT_ID=$(echo "$response" | jq -r '.event._id // .event.id // empty')
    elif [[ "$endpoint" == *"/locks"* ]]; then
        LOCK_ID=$(echo "$response" | jq -r '.data._id // .lock._id // empty')
    elif [[ "$endpoint" == *"/bookings/confirm"* ]]; then
        BOOKING_ID=$(echo "$response" | jq -r '.booking._id // .booking.id // empty')
    fi
}

echo -e "\n${GREEN}=== STEP 1: Create User ====${NC}"
test_endpoint "POST" "/api/users/register" '{"name": "E2E Test User", "email": "e2e@test.com"}' "User registration"

echo -e "\n${GREEN}=== STEP 2: Create Event ====${NC}"
test_endpoint "POST" "/api/events" '{"name": "E2E Test Event", "eventDate": "2026-03-15T18:00:00Z", "totalSeats": 100, "availableSeats": 100, "price": 500}' "Event creation"

echo -e "\n${GREEN}=== STEP 3: Lock Seats ====${NC}"
test_endpoint "POST" "/api/locks" "{\"eventId\": \"$EVENT_ID\", \"userId\": \"$USER_ID\", \"seats\": 2}" "Seat locking"

echo -e "\n${GREEN}=== STEP 4: Confirm Booking ====${NC}"
test_endpoint "POST" "/api/bookings/confirm" "{\"lockId\": \"$LOCK_ID\"}" "Booking confirmation"

echo -e "\n${GREEN}=== STEP 5: Process Payment ====${NC}"
test_endpoint "POST" "/api/payments/intent" "{\"bookingId\": \"$BOOKING_ID\", \"amount\": 1000, \"force\": \"success\"}" "Payment processing"

echo -e "\n${GREEN}=== STEP 6: Verify Final State ====${NC}"
test_endpoint "GET" "/api/events/$EVENT_ID" "" "Event state verification"

echo -e "\n${GREEN}=== STEP 7: Test Cancellation ====${NC}"
test_endpoint "POST" "/api/cancellations/$BOOKING_ID/cancel" '{"reason": "Test cancellation"}' "Booking cancellation"

echo -e "\n${GREEN}=== STEP 8: Verify Audit Trail ====${NC}"
test_endpoint "GET" "/api/audit?correlationId=$CORRELATION_ID" "" "Audit trail verification"

echo -e "\n${GREEN}=== COMPLETE E2E TEST FINISHED ====${NC}"
echo "User ID: $USER_ID"
echo "Event ID: $EVENT_ID"
echo "Lock ID: $LOCK_ID"
echo "Booking ID: $BOOKING_ID"
echo "Correlation ID: $CORRELATION_ID"
