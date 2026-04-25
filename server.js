const express = require('express');
const cors = require('cors'); 
const mongoose = require('mongoose'); 

const app = express();

// Middleware
// origin: '*' allows your Vercel frontend to access this API from any location
app.use(cors({
  origin: '*' 
}));
app.use(express.json());

// 1. Health Check Route
// Verifies the server is live at the root URL
app.get('/', (req, res) => {
  res.send('Service App Backend is Running!');
});

// 2. Services API Route
// Synchronized with frontend to use 'title' and numeric 'price'
app.get('/api/services', (req, res) => {
  const services = [
    {
      "_id": "662a9b1e2f1a4b0015d8e1a1",
      "title": "Solar Installation",
      "price": 250000
    },
    {
      "_id": "662a9b1e2f1a4b0015d8e1a2",
      "title": "Cybersecurity Audit",
      "price": 50000
    },
    {
      "_id": "662a9b1e2f1a4b0015d8e1a3",
      "title": "AC Repair",
      "price": 5000
    },
    {
      "_id": "662a9b1e2f1a4b0015d8e1a4",
      "title": "Linguistic Translation",
      "price": 15000
    }
  ];
  
  res.json(services);
});

// Port Configuration
// Uses Render's dynamic port or defaults to 5000 for local testing
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});