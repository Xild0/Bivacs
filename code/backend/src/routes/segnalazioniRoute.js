const express = require('express');
const router = express.Router();
const Segnalazione = require('../models/segnalazione');
const upload = require('../config/multer'); // Importiamo la config sopra
const {protectRoute,isStaff} = require('../middleware/authMiddleware');
// POST /api/v1/segnalazioni
/**
 * @route POST /api/segnalazioni
 * @desc  Permette a un utente base (o chiunque loggato) di inviare una segnalazione
 */
router.post('/', protectRoute, async (req, res) => {
    try {
        const nuovaSegnalazione = new Segnalazione({
            // req.utente.id o _id a seconda di come lo salvi nel JWT
            utenteId: req.utente.id, 
            descrizione: req.body.descrizione,
            foto: req.body.foto,
            // statoSegnalazione va in default 'inviata'
        });

        const reportSalvato = await nuovaSegnalazione.save();
        res.status(201).json(reportSalvato);
    } catch (error) {
        res.status(400).json({ errore: error.message });
    }
});
//GET /attive è accessibile a tutti gli utenti loggati
// Recupera solo le segnalazioni attive (NON archiviate)
router.get('/attive', protectRoute, async (req, res) => {
    try {
        const segnalazioni = await Segnalazione.find({ 
            statoSegnalazione: { $ne: 'archiviata' } 
        });
        res.json(segnalazioni);
    } catch (err) {
        // Casting a 'any' per leggere il messaggio senza errori
        const errorAsAny = /** @type {any} */ (err);
        res.status(500).json({ message: errorAsAny.message || 'Errore nel recupero delle segnalazioni' });
    }
});

/**
 * @route GET /api/segnalazioni/storico
 * @desc  Permette solo a SuperUser e SupportoTecnico di vedere tutte le segnalazioni
 */
router.get('/storico', protectRoute, isStaff, async (req, res) => {
    try {
        // Recuperiamo tutte le segnalazioni e "uniamo" i dati dell'utente che ha segnalato
        const storico = await Segnalazione.find().populate('utenteId', 'email discriminator ente matricola').sort({ createdAt: -1 });
        res.json(storico);
    } catch (error) {
        res.status(500).json({ errore: 'Errore nel recupero dello storico.' });
    }
});

/**
 * @route GET /api/segnalazioni/bivacco/:bivaccoId
 * @desc  Visualizza le segnalazioni di un bivacco specifico con filtri basati sul ruolo
 */
router.get('/bivacco/:bivaccoId', protectRoute, async (req, res) => {
    try {
        const { bivaccoId } = req.params;
        const { discriminator } = req.utente; // Recuperato dal token JWT

        // Definiamo il filtro base: solo per questo bivacco
        let queryFilter = { bivaccoId: bivaccoId };

        // Se l'utente è "standard" (UtenteRegistrato), vede solo quelle "aperte"
        // Escludiamo 'risolta' e 'archiviata'
        if (discriminator === 'UtenteRegistrato') {
            queryFilter.statoSegnalazione = { 
                $in: ['inviata', 'presa_in_carico', 'in_corso'] 
            };
        } 
        // Se è SuperUser o SupportoTecnico, non aggiungiamo altri filtri 
        // e vedrà tutto (comprese risolte e archiviate)

        const segnalazioni = await Segnalazione.find(queryFilter).populate('utenteId', 'email').sort({ createdAt: -1 });
        res.json(segnalazioni);

    } catch (error) {
        res.status(500).json({ errore: 'Errore nel recupero delle segnalazioni per questo bivacco.' });
    }
});

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