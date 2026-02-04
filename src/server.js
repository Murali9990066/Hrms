require('dotenv').config({
    path: process.env.ENV_FILE || '.env'
});

const express = require('express');
const cors = require('cors');

const authRoutes = require('./AuthMicroservice/auth.routes');
const profileRoutes = require('./ProfileMicroservice/profile.routes');
const adminRoutes = require('./AdminMicroservice/admin.routes');

const app = express();

/* -------------------- CORS -------------------- */
// Accept requests from ANY origin (POC-safe)
app.use(cors());

/* -------------------- BODY PARSERS -------------------- */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* -------------------- ROUTES -------------------- */
app.use('/auth', authRoutes);
app.use('/profile', profileRoutes);
app.use('/admin', adminRoutes);

/* -------------------- SERVER -------------------- */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
