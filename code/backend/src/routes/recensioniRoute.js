const express = require('express');
const router = express.Router();
const Recensione = require('../models/recensioni');
const Bivacco = require('../models/bivacco');

/* POST /api/v1/recensioni
    Inserisce una nuova recensione (US18, US19, US20)
*/
router.post('/', async (req, res) => {
    try {
        const { bivaccoId, autore, stelle, commento } = req.body;

        // Verifichiamo prima che il bivacco esista davvero
        const bivaccoEsiste = await Bivacco.findById(bivaccoId);
        if (!bivaccoEsiste) {
            return res.status(404).json({ message: 'Bivacco non trovato' });
        }

        const nuovaRecensione = new Recensione({
            bivaccoId,
            autore: autore || 'Escursionista Anonimo', // Gestisce US20
            stelle,
            commento
        });

        const recensioneSalvata = await nuovaRecensione.save();
        res.status(201).json(recensioneSalvata);

    } catch (err) {
        // Controllo del tipo per evitare l'errore "unknown"
        const errorMessage = (err instanceof Error) ? err.message : 'Errore sconosciuto';
        
        res.status(400).json({ 
            message: 'Errore creazione recensione', 
            error: errorMessage 
        });
    }
});

/* GET /api/v1/recensioni/:bivaccoId
    Recupera tutte le recensioni di un bivacco specifico
*/
router.get('/:bivaccoId', async (req, res) => {
    try {
        const recensioni = await Recensione.find({ bivaccoId: req.params.bivaccoId }).sort({ createdAt: -1 }); // Le più recenti prima
        res.status(200).json(recensioni);
    } catch (err) {
        
        const errorMessage = (err instanceof Error) ? err.message : 'Errore sconosciuto';
        
        res.status(400).json({ 
            message: 'Errore nel recupero recensioni', 
            error: errorMessage 
        });
    }
});

module.exports = router;