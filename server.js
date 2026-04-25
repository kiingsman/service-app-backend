const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config(); // Load environment variables

const app = express();

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());

// 1. MongoDB Connection
// We use process.env.MONGO_URI for security. 
// Locally, it reads from a .env file. On Render, you set it in the dashboard.
const mongoURI = process.env.MONGO_URI;

if (!mongoURI) {
  console.error("Error: MONGO_URI is not defined in environment variables.");
} else {
  mongoose.connect(mongoURI)
    .then(() => console.log("✅ MongoDB Connected Successfully!"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));
}

// 2. Data Schema & Model
const serviceSchema = new mongoose.Schema({
  title: { type: String, required: true },
  price: { type: Number, required: true }
});

const Service = mongoose.model('Service', serviceSchema);

// 3. GET Route: Fetch services from the actual Database
app.get('/api/services', async (req, res) => {
  try {
    const services = await Service.find(); 
    res.json(services);
  } catch (err) {
    res.status(500).json({ message: "Error fetching data from database" });
  }
});

// 4. POST Route: Add a new service to the Database
// You can use this later to add data via Postman or a form
app.get('/api/seed', async (req, res) => {
  try {
    // This is a "Seed" route to add initial data if the DB is empty
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
  res.send('Service App Backend with MongoDB is Running!');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});