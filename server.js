const express = require('express');
const cors = require('cors'); // Add this if you want to connect to a frontend
const mongoose = require('mongoose'); // Add this for your database
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// A simple route so you can test if it's working
app.get('/', (req, res) => {
  res.send('Service App Backend is Running!');
});

// Move the listen block to the VERY BOTTOM
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});