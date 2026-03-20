# MINI-EPIC 10: End-to-End Idempotency & Retry Safety

## Overview
This document outlines the comprehensive idempotency strategy implemented across the Event Booking System to ensure that replaying the same request multiple times never creates duplicate side effects.

## Global Idempotency Strategy

### 1. **Seat Locking Idempotency**
- **Implementation**: Uses `idempotencyKey` in SeatLock model
- **Behavior**: Duplicate lock requests return existing lock without creating new ones
- **Safety**: Prevents duplicate seat reservations

### 2. **Booking Confirmation Idempotency**
- **Implementation**: Checks for existing booking with same `seatLockId`
- **Behavior**: Returns existing booking if already created
- **Safety**: Prevents duplicate booking creation

### 3. **Payment Processing Idempotency**
- **Implementation**: Uses `PaymentAttempt` model with unique `idempotencyKey`
- **Behavior**: Stores payment responses and returns cached results for duplicate requests
- **Safety**: Prevents duplicate payment charges and processing

### 4. **Background Job Safety**
- **Implementation**: Uses `JobExecution` model to track running jobs
- **Behavior**: Prevents multiple instances of the same job type from running simultaneously
- **Safety**: Ensures jobs don't process the same data multiple times

## Models

### PaymentAttempt Model
```javascript
{
  idempotencyKey: String (unique),
  bookingId: ObjectId,
  amount: Number,
  forceResult: String,
  status: String,
  response: Mixed, // Cached response
  correlationId: String,
  expiresAt: Date // Auto-expire after 24 hours
}
```

### JobExecution Model
```javascript
{
  jobType: String,
  status: String,
  startedAt: Date,
  completedAt: Date,
  results: {
    processed: Number,
    errors: Number,
    details: String
  },
  expiresAt: Date // Auto-expire after 1 hour
}
```

## API Idempotency Requirements

### Payment Intent API
```
POST /api/payments/intent
{
  "bookingId": "...",
  "amount": 500,
  "force": "success",
  "idempotencyKey": "payment-unique-key-123"
}
```

**Idempotency Behavior:**
- First request: Processes payment and stores response
- Duplicate requests: Returns cached response with `isRetry: true`
- Audit logs distinguish original vs retry requests

### Seat Locking API
```
POST /api/locks
{
  "eventId": "...",
  "userId": "...",
  "seats": 5,
  "idempotencyKey": "lock-unique-key-123"
}
```

**Idempotency Behavior:**
- First request: Creates seat lock
- Duplicate requests: Returns existing lock

## Job Safety Implementation

### Lock Expiry Job
- Checks for existing `EXPIRE_LOCKS` job in `RUNNING` status
- Creates job execution record before processing
- Tracks processed/error counts
- Marks job as `COMPLETED` or `FAILED`

### Booking Expiry Job
- Checks for existing `EXPIRE_BOOKINGS` job in `RUNNING` status
- Creates job execution record before processing
- Tracks processed/error counts
- Marks job as `COMPLETED` or `FAILED`

## Audit Trail Enhancement

### Retry Detection
- Payment retries are logged with `isRetry: true`
- Original attempt ID is included in retry logs
- Correlation IDs link all related requests

### Audit Log Structure
```javascript
{
  bookingId: "...",
  fromState: "PAYMENT_RETRY",
  toState: "PAYMENT_RETRY",
  correlationId: "...",
  action: "PAYMENT_RETRY",
  metadata: {
    isRetry: true,
    originalAttemptId: "..."
  }
}
```

## Testing Scenarios

### 1. Payment Idempotency Test
```bash
# Send same payment request twice
curl -X POST /api/payments/intent \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "...",
    "amount": 500,
    "force": "success",
    "idempotencyKey": "test-payment-123"
  }'

# Second request should return cached response with isRetry: true
```

### 2. Job Safety Test
```bash
# Start two expiry jobs simultaneously
curl -X POST /api/jobs/expire-bookings &
curl -X POST /api/jobs/expire-bookings &

# Second job should be skipped with "Another instance is already running"
```

### 3. Seat Lock Idempotency Test
```bash
# Send same lock request twice
curl -X POST /api/locks \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "...",
    "userId": "...",
    "seats": 5,
    "idempotencyKey": "test-lock-123"
  }'

# Second request should return existing lock
```

## Data Consistency Guarantees

### 1. **No Duplicate Bookings**
- Booking confirmation checks for existing bookings by `seatLockId`
- Payment processing uses idempotency keys
- State transitions are validated

### 2. **Accurate Seat Inventory**
- Seat operations use atomic MongoDB operations
- Job safety prevents duplicate seat releases
- Transaction rollback on failures

### 3. **Financial Accuracy**
- Payment attempts are deduplicated by idempotency key
- Refund amounts are calculated consistently
- Audit trail tracks all financial operations

## Expiry and Cleanup

### PaymentAttempt Records
- Auto-expire after 24 hours using MongoDB TTL
- Prevents indefinite storage growth
- Balances idempotency window with storage efficiency

### JobExecution Records
- Auto-expire after 1 hour using MongoDB TTL
- Prevents stale job locks
- Allows job restart after reasonable timeout

## Monitoring and Observability

### Metrics to Track
- Payment retry rate
- Job execution frequency
- Idempotency cache hit rate
- Duplicate request patterns

### Log Analysis
- Search for `isRetry: true` to identify retry patterns
- Monitor job execution status and timing
- Track correlation IDs across service boundaries

## Definition of Done ✅

- [x] No duplicate bookings or seat mutations under retries
- [x] Seat inventory remains consistent
- [x] Retry behavior is observable and auditable
- [x] Global idempotency strategy documented
- [x] Booking confirmation is idempotent and replay-safe
- [x] Payment processing handles retries without side effects
- [x] Persistent idempotency store with safe expiry exists
- [x] Background job safety checks implemented
- [x] Audit logs distinguish original requests from retries

## Implementation Status: 100% Complete ✅
