const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const utenteRegistrato = require('../models/utenteRegistrato');

// POST /api/v1/auth/register
router.post('/register', async (req, res) => {

    console.log('Dati in arrivo da postman:', req.body);

    try { 

        /**
         * inserimento dati di input nel body della richiesta 
         */
        const{id, nome, cognome, email, password, dataNascita} = req.body;

        /**
         * validazione basilare (controlla che i campi esistano)
         */
        if (!id || !nome || !cognome || !email  || !password || !dataNascita){
            return res.status(400).json({errore: 'Tutti i campi sono obbligatori'});
        }

        /**
         * controllo mail duplicate per utenti diversi
         */
        const utenteEsistente = await utenteRegistrato.findOne({email:email});
        if (utenteEsistente){ 
            return res.status(409).json({errore: 'Esiste già un account con questa mail'});
        }

        /**
         * crittografia della password 
         */
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        /**
         * creazione nuovo utenteRegistrato
         */
        const nuovoUtente = new utenteRegistrato({
            id: id, 
            nome: nome, 
            cognome: cognome, 
            email: email, 
            passwordHash: hashedPassword, 
            dataNascita: new Date(dataNascita)
        });

        /**
         * salvataggio sul server
         */
        await nuovoUtente.save();
        res.status(201).json({
            message: 'Utente registrato con successo', 
            utente: {
                id: nuovoUtente.id, 
                nome: nuovoUtente.nome,
                cognome: nuovoUtente.cognome,
                email: nuovoUtente.email, 
                discriminator: nuovoUtente.discriminator
            }
        });
    } catch (error){
        console.error('Errore durante la registrazione:', error);

        if (error.name = 'ValidationError'){
            return res.status(400).json({erroe: error.message});
        }

        res.status(500).json({errore: 'Errore interno del server'});
    }
});

module.exports = router;