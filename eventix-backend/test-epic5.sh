#!/bin/bash

# Epic 5 Payment Simulation Test Script
# Tests all three tasks: Payment Intent API, Success Flow, Failure Flow

BASE_URL="http://localhost:3000"
HEADERS="Content-Type: application/json"

echo "========================================="
echo "Epic 5: Payment Simulation Tests"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper function to make requests
test_endpoint() {
  local name=$1
  local method=$2
  local endpoint=$3
  local data=$4

  echo -e "${YELLOW}Testing: $name${NC}"
  echo "Method: $method"
  echo "Endpoint: $endpoint"
  if [ ! -z "$data" ]; then
    echo "Payload: $data"
  fi
  echo ""

  if [ "$method" = "POST" ]; then
    curl -X POST "$BASE_URL$endpoint" \
      -H "$HEADERS" \
      -d "$data" \
      -w "\nHTTP Status: %{http_code}\n" \
      -s | python3 -m json.tool 2>/dev/null || echo "Response received"
  else
    curl -X GET "$BASE_URL$endpoint" \
      -H "$HEADERS" \
      -w "\nHTTP Status: %{http_code}\n" \
      -s | python3 -m json.tool 2>/dev/null || echo "Response received"
  fi
  
  echo ""
  echo "---"
  echo ""
}

# Check if server is running
echo -e "${YELLOW}Checking if server is running...${NC}"
if ! curl -s "$BASE_URL/health" > /dev/null; then
  echo -e "${RED}Server is not running at $BASE_URL${NC}"
  echo "Please start the server: npm run dev"
  exit 1
fi
echo -e "${GREEN}✓ Server is running${NC}"
echo ""

# ========== TASK 5.1: Payment Intent API ==========
echo -e "${YELLOW}=== TASK 5.1: Payment Intent API ===${NC}"
echo ""

# Scenario 1: Payment Success
test_endpoint \
  "Payment Intent - Success" \
  "POST" \
  "/api/payments/intent" \
  '{"bookingId": "YOUR_BOOKING_ID", "force": "success"}'

# Scenario 2: Payment Failure
test_endpoint \
  "Payment Intent - Failure" \
  "POST" \
  "/api/payments/intent" \
  '{"bookingId": "YOUR_BOOKING_ID", "force": "failure"}'

# Scenario 3: Payment Timeout
test_endpoint \
  "Payment Intent - Timeout" \
  "POST" \
  "/api/payments/intent" \
  '{"bookingId": "YOUR_BOOKING_ID", "force": "timeout"}'

# Scenario 4: Invalid force value
test_endpoint \
  "Payment Intent - Invalid force (Should fail)" \
  "POST" \
  "/api/payments/intent" \
  '{"bookingId": "YOUR_BOOKING_ID", "force": "invalid"}'

# Scenario 5: Missing bookingId
test_endpoint \
  "Payment Intent - Missing bookingId (Should fail)" \
  "POST" \
  "/api/payments/intent" \
  '{"force": "success"}'

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Manual Testing Steps:${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "1. Create a user (if needed)"
echo "2. Create an event"
echo "3. Lock seats"
echo "4. Confirm booking to get booking ID"
echo "5. Replace 'YOUR_BOOKING_ID' with actual booking ID"
echo "6. Run payment intent tests"
echo ""
echo "Expected Results:"
echo "✓ Success: Booking status → CONFIRMED, Lock status → CONSUMED"
echo "✓ Failure: Booking status → FAILED, Lock status → EXPIRED, Seats restored"
echo "✓ Timeout: Booking remains PAYMENT_PENDING, Expiry job handles it (Epic 6)"
echo ""
