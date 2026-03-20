# Payment Integration - Amount Field Implementation

## Overview
Added `amount` and `currency` fields to the Event model to support payment gateway integration in the future.

## Backend Changes

### 1. Event Model (`src/models/Event.model.js`)
Added two new fields:
- **amount**: Number (required, min: 0) - Stores ticket price per seat
- **currency**: String (default: "INR") - ISO 4217 currency code

```javascript
amount: {
  type: Number,
  required: true,
  min: [0, "Amount cannot be negative"],
},
currency: {
  type: String,
  default: "INR",
  uppercase: true,
}
```

### 2. Event Controller (`src/controllers/event.controller.js`)
Updated three functions:

#### createEvent
- Added `amount` and `currency` to request body extraction
- Added validation for amount (cannot be negative)
- Made `amount` a required field
- Defaults `currency` to "INR" if not provided

#### getAllPublicEvents
- Added `amount` and `currency` to the select query
- Now returns price information with event list

#### getEventById
- Added `amount` and `currency` to the select query
- Now returns price information with event details

## Frontend Changes

### 1. CreateEvent Component (`src/components/CreateEvent.js`)
- Added `amount` field to form state (default: 0)
- Added `currency` field to form state (default: "INR")
- Added new form input for "Ticket Price (₹)"
  - Type: number
  - Min: 0
  - Step: 0.01
  - Includes helper text: "Price per ticket in Indian Rupees (INR)"

### 2. EventList Component (`src/components/EventList.js`)
- Added price display in event cards
- Shows: `₹{event.amount || 0} per ticket`

### 3. EventDetails Component (`src/components/EventDetails.js`)
- Added price display in event header: `💰 Price: ₹{event.amount || 0} per ticket`
- Added total amount calculation when selecting seats: `Total Amount: ₹{(event.amount || 0) * seats}`

## Database Schema
The Event collection now includes:
```javascript
{
  name: String,
  description: String,
  eventDate: Date,
  totalSeats: Number,
  availableSeats: Number,
  type: String,
  category: String,
  amount: Number,        // NEW
  currency: String,      // NEW
  createdAt: Date,
  updatedAt: Date
}
```

## Future Payment Gateway Integration

### Design Considerations
1. **Amount Storage**: Stored as a number (can represent rupees or paise)
   - For Razorpay/Stripe: multiply by 100 to convert to paise/cents
   - Example: ₹500 → 50000 paise

2. **Currency Field**: Supports multi-currency in future
   - Currently defaults to INR
   - Can be extended to USD, EUR, etc.

3. **Total Calculation**: Frontend calculates `amount × seats`
   - This will be the payment amount sent to gateway

### Next Steps for Payment Gateway
When integrating Razorpay/Stripe/PayPal:

1. **Create Payment Order**:
   ```javascript
   const paymentAmount = event.amount * seats * 100; // Convert to paise
   const order = await razorpay.orders.create({
     amount: paymentAmount,
     currency: event.currency,
     receipt: bookingId
   });
   ```

2. **Update Payment Controller**:
   - Add payment gateway initialization
   - Create order before payment
   - Verify payment signature
   - Update booking status

3. **Frontend Payment Flow**:
   - Show payment gateway modal
   - Handle success/failure callbacks
   - Update UI based on payment status

## Testing

### Create Event with Amount
```bash
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Concert",
    "description": "A test event with pricing",
    "eventDate": "2026-03-15T18:00:00Z",
    "totalSeats": 100,
    "category": "concerts-music",
    "amount": 500,
    "currency": "INR"
  }'
```

### Get Event with Amount
```bash
curl http://localhost:3000/api/events
```

Response will include:
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "name": "Test Concert",
      "amount": 500,
      "currency": "INR",
      ...
    }
  ]
}
```

## Migration Notes
- **Existing Events**: Will need to be updated with amount field
- **Default Value**: Consider running a migration script to set default amount for existing events
- **Backward Compatibility**: Frontend uses `event.amount || 0` to handle events without amount

## Migration Script (Optional)
```javascript
// Run this to update existing events
db.events.updateMany(
  { amount: { $exists: false } },
  { 
    $set: { 
      amount: 0,
      currency: "INR"
    }
  }
);
```
