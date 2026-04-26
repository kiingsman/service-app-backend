const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const crypto = require('crypto'); // Built-in node module for security
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());

// 1. MongoDB Connection
const mongoURI = process.env.MONGO_URI;

if (!mongoURI) {
  console.error("Error: MONGO_URI is not defined in environment variables.");
} else {
  mongoose.connect(mongoURI)
    .then(() => console.log("✅ MongoDB Connected Successfully!"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));
}

// 2. Data Schemas & Models

// Service Schema (Existing)
const serviceSchema = new mongoose.Schema({
  title: { type: String, required: true },
  price: { type: Number, required: true }
});
const Service = mongoose.model('Service', serviceSchema);

// Transaction Schema (New for Paystack)
const transactionSchema = new mongoose.Schema({
  reference: { type: String, required: true, unique: true },
  customerEmail: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, default: 'pending' }, // pending, success, failed
  paidAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});
const Transaction = mongoose.model('Transaction', transactionSchema);

// 3. API Routes

// Fetch services (Live from MongoDB)
app.get('/api/services', async (req, res) => {
  try {
    const services = await Service.find(); 
    res.json(services);
  } catch (err) {
    res.status(500).json({ message: "Error fetching data from database" });
  }
});

// Paystack Webhook Callback
app.post('/api/paystack/webhook', async (req, res) => {
  try {
    // Security: Verify the request comes from Paystack using your Secret Key
    const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
                       .update(JSON.stringify(req.body))
                       .digest('hex');

    if (hash === req.headers['x-paystack-signature']) {
      const event = req.body;

      if (event.event === 'charge.success') {
        const { reference, amount, customer, paid_at } = event.data;

        // Update transaction status in your database
        await Transaction.findOneAndUpdate(
          { reference: reference },
          { 
            status: 'success', 
            customerEmail: customer.email,
            amount: amount / 100, // Convert Kobo back to Naira
            paidAt: paid_at 
          },
          { upsert: true } // Creates the record if it doesn't exist yet
        );
        console.log(`✅ Payment verified for reference: ${reference}`);
      }
    }
    res.sendStatus(200); // Always tell Paystack you received the data
  } catch (error) {
    console.error("Webhook Error:", error);
    res.sendStatus(500);
  }
});

// Seed Database Route
app.get('/api/seed', async (req, res) => {
  try {
    const count = await Service.countDocuments();
    if (count === 0) {
      await Service.insertMany([
        { title: "Solar Installation", price: 250000 },
        { title: "Cybersecurity Audit", price: 50000 },
        { title: "AC Repair", price: 5000 },
        { title: "Linguistic Translation", price: 15000 }
      ]);
      return res.send("Database seeded with initial services!");
    }
    res.send("Database already has data.");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get('/', (req, res) => {
  res.send('Service App Backend with MongoDB & Paystack Webhooks is Running!');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});