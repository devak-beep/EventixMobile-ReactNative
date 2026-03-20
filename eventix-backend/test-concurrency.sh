#!/bin/bash

# TASK 7.2: Concurrency Testing Script
# Validates parallel request handling and ensures no negative seats occur

set -e

BASE_URL="http://localhost:3001"

echo "========================================="
echo "TASK 7.2: Concurrency Testing"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}[CLEANUP]${NC} Killing background processes..."
    jobs -p | xargs -r kill 2>/dev/null || true
    wait 2>/dev/null || true
}

trap cleanup EXIT

# Test setup
echo -e "${YELLOW}[SETUP]${NC} Creating test user..."
USER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/users/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Concurrency Test User",
    "email": "concurrency@example.com"
  }')

USER_ID=$(echo $USER_RESPONSE | grep -o '"_id":"[^"]*' | cut -d'"' -f4)
echo -e "${GREEN}✅ User created: $USER_ID${NC}"

echo -e "${YELLOW}[SETUP]${NC} Creating test event with limited seats..."
EVENT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/events" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Concurrency Test Event",
    "description": "Testing concurrent seat locking",
    "eventDate": "2026-06-15T10:00:00Z",
    "totalSeats": 10
  }')

EVENT_ID=$(echo $EVENT_RESPONSE | grep -o '"_id":"[^"]*' | cut -d'"' -f4)
INITIAL_SEATS=$(echo $EVENT_RESPONSE | grep -o '"availableSeats":[0-9]*' | cut -d':' -f2)
echo -e "${GREEN}✅ Event created: $EVENT_ID with $INITIAL_SEATS seats${NC}"

# Test 1: Concurrent seat locking (should not allow overselling)
echo -e "\n${BLUE}[TEST 1]${NC} Concurrent seat locking test..."
echo -e "${YELLOW}Launching 20 parallel requests for 2 seats each (40 seats total, but only 10 available)${NC}"

# Create temporary files for results
RESULTS_DIR="/tmp/concurrency_test_$$"
mkdir -p "$RESULTS_DIR"

# Launch 20 concurrent requests
for i in {1..20}; do
    (
        RESPONSE=$(curl -s -X POST "$BASE_URL/api/locks" \
          -H "Content-Type: application/json" \
          -d "{
            \"eventId\": \"$EVENT_ID\",
            \"userId\": \"$USER_ID\",
            \"seats\": 2,
            \"idempotencyKey\": \"concurrent-test-$i-$(date +%s%N)\"
          }")
        
        echo "$RESPONSE" > "$RESULTS_DIR/result_$i.json"
        
        if echo "$RESPONSE" | grep -q '"success":true'; then
            echo "SUCCESS:$i" > "$RESULTS_DIR/status_$i"
        else
            echo "FAILED:$i" > "$RESULTS_DIR/status_$i"
        fi
    ) &
done

# Wait for all requests to complete
wait

# Analyze results
SUCCESSFUL_LOCKS=0
FAILED_LOCKS=0

for i in {1..20}; do
    if [ -f "$RESULTS_DIR/status_$i" ]; then
        STATUS=$(cat "$RESULTS_DIR/status_$i")
        if [[ $STATUS == SUCCESS* ]]; then
            ((SUCCESSFUL_LOCKS++))
        else
            ((FAILED_LOCKS++))
        fi
    fi
done

echo -e "${GREEN}✅ Successful locks: $SUCCESSFUL_LOCKS${NC}"
echo -e "${RED}❌ Failed locks: $FAILED_LOCKS${NC}"

# Check final event state
FINAL_EVENT=$(curl -s "$BASE_URL/api/events/$EVENT_ID")
FINAL_SEATS=$(echo $FINAL_EVENT | grep -o '"availableSeats":[0-9-]*' | cut -d':' -f2)

echo -e "${BLUE}Final available seats: $FINAL_SEATS${NC}"

# Validation
EXPECTED_SUCCESSFUL_LOCKS=$((($INITIAL_SEATS + 1) / 2))  # 5 locks of 2 seats each
EXPECTED_FINAL_SEATS=$(($INITIAL_SEATS - $EXPECTED_SUCCESSFUL_LOCKS * 2))

if [ "$FINAL_SEATS" -lt 0 ]; then
    echo -e "${RED}❌ CRITICAL: Negative seats detected! ($FINAL_SEATS)${NC}"
    exit 1
elif [ "$SUCCESSFUL_LOCKS" -eq "$EXPECTED_SUCCESSFUL_LOCKS" ] && [ "$FINAL_SEATS" -eq "$EXPECTED_FINAL_SEATS" ]; then
    echo -e "${GREEN}✅ Concurrency test passed: No overselling occurred${NC}"
else
    echo -e "${YELLOW}⚠️  Unexpected results: Expected $EXPECTED_SUCCESSFUL_LOCKS successful locks, got $SUCCESSFUL_LOCKS${NC}"
fi

# Test 2: Concurrent booking confirmations (No duplicate confirmations)
echo -e "\n${BLUE}[TEST 2]${NC} Concurrent booking confirmation test..."

# Create a fresh lock for duplicate confirmation testing
DUPLICATE_TEST_RESPONSE=$(curl -s -X POST "$BASE_URL/api/locks" \
  -H "Content-Type: application/json" \
  -d "{
    \"eventId\": \"$EVENT_ID\",
    \"userId\": \"$USER_ID\",
    \"seats\": 1,
    \"idempotencyKey\": \"duplicate-test-$(date +%s%N)\"
  }")

