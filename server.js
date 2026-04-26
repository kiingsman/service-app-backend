const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const crypto = require('crypto');
const http = require('http'); // Required for Socket.io
const { Server } = require('socket.io'); // Required for Socket.io
require('dotenv').config();

const app = express();
const server = http.createServer(app); // Create HTTP server using express app

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: "*", // Allows your Vercel frontend to connect
    methods: ["GET", "POST"]
  }
});

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
const serviceSchema = new mongoose.Schema({
  title: { type: String, required: true },
  price: { type: Number, required: true }
});
const Service = mongoose.model('Service', serviceSchema);

const transactionSchema = new mongoose.Schema({
  reference: { type: String, required: true, unique: true },
  customerEmail: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, default: 'pending' },
  paidAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});
const Transaction = mongoose.model('Transaction', transactionSchema);

// 3. Socket.io Real-Time Logic
io.on('connection', (socket) => {
  console.log('⚡ A user connected:', socket.id);

  // User joins a specific chat room (e.g., an order ID)
  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    console.log(`👤 User joined room: ${roomId}`);
  });

  // Handling incoming messages
  socket.on('send_message', (data) => {
    // Sends message to everyone in the room except the sender
    socket.to(data.roomId).emit('receive_message', data);
    console.log(`📩 Message sent to room ${data.roomId}`);
  });

  socket.on('disconnect', () => {
    console.log('❌ User disconnected');
  });
});

// 4. API Routes
app.get('/api/services', async (req, res) => {
  try {
    const services = await Service.find(); 
    res.json(services);
  } catch (err) {
    res.status(500).json({ message: "Error fetching data from database" });
  }
});

app.post('/api/paystack/webhook', async (req, res) => {
  try {
    const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
                       .update(JSON.stringify(req.body))
                       .digest('hex');

    if (hash === req.headers['x-paystack-signature']) {
      const event = req.body;
      if (event.event === 'charge.success') {
        const { reference, amount, customer, paid_at } = event.data;
        await Transaction.findOneAndUpdate(
          { reference: reference },
          { 
            status: 'success', 
            customerEmail: customer.email,
            amount: amount / 100, 
            paidAt: paid_at 
          },
          { upsert: true }
        );
        console.log(`✅ Payment verified for reference: ${reference}`);
      }
    }
    res.sendStatus(200);
  } catch (error) {
    console.error("Webhook Error:", error);
    res.sendStatus(500);
  }
});

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
  res.send('Service App Backend with MongoDB, Paystack & Socket.io is Running!');
});

// 5. Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});