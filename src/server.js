require('dotenv').config({
    path: process.env.ENV_FILE || '.env'
});

const express = require('express');
const cors = require('cors');

const authRoutes = require('./AuthMicroservice/auth.routes');
const profileRoutes = require('./ProfileMicroservice/profile.routes');

const app = express();

/* -------------------- CORS CONFIG -------------------- */
app.use(cors({
    origin: 'http://localhost:8080', // frontend origin
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight requests explicitly
app.options('*', cors());

/* -------------------- BODY PARSERS -------------------- */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* -------------------- ROUTES -------------------- */
app.use('/auth', authRoutes);
app.use('/profile', profileRoutes);

/* -------------------- SERVER -------------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
