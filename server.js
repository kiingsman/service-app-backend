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

// CORE BUSINESS LOGIC: Enhanced Booking Model
const Booking = mongoose.model('Booking', new mongoose.Schema({
  userEmail: { type: String, required: true },
  serviceTitle: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, default: 'PENDING' }, // PENDING, PAID, ACCEPTED, COMPLETED, CANCELLED
  date: { type: String },    // User's requested service date
  address: { type: String }, // Physical location in Kano or elsewhere
  notes: { type: String },   // Special instructions/Urgent fix notes
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
    const { email, amount, serviceTitle, date, address, notes } = req.body;
    
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

    // Create Booking with full context
    const newBooking = new Booking({
      userEmail: email,
      serviceTitle: serviceTitle || "General Service",
      amount: amount,
      date: date,
      address: address,
      notes: notes,
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
      await Booking.findOneAndUpdate(
        { reference: reference },
        { status: 'PAID', paidAt: paid_at }
      );
      console.log(`✅ Booking confirmed & paid: ${reference}`);
    }
  }
  res.sendStatus(200);
});

// 7. Provider & User Lifecycle Endpoints
// GET User Bookings (For History)
app.get('/api/bookings/my/:email', async (req, res) => {
  try {
    const userBookings = await Booking.find({ userEmail: req.params.email }).sort({ createdAt: -1 });
    res.json(userBookings);
  } catch (err) {
    res.status(500).send(err);
  }
});

// GET All Bookings (For @cloud_guy_nigeria Provider View)
app.get('/api/bookings/provider', async (req, res) => {
  try {
    const allJobs = await Booking.find().sort({ createdAt: -1 });
    res.json(allJobs);
  } catch (err) {
    res.status(500).send(err);
  }
});

// PUT Update Status (Accept / Complete / Cancel)
app.put('/api/bookings/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const updated = await Booking.findByIdAndUpdate(
      req.params.id, 
      { status: status.toUpperCase() }, 
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Update failed" });
  }
});

// 8. Socket.io Logic
io.on('connection', (socket) => {
  socket.on('join_room', (roomId) => socket.join(roomId));
  socket.on('send_message', (data) => {
    socket.to(data.roomId).emit('receive_message', data);
  });
});

// 9. API Routes
app.get('/api/services', async (req, res) => {
  const services = await Service.find();
  res.json(services);
});

app.get('/', (req, res) => res.send('Cloud Guy Nigeria API - Startup Core Logic Live!'));

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on port ${PORT}`));