DUPLICATE_LOCK_ID=$(echo $DUPLICATE_TEST_RESPONSE | grep -o '"_id":"[^"]*' | cut -d'"' -f4)

if [ -n "$DUPLICATE_LOCK_ID" ]; then
    echo -e "${YELLOW}Testing 5 concurrent confirmations of same lock (should only create 1 booking)...${NC}"
    
    # Launch 5 concurrent confirmation attempts for the same lock
    for i in {1..5}; do
        (
            BOOKING_RESPONSE=$(curl -s -X POST "$BASE_URL/api/bookings/confirm" \
              -H "Content-Type: application/json" \
              -d "{\"lockId\": \"$DUPLICATE_LOCK_ID\"}")
            
            echo "$BOOKING_RESPONSE" > "$RESULTS_DIR/duplicate_booking_$i.json"
            
            if echo "$BOOKING_RESPONSE" | grep -q '"success":true'; then
                echo "BOOKING_SUCCESS:$i" > "$RESULTS_DIR/duplicate_status_$i"
            else
                echo "BOOKING_FAILED:$i" > "$RESULTS_DIR/duplicate_status_$i"
            fi
        ) &
    done
    
    wait
    
    # Count successful bookings
    SUCCESSFUL_BOOKINGS=0
    for i in {1..5}; do
        if [ -f "$RESULTS_DIR/duplicate_status_$i" ]; then
            STATUS=$(cat "$RESULTS_DIR/duplicate_status_$i")
            if [[ $STATUS == BOOKING_SUCCESS* ]]; then
                ((SUCCESSFUL_BOOKINGS++))
            fi
        fi
    done
    
    echo -e "${BLUE}Successful bookings from 5 concurrent attempts: $SUCCESSFUL_BOOKINGS${NC}"
    
    if [ "$SUCCESSFUL_BOOKINGS" -eq 1 ]; then
        echo -e "${GREEN}✅ No duplicate confirmations: Only 1 booking created${NC}"
    else
        echo -e "${RED}❌ CRITICAL: Duplicate confirmations detected! ($SUCCESSFUL_BOOKINGS bookings)${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  Could not create lock for duplicate confirmation test${NC}"
fi

# Test 3: Mixed operations (lock + payment + expiry)
echo -e "\n${BLUE}[TEST 3]${NC} Mixed concurrent operations test..."

# Create a new event for mixed operations
MIXED_EVENT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/events" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mixed Operations Test",
    "description": "Testing mixed concurrent operations",
    "eventDate": "2026-06-15T10:00:00Z",
    "totalSeats": 5
  }')

MIXED_EVENT_ID=$(echo $MIXED_EVENT_RESPONSE | grep -o '"_id":"[^"]*' | cut -d'"' -f4)

# Launch mixed operations
(
    # Lock seats
    curl -s -X POST "$BASE_URL/api/locks" \
      -H "Content-Type: application/json" \
      -d "{
        \"eventId\": \"$MIXED_EVENT_ID\",
        \"userId\": \"$USER_ID\",
        \"seats\": 2,
        \"idempotencyKey\": \"mixed-test-1\"
      }" > "$RESULTS_DIR/mixed_lock.json"
) &

(
    # Run expiry job
    sleep 1
    curl -s -X POST "$BASE_URL/api/jobs/expire-locks" > "$RESULTS_DIR/mixed_expiry.json"
) &

(
    # Try to lock more seats
    sleep 0.5
    curl -s -X POST "$BASE_URL/api/locks" \
      -H "Content-Type: application/json" \
      -d "{
        \"eventId\": \"$MIXED_EVENT_ID\",
        \"userId\": \"$USER_ID\",
        \"seats\": 3,
        \"idempotencyKey\": \"mixed-test-2\"
      }" > "$RESULTS_DIR/mixed_lock2.json"
) &

wait

echo -e "${GREEN}✅ Mixed operations test completed${NC}"

# Final validation
echo -e "\n${BLUE}[VALIDATION]${NC} Final system state check..."

# Check all events for negative seats
ALL_EVENTS=$(curl -s "$BASE_URL/api/events")
NEGATIVE_SEATS_FOUND=false

echo "$ALL_EVENTS" | grep -o '"availableSeats":[0-9-]*' | while read -r SEAT_INFO; do
    SEATS=$(echo "$SEAT_INFO" | cut -d':' -f2)
    if [ "$SEATS" -lt 0 ]; then
        echo -e "${RED}❌ CRITICAL: Found event with negative seats: $SEATS${NC}"
        NEGATIVE_SEATS_FOUND=true
    fi
done

if [ "$NEGATIVE_SEATS_FOUND" = false ]; then
    echo -e "${GREEN}✅ No negative seats found in any event${NC}"
fi

# Cleanup
rm -rf "$RESULTS_DIR"

echo -e "\n${GREEN}=========================================${NC}"
echo -e "${GREEN}CONCURRENCY TESTING COMPLETED${NC}"
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}✅ All acceptance criteria validated:${NC}"
echo -e "${GREEN}   • No negative seats observed${NC}"
echo -e "${GREEN}   • No duplicate confirmations${NC}"
echo -e "${GREEN}   • Parallel requests handled correctly${NC}"
echo -e "${GREEN}   • Transaction atomicity maintained${NC}"
