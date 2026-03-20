# 🚀 Quick Start - Testing Epic 5

## ✅ Fixed: User Registration Endpoint

I've just created the missing user endpoint! Here's what was added:

### **Files Created:**

- `src/controllers/user.controller.js` - User registration logic
- `src/routes/user.routes.js` - User routes
- Updated `src/app.js` - Registered all routes with `/api/` prefix

### **All Available Endpoints Now:**

- `POST /api/users/register` - ✅ NEW
- `GET /api/users/:id`
- `POST /api/events` - Create event
- `GET /api/events/:id` - Get event
- `POST /api/locks` - Lock seats
- `POST /api/bookings/:lockId/confirm` - Create booking
- `POST /api/payments/intent` - Process payment

---

## 🎯 Testing with Postman - Step by Step

### **Step 1: Start Server**

```bash
npm run dev
```

Server will run on `http://localhost:3000`

---

### **Step 2: Copy-Paste into Postman**

Open Postman and make these requests **in order**:

#### **REQUEST 1: Register User**

```
POST http://localhost:3000/api/users/register
Content-Type: application/json

{
  "name": "Alice",
  "email": "alice@example.com",
  "password": "password123"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "_id": "63f5a8b2c1d2e3f4g5h6i7j0",
    "name": "Alice",
    "email": "alice@example.com",
    "role": "user"
  }
}
```

✅ **Copy `_id` → Save as `USER_ID`**

---

#### **REQUEST 2: Create Event**

```
POST http://localhost:3000/api/events
Content-Type: application/json

{
  "name": "Tech Summit 2026",
  "description": "International tech conference",
  "eventDate": "2026-06-15T10:00:00Z",
  "totalSeats": 100,
  "availableSeats": 100
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "_id": "63f5a8b2c1d2e3f4g5h6i7j1",
    "name": "Tech Summit 2026",
    "totalSeats": 100,
    "availableSeats": 100,
    ...
  }
}
```

✅ **Copy `_id` → Save as `EVENT_ID`**

---

#### **REQUEST 3: Lock Seats**

```
POST http://localhost:3000/api/locks
Content-Type: application/json

{
  "eventId": "63f5a8b2c1d2e3f4g5h6i7j1",
  "userId": "63f5a8b2c1d2e3f4g5h6i7j0",
  "seats": 2,
  "idempotencyKey": "lock-001"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "_id": "63f5a8b2c1d2e3f4g5h6i7j2",
    "seats": 2,
    "status": "ACTIVE",
    ...
  }
}
```

✅ **Copy `_id` → Save as `LOCK_ID`**

---

#### **REQUEST 4: Create Booking**

```
POST http://localhost:3000/api/bookings/63f5a8b2c1d2e3f4g5h6i7j2/confirm
```

**Response:**

```json
{
  "success": true,
  "booking": {
    "_id": "63f5a8b2c1d2e3f4g5h6i7j3",
    "status": "PAYMENT_PENDING",
    "seats": 2,
    ...
  }
}
```

✅ **Copy `_id` → Save as `BOOKING_ID`**

---

### **Step 3: Test Payment Scenarios**

#### **TEST 1: SUCCESS Payment ✅**

```
POST http://localhost:3000/api/payments/intent
Content-Type: application/json

{
  "bookingId": "63f5a8b2c1d2e3f4g5h6i7j3",
  "force": "success"
}
```

**Expected Response (200 OK):**

```json
{
  "success": true,
  "paymentStatus": "SUCCESS",
  "message": "Payment successful and booking confirmed",
  "booking": {
    "id": "63f5a8b2c1d2e3f4g5h6i7j3",
    "status": "CONFIRMED",
    "seats": 2
  }
}
```

---

#### **TEST 2: FAILURE Payment ❌**

First, repeat REQUEST 3 & 4 with new `idempotencyKey: "lock-002"` to get `BOOKING_ID_2`

```
POST http://localhost:3000/api/payments/intent
Content-Type: application/json

{
  "bookingId": "BOOKING_ID_2",
  "force": "failure"
}
```

**Expected Response (200 OK):**

```json
{
  "success": true,
  "paymentStatus": "FAILED",
  "message": "Payment failed and seats have been released",
  "booking": {
    "id": "BOOKING_ID_2",
    "status": "FAILED"
  }
}
```

---

