const express = require('express');
const cors = require('cors'); 
const mongoose = require('mongoose'); 

const app = express();

// Middleware
app.use(cors({
  origin: '*' // Allows your Vercel frontend to talk to this backend
}));
app.use(express.json());

// 1. Root route for status check
app.get('/', (req, res) => {
  res.send('Service App Backend is Running!');
});

// 2. The Services API route (Formatted as requested)
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

// The listen block at the VERY BOTTOM
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});