/**
 * @file ticket.js
 * @description API REST per la gestione dei ticket di manutenzione.
 *
 * Include:
 * - consultazione della coda ticket;
 * - creazione di ticket da segnalazioni;
 * - aggiornamento dello stato dei ticket;
 * - chiusura dei ticket con note di intervento;
 * - archiviazione dei ticket chiusi.
 */

const express = require('express');
const router = express.Router();
const TicketManutenzione = require('../models/ticketManutenzione');
const Segnalazione = require('../models/segnalazione');
const getNextSequence = require('../utils/getNewSequence');
const {protectRoute, isSuperUser} = require('../middlewares/authMiddleware');

/**
 * Mappa gli stati dei ticket agli stati corrispondenti
 * delle segnalazioni collegate.
 */
const STATO_SEGNALAZIONE = {
    aperto: 'presa_in_carico',
    in_lavorazione: 'in_corso',
    chiuso: 'risolta',
    archiviato: 'archiviata'
};

/**
 * Recupera la coda dei ticket di manutenzione.
 *
 * L'operazione:
 * - recupera tutti i ticket;
 * - include la segnalazione associata;
 * - include il bivacco collegato alla segnalazione;
 * - ordina i risultati per data di apertura.
 *
 * @route GET /api/v1/ticket
 * @access Private - SuperUser
 */
router.get('/', protectRoute, isSuperUser, async (req, res) => {
    try {
        const ticket = await TicketManutenzione.find().populate({
                path: 'segnalazione',
                populate: {path: 'bivaccoId', select: 'nome zona'}
            }).sort({dataApertura: -1});

        res.status(200).json(ticket);
    } catch (error) {
        res.status(500).json({errore: 'Errore recupero dei ticket'});
    }
});

/**
 * Crea un nuovo ticket da una segnalazione.
 *
 * L'operazione:
 * - verifica che la segnalazione esista;
 * - controlla che non esista già un ticket associato;
 * - crea il ticket in stato aperto;
 * - aggiorna la segnalazione come presa in carico.
 *
 * @route POST /api/v1/ticket
 * @access Private - SuperUser
 */
router.post('/', protectRoute, isSuperUser, async (req, res) => {
    try {
        const {segnalazioneId} = req.body;

        const segnalazione = await Segnalazione.findById(segnalazioneId);
        if (!segnalazione) {
            return res.status(404).json({errore: 'Segnalazione non trovata'});
        }

        const esistente = await TicketManutenzione.findOne({segnalazione: segnalazioneId});
        if (esistente) {
            return res.status(409).json({errore: 'Esiste già un ticket per questa segnalazione'});
        }

        const id = await getNextSequence('ticketId');
        const ticket = await TicketManutenzione.create({
            id,
            segnalazione: segnalazioneId,
            stato: 'aperto',
            dataApertura: new Date()
        });
        await Segnalazione.findByIdAndUpdate(segnalazioneId, {
            statoSegnalazione: 'presa_in_carico'
        });

        res.status(201).json({messaggio: 'Ticket aperto e segnalazione presa in carico', ticket});
    } catch (error) {
        res.status(500).json({errore: error.message});
    }
});

/**
 * Aggiorna lo stato di un ticket.
 *
 * L'operazione:
 * - cerca il ticket tramite ObjectId MongoDB;
 * - aggiorna lo stato del ticket;
 * - sincronizza lo stato della segnalazione collegata.
 *
 * @route PATCH /api/v1/ticket/:id/stato
 * @access Private - SuperUser
 */
router.patch('/:id/stato', protectRoute, isSuperUser, async (req, res) => {
    try {
        const {nuovoStato} = req.body;
        const ticket = await TicketManutenzione.findById(req.params.id);
        if (!ticket) {
            return res.status(404).json({errore: 'Ticket non trovato'});
        }
        ticket.stato = nuovoStato;
        await ticket.save();
        if (STATO_SEGNALAZIONE[nuovoStato]) {
            await Segnalazione.findByIdAndUpdate(ticket.segnalazione, {
                statoSegnalazione: STATO_SEGNALAZIONE[nuovoStato]
            });
        }

        res.json({messaggio: 'Stato ticket aggiornato', ticket});
    } catch (err) {
        if (err.name === 'ValidationError') {
            return res.status(400).json({errore: 'Stato ticket non valido'});
        }
        res.status(500).json({errore: 'Errore aggiornamento ticket'});
    }
});

/**
 * Chiude un ticket di manutenzione.
 *
 * L'operazione:
 * - richiede le note di intervento;
 * - imposta il ticket come chiuso;
 * - registra la data di chiusura;
 * - sincronizza la segnalazione come risolta.
 *
 * @route PATCH /api/v1/ticket/:id/chiudi
 * @access Private - SuperUser
 */
router.patch('/:id/chiudi', protectRoute, isSuperUser, async (req, res) => {
    try {
        const {note} = req.body;
        if (!note || !note.trim()) {
            return res.status(400).json({errore: 'Note di intervento obbligatorie'});
        }

        const ticket = await TicketManutenzione.findById(req.params.id);
        if (!ticket) {
            return res.status(404).json({errore: 'Ticket non trovato'});
        }

        ticket.stato = 'chiuso';
        ticket.note = note;
        ticket.dataChiusura = new Date();
        await ticket.save();

        await Segnalazione.findByIdAndUpdate(ticket.segnalazione, {
            statoSegnalazione: 'risolta'
        });

        res.json({messaggio: 'Ticket chiuso senza errori', ticket});
    } catch (error) {
        res.status(500).json({errore: 'Errore chiusura ticket'});
    }
});

/**
 * Archivia un ticket chiuso.
 *
 * L'operazione:
 * - verifica che il ticket esista;
 * - controlla che sia già chiuso;
 * - imposta il ticket come archiviato;
 * - sincronizza la segnalazione come archiviata.
 *
 * @route PATCH /api/v1/ticket/:id/archivia
 * @access Private - SuperUser
 */
router.patch('/:id/archivia', protectRoute, isSuperUser, async (req, res) => {
    try {
        const ticket = await TicketManutenzione.findById(req.params.id);
        if (!ticket) {
            return res.status(404).json({errore: 'Ticket non trovato'});
        }

        if (ticket.stato !== 'chiuso') {
            return res.status(400).json({errore:'Solo i ticket chiusi possono essere archiviati'});
        }
        ticket.stato = 'archiviato';
        await ticket.save();

        await Segnalazione.findByIdAndUpdate(ticket.segnalazione, {
            statoSegnalazione: 'archiviata'
        });

        res.json({messaggio: 'Ticket archiviato', ticket});
    } catch (error) {
        res.status(500).json({errore: 'Errore archiviazione ticket'});
    }
});

module.exports = router;