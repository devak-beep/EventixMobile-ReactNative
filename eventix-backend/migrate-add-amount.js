// Migration script to add amount field to existing events
// Run this once to update all existing events with a default amount

const mongoose = require('mongoose');
require('dotenv').config();

const Event = require('./src/models/Event.model');

async function migrateEvents() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find all events without amount field
    const eventsWithoutAmount = await Event.find({
      $or: [
        { amount: { $exists: false } },
        { amount: null }
      ]
    });

    console.log(`Found ${eventsWithoutAmount.length} events without amount field`);

    if (eventsWithoutAmount.length === 0) {
      console.log('✅ All events already have amount field');
      process.exit(0);
    }

    // Update each event with default amount
    const result = await Event.updateMany(
      {
        $or: [
          { amount: { $exists: false } },
          { amount: null }
        ]
      },
      {
        $set: {
          amount: 0,
          currency: 'INR'
        }
      }
    );

    console.log(`✅ Updated ${result.modifiedCount} events`);
    console.log('Migration completed successfully!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateEvents();
