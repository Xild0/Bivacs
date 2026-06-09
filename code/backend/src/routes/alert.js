/**
 * @file alert.js
 * @description Definizione delle API REST per la gestione degli alert
 * di emergenza associati ai bivacchi.
 * Le operazioni di attivazione e revoca sono riservate agli utenti SuperUser.
 */

const express = require('express');
const router = express.Router();
const Alert = require('../models/alert');
const Bivacco = require('../models/bivacco');
const getNextSequence = require('../utils/getNewSequence');
const {protectRoute, isSuperUser} = require('../middlewares/authMiddleware');

/**
 * Attiva un nuovo alert di emergenza per un bivacco.
 *
 * L'operazione:
 * - verifica l'esistenza del bivacco;
 * - controlla che non siano già presenti alert attivi;
 * - crea un nuovo alert;
 * - aggiorna lo stato di emergenza del bivacco;
 * - notifica i client connessi tramite Socket.IO.
 *
 * @route POST /api/v1/alert
 * @access Private (SuperUser)
 */
router.post('/', protectRoute, isSuperUser, async (req, res) => {
    try {
        const {bivaccoId, messaggio} = req.body;
        if (!bivaccoId || !messaggio) {
            return res.status(400).json({errore: 'bivaccoId e messaggio obbligatori'});
        }

        const bivacco = await Bivacco.findById(bivaccoId);
        if (!bivacco) {
            return res.status(404).json({errore: 'Bivacco non trovato'});
        }

        const attivoEsistente = await Alert.findOne({bivacco: bivaccoId, attivo: true});
        if (attivoEsistente) {
            return res.status(409).json({errore: 'Esiste già un alert attivo su questo bivacco'});
        }

        const id = await getNextSequence('alertId');
        const alert = await Alert.create({
            id,
            bivacco: bivaccoId,
            messaggio,
            attivo: true
        });
        await Bivacco.findByIdAndUpdate(bivaccoId, {
            emergenza: true,
            noteEmergenza: messaggio
        });
        const socketServer = req.app.get('socketServer');
        if (socketServer) {
            socketServer.emit('BannerAttivato', {
                bivaccoId: bivacco._id,
                messaggio
            });
        }
        res.status(201).json({messaggio: 'Emergenza attivata', alert});
    } catch (error) {
        res.status(500).json({errore: error.message});
    }
});

/**
 * Revoca l'alert di emergenza attivo associato a un bivacco.
 *
 * L'operazione:
 * - disattiva l'alert corrente;
 * - rimuove lo stato di emergenza del bivacco;
 * - notifica i client connessi tramite Socket.IO.
 *
 * @route PATCH /api/v1/alert/:bivaccoId/revoca
 * @access Private (SuperUser)
 */
router.patch('/:bivaccoId/revoca', protectRoute, isSuperUser, async (req, res) => {
    try {
        const {bivaccoId} = req.params;
        const alert = await Alert.findOne({ bivacco: bivaccoId, attivo: true });
        if (alert) {
            alert.attivo = false;
            await alert.save();
        }
       await Bivacco.findByIdAndUpdate(bivaccoId, {
            emergenza: false,
            noteEmergenza: ''
        });

        const socketServer = req.app.get('socketServer');
        if (socketServer) {
            socketServer.emit('bannerRevocato', {
                bivaccoId
            });
        }
        res.json({messaggio: 'Emergenza revocata'});
    } catch (error) {
        res.status(500).json({errore: 'Errore revoca emergenza'});
    }
});

module.exports = router;