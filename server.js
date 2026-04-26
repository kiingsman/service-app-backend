const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const crypto = require('crypto');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// 1. Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());

// 2. MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected Successfully!"))
  .catch(err => console.error("❌ MongoDB Connection Error:", err));

// 3. Data Schemas & Models
const User = mongoose.model('User', new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
}));

const Service = mongoose.model('Service', new mongoose.Schema({
  title: { type: String, required: true },
  price: { type: Number, required: true }
}));

const Transaction = mongoose.model('Transaction', new mongoose.Schema({
  reference: { type: String, required: true, unique: true },
  customerEmail: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, default: 'pending' },
  paidAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
}));

// 4. Auth Routes (Register/Login)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, password: hashedPassword });
    await newUser.save();
    res.status(201).json({ message: "User created successfully" });
  } catch (err) {
    res.status(400).json({ message: "Registration failed. Email might exist." });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (user && await bcrypt.compare(password, user.password)) {
    // Uses JWT_SECRET from your Render Env Variables [cite: 2026-04-26]
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '1h' });
    res.json({ token, email: user.email });
  } else {
    res.status(401).json({ message: "Invalid credentials" });
  }
});

// 5. Paystack Initialization
app.post('/api/payments/initialize', async (req, res) => {
  try {
    const { email, amount } = req.body;
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email,
        amount: amount * 100, // Paystack uses Kobo
        callback_url: "https://service-app-frontend-six.vercel.app/" 
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    res.json(response.data.data); 
  } catch (error) {
    res.status(500).json({ message: "Paystack initialization error" });
  }
});

// 6. Paystack Webhook
app.post('/api/paystack/webhook', async (req, res) => {
  const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
                     .update(JSON.stringify(req.body)).digest('hex');

  if (hash === req.headers['x-paystack-signature']) {
    const { reference, amount, customer, paid_at } = req.body.data;
    if (req.body.event === 'charge.success') {
      await Transaction.findOneAndUpdate(
        { reference },
        { status: 'success', customerEmail: customer.email, amount: amount / 100, paidAt: paid_at },
        { upsert: true }
      );
      console.log(`✅ Payment success: ${reference}`);
    }
  }
  res.sendStatus(200);
});

// 7. Socket.io Logic
io.on('connection', (socket) => {
  socket.on('join_room', (roomId) => socket.join(roomId));
  socket.on('send_message', (data) => {
    socket.to(data.roomId).emit('receive_message', data);
  });
});

// 8. API Routes
app.get('/api/services', async (req, res) => {
  const services = await Service.find();
  res.json(services);
});

app.get('/', (req, res) => res.send('Backend is Active!'));

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on port ${PORT}`));