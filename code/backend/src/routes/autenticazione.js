const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const utenteRegistrato = require('../models/utenteRegistrato');

// POST /api/v1/auth/register
router.post('/', async (req, res)) => {
    try { 
        const{id, nome, cognome, email, password, dataNascita} = req.body;
    }
}