#### **TEST 3: TIMEOUT Payment ⏱️**

Repeat REQUEST 3 & 4 with `idempotencyKey: "lock-003"` to get `BOOKING_ID_3`

```
POST http://localhost:3000/api/payments/intent
Content-Type: application/json

{
  "bookingId": "BOOKING_ID_3",
  "force": "timeout"
}
```

**Expected Response (200 OK):**

```json
{
  "success": true,
  "paymentStatus": "TIMEOUT",
  "message": "Payment timed out (simulated)"
}
```

---

## 🗄️ Verify Results in MongoDB

### **Connect to MongoDB**

```bash
mongosh
```

### **Check After SUCCESS Payment**

```javascript
// Check booking is CONFIRMED
db.bookings.findOne({ _id: ObjectId("BOOKING_ID") });
// Should show: status: "CONFIRMED"

// Check lock is CONSUMED
db.seatlocks.findOne({ _id: ObjectId("LOCK_ID") });
// Should show: status: "CONSUMED"

// Check event seats (should be 98: 100 - 2)
db.events.findOne({ _id: ObjectId("EVENT_ID") });
// Should show: availableSeats: 98
```

---

### **Check After FAILURE Payment**

```javascript
// Check booking is FAILED
db.bookings.findOne({ _id: ObjectId("BOOKING_ID_2") });
// Should show: status: "FAILED"

// Check lock is EXPIRED
db.seatlocks.findOne({ _id: ObjectId("LOCK_ID_2") });
// Should show: status: "EXPIRED"

// Check event seats are RESTORED (back to 98)
db.events.findOne({ _id: ObjectId("EVENT_ID") });
// Should show: availableSeats: 98
```

---

### **Check After TIMEOUT Payment**

```javascript
// Check booking still PAYMENT_PENDING (no change)
db.bookings.findOne({ _id: ObjectId("BOOKING_ID_3") });
// Should show: status: "PAYMENT_PENDING"

// Check lock still ACTIVE (no change)
db.seatlocks.findOne({ _id: ObjectId("LOCK_ID_3") });
// Should show: status: "ACTIVE"

// Check event seats unchanged (still 98)
db.events.findOne({ _id: ObjectId("EVENT_ID") });
// Should show: availableSeats: 98
```

---

## 📥 Import Postman Collection (Optional)

I've created a Postman collection file: `EPIC5_POSTMAN_COLLECTION.json`

**To import:**

1. Open Postman
2. Click "Import"
3. Select `EPIC5_POSTMAN_COLLECTION.json`
4. Set variables: `base_url=http://localhost:3000`
5. Run requests in order

---

## 🎯 Quick Reference

| Step | Endpoint                            | What to Save              |
| ---- | ----------------------------------- | ------------------------- |
| 1    | POST /api/users/register            | `user_id` (from `_id`)    |
| 2    | POST /api/events                    | `event_id` (from `_id`)   |
| 3    | POST /api/locks                     | `lock_id` (from `_id`)    |
| 4    | POST /api/bookings/:lockId/confirm  | `booking_id` (from `_id`) |
| 5    | POST /api/payments/intent (success) | ✅ Check response         |
| 6    | POST /api/payments/intent (failure) | ✅ Check response         |
| 7    | POST /api/payments/intent (timeout) | ✅ Check response         |

---

## ✅ Success Checklist

After all tests:

- [ ] Server starts without errors
- [ ] User registration works
- [ ] Event created successfully
- [ ] Seats locked successfully
- [ ] Booking created with PAYMENT_PENDING status
- [ ] SUCCESS payment → status CONFIRMED
- [ ] FAILURE payment → status FAILED, seats restored
- [ ] TIMEOUT payment → status unchanged
- [ ] MongoDB shows correct state after each test

---

## 🐛 If You Get Errors

| Error                             | Fix                                                        |
| --------------------------------- | ---------------------------------------------------------- |
| "Cannot POST /api/users/register" | Server not restarted after update. Run `npm run dev` again |
| "Invalid booking status"          | Make sure booking is PAYMENT_PENDING before payment        |
| "Event not found"                 | Check EVENT_ID is correct from step 2 response             |
| "User not found"                  | Check USER_ID is correct from step 1 response              |
| MongoDB connection error          | Make sure MongoDB is running: `mongod`                     |

---

**You're all set! Start with REQUEST 1 in Postman. 🚀**
