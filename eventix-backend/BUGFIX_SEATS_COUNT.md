# Bug Fix: Seats Count Issue in Bookings

## Problem
When booking 2 seats, only 1 seat was being saved in the database and displayed in "My Bookings".

## Root Cause
There was a **data type mismatch** between the SeatLock and Booking models:

- **SeatLock Model**: Stores `seats` as a **Number** (e.g., `2`)
- **Booking Model**: Expects `seats` as an **Array of Strings** (e.g., `["SEAT-1", "SEAT-2"]`)

When creating a booking from a seat lock, the code was directly passing `lock.seats` (a number) to the booking, but MongoDB was treating it incorrectly.

## Files Changed

### 1. `/src/services/bookingConfirmation.service.js`

**Before:**
```javascript
const booking = await Booking.create([{
  event: lock.eventId,
  user: lock.userId,
  seats: lock.seats,  // ❌ Passing number directly
  seatLockId: lockId,
  status: BOOKING_STATUS.PAYMENT_PENDING,
  paymentExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
}], { session });
```

**After:**
```javascript
const booking = await Booking.create([{
  event: lock.eventId,
  user: lock.userId,
  seats: Array.from({ length: lock.seats }, (_, i) => `SEAT-${i + 1}`),  // ✅ Convert to array
  seatLockId: lockId,
  status: BOOKING_STATUS.PAYMENT_PENDING,
  paymentExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
}], { session });
```

**Explanation:**
- `Array.from({ length: lock.seats }, (_, i) => \`SEAT-${i + 1}\`)` creates an array of seat identifiers
- For 2 seats: `["SEAT-1", "SEAT-2"]`
- For 5 seats: `["SEAT-1", "SEAT-2", "SEAT-3", "SEAT-4", "SEAT-5"]`

### 2. `/src/controllers/payment.controller.js`

**Before:**
```javascript
await Event.findByIdAndUpdate(booking.event, {
  $inc: { availableSeats: booking.seats.length || 1 },  // ❌ Fallback to 1 was masking the bug
});
```

**After:**
```javascript
await Event.findByIdAndUpdate(booking.event, {
  $inc: { availableSeats: booking.seats.length },  // ✅ Always use array length
});
```

**Explanation:**
- Removed the `|| 1` fallback which was masking the issue
- Now correctly uses `booking.seats.length` since seats is always an array

## Why This Design?

The Booking model uses an array of strings for `seats` to support:
1. **Named seats**: Future feature for assigned seating (e.g., "A1", "B5", "C12")
2. **Flexibility**: Can store actual seat identifiers from venue layouts
3. **Extensibility**: Easy to add seat-specific information

For now, we generate generic seat identifiers like "SEAT-1", "SEAT-2", etc.

## Testing

### Test Case 1: Book 2 Seats
```bash
# 1. Lock 2 seats
curl -X POST http://localhost:3000/api/events/{eventId}/lock \
  -H "Content-Type: application/json" \
  -d '{
    "seats": 2,
    "userId": "user123",
    "idempotencyKey": "test-key-1"
  }'

# 2. Confirm booking
curl -X POST http://localhost:3000/api/bookings/confirm \
  -H "Content-Type: application/json" \
  -d '{"lockId": "{lockId}"}'

# 3. Check booking in MongoDB
# Should show: seats: ["SEAT-1", "SEAT-2"]
```

### Test Case 2: Book 5 Seats
```bash
# Lock 5 seats and confirm
# Should show: seats: ["SEAT-1", "SEAT-2", "SEAT-3", "SEAT-4", "SEAT-5"]
```

## Verification

After the fix:
- ✅ Booking 2 seats creates: `seats: ["SEAT-1", "SEAT-2"]`
- ✅ MongoDB shows correct seat count: `2`
- ✅ "My Bookings" displays: `Seats: 2`
- ✅ Payment failure restores correct number of seats
- ✅ Cancellation refunds correct number of seats

## Frontend Compatibility

The frontend component `MyBookings.js` already handles both formats correctly:

```javascript
<p><strong>Seats:</strong> {Array.isArray(booking.seats) ? booking.seats.length : booking.seats}</p>
```

This ensures backward compatibility with any old bookings that might have stored seats as a number.

## Migration Note

Existing bookings in the database with incorrect seat data will continue to work, but new bookings will have the correct array format. If needed, a migration script can be created to fix old bookings.
