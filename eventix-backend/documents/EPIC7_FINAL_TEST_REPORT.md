# EPIC 7: Transactions & Concurrency - Test Report

**Project:** Event Booking Backend  
**EPIC:** 7 - Transactions & Concurrency  
**Date:** February 2, 2026  
**Status:** ✅ COMPLETE & VERIFIED

---

## Setup in Postman

Create Collection: "Event Booking - Concurrency Tests"

Set Variables:

- baseUrl: http://localhost:3000
- userId: (will get from registration)
- eventId: (will get from event creation)
- lockId: (will get from lock creation)

---

## Initial Setup Requests

### 1. Register User

**POST** http://localhost:3000/api/users/register

**Body (JSON):**

```json
{
  "name": "Test User",
  "email": "test@example.com"
}
```

**Action:** Copy userId from response to collection variable.

**Screenshot Evidence:**

- `SS_Setup1_Register_Request.png`
- `SS_Setup1_Register_Response.png`

---

### 2. Create Event

**POST** http://localhost:3000/api/events

**Body (JSON):**

```json
{
  "name": "Test Event",
  "description": "Concurrency test",
  "eventDate": "2026-06-15T10:00:00Z",
  "totalSeats": 5
}
```

**Action:** Copy eventId from response to collection variable.

**Screenshot Evidence:**

- `SS_Setup2_Create_Event_Request.png`
- `SS_Setup2_Create_Event_Response.png`

---

## TASK 7.1: Transaction Testing

### Test 1: Transaction Rollback

**POST** http://localhost:3000/api/locks

**Body (JSON):**

```json
{
  "eventId": "{{eventId}}",
  "userId": "{{userId}}",
  "seats": 10,
  "idempotencyKey": "fail-test"
}
```

**Expected:** Should fail (insufficient seats).

**Verification:** Check event with:

```
GET http://localhost:3000/api/events/{{eventId}}
```

**Expected Result:** availableSeats is still 5 (no partial write).

**Screenshot Evidence:**

- `SS_Test1_Lock_Request_Fail.png`
- `SS_Test1_Lock_Response_Error.png`
- `SS_Test1_Event_Verification.png`

✅ **PASSED** - Transaction rollback prevented partial write

---

### Test 2: Successful Transaction

**POST** http://localhost:3000/api/locks

**Body (JSON):**

```json
{
  "eventId": "{{eventId}}",
  "userId": "{{userId}}",
  "seats": 2,
  "idempotencyKey": "success-test"
}
```

**Action:** Copy lockId from response to collection variable.

**Verification:** Check event shows availableSeats: 3.

```
GET http://localhost:3000/api/events/{{eventId}}
```

**Screenshot Evidence:**

- `SS_Test2_Lock_Request_Success.png`
- `SS_Test2_Lock_Response.png`
- `SS_Test2_Event_Verification.png`

✅ **PASSED** - Seats deducted atomically

---

## TASK 7.2: Concurrency Testing

### Test 3: No Duplicate Confirmations

**Create 3 identical requests:**

**POST** http://localhost:3000/api/bookings/confirm

**Body (JSON):**

```json
{
  "lockId": "{{lockId}}"
}
```

**Manual Steps:**

1. Open 3 Postman tabs with same request
2. Click Send on all 3 quickly (within 1 second)
3. Only first should succeed, others return existing booking

**Expected:** All 3 return same booking ID (only 1 booking in database).

**Screenshot Evidence:**

- `SS_Test3_Concurrent_Confirm_Requests.png`
- `SS_Test3_All_Return_Same_ID.png`
- `SS_Test3_MongoDB_One_Booking.png`

✅ **PASSED** - No duplicate confirmations

---

### Test 4: No Negative Seats

**Setup:** Create new event with 3 seats.

**Create 5 identical lock requests:**

**POST** http://localhost:3000/api/locks

**Body (JSON):**

```json
{
  "eventId": "{{eventId}}",
  "userId": "{{userId}}",
  "seats": 2,
  "idempotencyKey": "concurrent-X"
}
```

**Manual Steps:**

1. Change idempotencyKey to: concurrent-1, concurrent-2, concurrent-3, concurrent-4, concurrent-5
2. Open 5 tabs, send all simultaneously
3. Only 1 should succeed, check event never shows negative seats

**Expected:** Only 1 lock succeeds, availableSeats never negative.

**Verification:**

```
GET http://localhost:3000/api/events/{{eventId}}
```

**Screenshot Evidence:**

- `SS_Test4_Concurrent_Requests.png`
- `SS_Test4_Results_Postman.png`
- `SS_Test4_Only_1_Success.png`
- `SS_Test4_Event_Final_State.png`

✅ **PASSED** - No overselling, no negative seats

---

### Test 5: Payment Rollback

**POST** http://localhost:3000/api/payments/{{bookingId}}/fail

**Expected:** Payment fails and seats are restored.

**Verification:** Check event shows seats restored.

```
GET http://localhost:3000/api/events/{{eventId}}
```

**Screenshot Evidence:**

- `SS_Test5_Payment_Fail_Request.png`
- `SS_Test5_Payment_Fail_Response.png`
- `SS_Test5_Seats_Restored.png`

✅ **PASSED** - Seats released atomically on payment failure

---

## Quick Validation

```
GET {{baseUrl}}/api/events
GET {{baseUrl}}/api/locks
GET {{baseUrl}}/api/bookings
```

---

## Success Criteria

- ✅ Failed operations don't partially update
- ✅ No duplicate bookings from same lock
- ✅ No negative availableSeats
- ✅ Concurrent requests handled safely

---

**Status:** ✅ EPIC 7 COMPLETE
