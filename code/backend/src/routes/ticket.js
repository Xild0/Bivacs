/**
 * @file ticket.js
 * @description Route gestione TicketManutenzione (solo SuperUser)
 */

const express = require('express');
const router = express.Router();
const TicketManutenzione = require('../models/ticketManutenzione');
const Segnalazione = require('../models/segnalazione');
const getNextSequence = require('../utils/getNewSequence');
const {protectRoute, isSuperUser} = require('../middlewares/authMiddleware');

// meglio mappare lo stato ticket in funzione dello stato segnalazione
// in questo modo possiamo far sincronizzare le due cose
const STATO_SEGNALAZIONE = {
    aperto: 'presa_in_carico',
    in_lavorazione: 'in_corso',
    chiuso: 'risolta',
    archiviato: 'archiviata'
};

/**
 *@description lista coda ticket, il frontend li filtrerà per stato
 * @route GET /api/v1/ticket
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
 *@description Crea un ticket (aperto) da una segnalazione (stato cambia)
 * un ticket può avere solo una segnalazione e vicversa
 * @route POST /api/v1/ticket
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
 *@description Aggiorna stato di un ticket e sincronizza segnalazione inerente
 * @route PATCH /api/v1/ticket/:id/stato
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
 *@description chiude un ticket registrando le note di intervento (segnalazione sincronizzata su "risolta")
 * @route PATCH /api/v1/ticket/:id/chiudi
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
 * @description Archivia ticket SOLO se stato è "chiuso"
 * @route PATCH /api/v1/ticket/:id/archivia
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