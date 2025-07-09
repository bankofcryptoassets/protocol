const {
    googleAuthCallback,
    googleAuthRedirect
} = require('../controllers/WaitlistController');

const router = require('express').Router();

// Redirect to Google OAuth
router.get('/google', googleAuthRedirect);
// Handle Google OAuth callback
router.get('/google/callback', googleAuthCallback);