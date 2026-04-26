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
  cors: { origin: "*", methods: ["GET", "POST"] }
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

// NEW: Booking Model to track specific service sales
const Booking = mongoose.model('Booking', new mongoose.Schema({
  userEmail: { type: String, required: true },
  serviceTitle: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, default: 'PENDING' }, // PENDING, PAID, COMPLETED
  reference: { type: String, required: true, unique: true },
  paidAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
}));

// 4. Auth Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, password: hashedPassword });
    await newUser.save();
    res.status(201).json({ message: "User created successfully" });
  } catch (err) {
    res.status(400).json({ message: "Registration failed." });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (user && await bcrypt.compare(password, user.password)) {
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'kano_secret', { expiresIn: '1h' });
    res.json({ token, email: user.email });
  } else {
    res.status(401).json({ message: "Invalid credentials" });
  }
});

// 5. Booking & Payment Initialization
app.post('/api/payments/initialize', async (req, res) => {
  try {
    const { email, amount, serviceTitle } = req.body;
    
    // Convert to Kobo for Paystack
    const amountInKobo = Math.round(Number(amount) * 100);

    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: email,
        amount: amountInKobo,
        callback_url: "https://service-app-frontend-six.vercel.app/"
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // ARCHITECTURE STEP: Create a PENDING booking in our DB first
    const newBooking = new Booking({
      userEmail: email,
      serviceTitle: serviceTitle || "General Service",
      amount: amount,
      reference: response.data.data.reference,
      status: 'PENDING'
    });
    await newBooking.save();

    res.json(response.data.data); 
  } catch (error) {
    console.error("Paystack Init Error:", error.response ? error.response.data : error.message);
    res.status(500).json({ message: "Payment failed to initialize" });
  }
});

// 6. Webhook: Mark Booking as PAID
app.post('/api/paystack/webhook', async (req, res) => {
  const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
                     .update(JSON.stringify(req.body)).digest('hex');

  if (hash === req.headers['x-paystack-signature']) {
    const { reference, paid_at } = req.body.data;
    
    if (req.body.event === 'charge.success') {
      // ARCHITECTURE STEP: Update Booking to PAID
      await Booking.findOneAndUpdate(
        { reference: reference },
        { status: 'PAID', paidAt: paid_at }
      );
      console.log(`✅ Booking confirmed & paid: ${reference}`);
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

// Optional: Get User Bookings
app.get('/api/bookings/:email', async (req, res) => {
  const userBookings = await Booking.find({ userEmail: req.params.email }).sort({ createdAt: -1 });
  res.json(userBookings);
});

app.get('/', (req, res) => res.send('Kano Cloud Marketplace API - Booking Model Active!'));

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on port ${PORT}`));