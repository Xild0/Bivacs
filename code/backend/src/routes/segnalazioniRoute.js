/**
 * @file segnalazioniRoute.js
 * @description Route Express per la gestione delle segnalazioni degli utenti.
 * Include creazione, consultazione e aggiornamento dello stato delle segnalazioni.
 */

const express = require('express');

const router = express.Router();
const Segnalazione = require('../models/segnalazione');
const upload = require('../config/multer'); // Importiamo la config sopra
const {protectRoute,isStaff} = require('../middlewares/authMiddleware');

/**
 * Crea una nuova segnalazione per un bivacco.
 * L'utente viene ricavato dal token JWT tramite middleware protectRoute.
 *
 * @route POST /api/v1/segnalazioni
 * @param {import('express').Request} req - Richiesta HTTP con bivaccoId, descrizione e foto.
 * @param {import('express').Response} res - Risposta HTTP.
 * @returns {Promise<void>} Segnalazione creata oppure errore di validazione.
 */

router.post('/', protectRoute, async (req, res) => {
    try {
        const nuovaSegnalazione = new Segnalazione({
            utenteId: req.utente.mongoId,
            bivaccoId: req.body.bivaccoId,
            descrizione: req.body.descrizione,
            foto: req.body.foto
        });

        const reportSalvato = await nuovaSegnalazione.save();
        res.status(201).json(reportSalvato);
    } catch (error) {
        res.status(400).json({ errore: error.message });
    }
});


/**
 * Recupera le segnalazioni attive, cioè non archiviate.
 *
 * @route GET /api/v1/segnalazioni/attive
 * @param {import('express').Request} req - Richiesta HTTP autenticata.
 * @param {import('express').Response} res - Risposta HTTP.
 * @returns {Promise<void>} Lista delle segnalazioni attive.
 */

router.get('/attive', protectRoute, async (req, res) => {
    try {
        const segnalazioni = await Segnalazione.find({ 
            statoSegnalazione: { $ne: 'archiviata' } 
        });
        res.json(segnalazioni);
    } catch (err) {
        const errorAsAny = /** @type {any} */ (err);
        res.status(500).json({ message: errorAsAny.message || 'Errore nel recupero delle segnalazioni' });
    }
});

/**
 * Recupera lo storico completo delle segnalazioni.
 * Endpoint riservato a SuperUser e SupportoTecnico.
 *
 * @route GET /api/v1/segnalazioni/storico
 * @param {import('express').Request} req - Richiesta HTTP autenticata.
 * @param {import('express').Response} res - Risposta HTTP.
 * @returns {Promise<void>} Lista completa delle segnalazioni.
 */

router.get('/storico', protectRoute, isStaff, async (req, res) => {
    try {
        const storico = await Segnalazione.find().populate('utenteId', 'email discriminator ente matricola').sort({ createdAt: -1 });
        res.json(storico);
    } catch (error) {
        res.status(500).json({ errore: 'Errore nel recupero dello storico.' });
    }
});

/**
 * Recupera le segnalazioni associate a un bivacco specifico.
 * Gli utenti standard vedono solo le segnalazioni ancora aperte.
 *
 * @route GET /api/v1/segnalazioni/bivacco/:bivaccoId
 * @param {import('express').Request} req - Richiesta HTTP con id del bivacco.
 * @param {import('express').Response} res - Risposta HTTP.
 * @returns {Promise<void>} Lista delle segnalazioni relative al bivacco.
 */

router.get('/bivacco/:bivaccoId', protectRoute, async (req, res) => {
    try {
        const { bivaccoId } = req.params;
        const { discriminator } = req.utente; 

        let queryFilter = { bivaccoId: bivaccoId };

        if (discriminator === 'UtenteRegistrato') {
            queryFilter.statoSegnalazione = { 
                $in: ['inviata', 'presa_in_carico', 'in_corso'] 
            };
        } 

        const segnalazioni = await Segnalazione.find(queryFilter).populate('utenteId', 'email').sort({ createdAt: -1 });
        res.json(segnalazioni);

    } catch (error) {
        res.status(500).json({ errore: 'Errore nel recupero delle segnalazioni per questo bivacco.' });
    }
});


/**
 * Aggiorna lo stato di una segnalazione.
 * Endpoint riservato a SuperUser e SupportoTecnico.
 *
 * @route PATCH /api/v1/segnalazioni/:id/stato
 * @param {import('express').Request} req - Richiesta HTTP con nuovoStato nel body.
 * @param {import('express').Response} res - Risposta HTTP.
 * @returns {Promise<void>} Segnalazione aggiornata oppure errore.
 */

router.patch('/:id/stato', protectRoute, isStaff, async (req, res) => {
    try {
        const { nuovoStato } = req.body;

        const segnalazioneAggiornata = await Segnalazione.findByIdAndUpdate(
            req.params.id,
            { statoSegnalazione: nuovoStato },
            { 
                new: true, 
                runValidators: true // Forza Mongoose a controllare l'enum definito nello Schema
            }
        );

        if (!segnalazioneAggiornata) {
            return res.status(404).json({ errore: 'Segnalazione non trovata' });
        }

        res.json({
            messaggio: 'Stato aggiornato con successo',
            segnalazione: segnalazioneAggiornata
        });
    } catch (err) {
        // Se l'errore è dovuto alla validazione dell'enum
        if (err.name === 'ValidationError') {
            return res.status(400).json({ errore: 'Stato non valido. Usa uno dei valori permessi.' });
        }
        res.status(500).json({ errore: 'Errore durante l\'aggiornamento' });
    }
});

module.exports = router;