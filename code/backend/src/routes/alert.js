/**
 * @file alert.js
 * @description Route per attivazione/revoca alert di emergenza (solo SuperUser)
 */

const express = require('express');
const router = express.Router();
const Alert = require('../models/alert');
const Bivacco = require('../models/bivacco');
const getNextSequence = require('../utils/getNewSequence');
const {protectRoute, isSuperUser} = require('../middlewares/authMiddleware');

/**
 *@description Attiva AlertEmergenza su un bivacco (bivacco.emergenza)
 * SOLO SE non è già presente un alert
 * @route POST /api/v1/alert
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
        await Bivacco.findByIdAndUpdate(bivaccoId, { emergenza: true });

        res.status(201).json({messaggio: 'Emergenza attivata', alert});
    } catch (error) {
        res.status(500).json({errore: error.message});
    }
});

/**
 *@description revoca alert emergenza da un bivacco
 * @route PATCH /api/v1/alert/:bivaccoId/revoca
 */
router.patch('/:bivaccoId/revoca', protectRoute, isSuperUser, async (req, res) => {
    try {
        const {bivaccoId} = req.params;
        const alert = await Alert.findOne({ bivacco: bivaccoId, attivo: true });
        if (alert) {
            alert.attivo = false;
            await alert.save();
        }
        await Bivacco.findByIdAndUpdate(bivaccoId, {emergenza: false});

        res.json({messaggio: 'Emergenza revocata'});
    } catch (error) {
        res.status(500).json({errore: 'Errore revoca emergenza'});
    }
});

module.exports = router;