const express = require('express');
const cors = require('cors'); 
const mongoose = require('mongoose'); 

const app = express();

// Updated Middleware - This tells the server to accept requests from ANYWHERE
app.use(cors({
  origin: '*'
}));
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Service App Backend is Running!');
});

// Double-check this route is exactly here
app.get('/api/services', (req, res) => {
  const services = [
    { id: 1, name: "Solar Installation", price: "Contact for Quote" },
    { id: 2, name: "Cybersecurity Audit", price: "Professional Rate" },
    { id: 3, name: "Linguistic Translation", price: "Per Page" }
  ];
  res.json(services);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});