require('dotenv').config({
    path: process.env.ENV_FILE || '.env'
});
const express = require('express');

const authRoutes = require('./AuthMicroservice/auth.routes');
const profileRoutes = require('./ProfileMicroservice/profile.routes');

const app = express();

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/auth', authRoutes);
app.use('/profile', profileRoutes);

// Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
