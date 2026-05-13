const express = require('express');
const router = express.Router();
const Segnalazione = require('../models/segnalazione');
const upload = require('../config/multer'); // Importiamo la config sopra

// POST /api/v1/segnalazioni
// 'foto' deve essere il nome del campo nel form del frontend
router.post('/', upload.single('foto'), async (req, res) => {
    try {
        // Se Multer non trova il file, req.file sarà undefined
        if (!req.file) {
            return res.status(400).json({ message: 'La foto è obbligatoria' });
        }

        const nuovaSegnalazione = new Segnalazione({
            id: req.body.id, // O l'ID automatico
            descrizione: req.body.descrizione,
            // SALVIAMO SOLO IL PATH (Sistema Ibrido)
            foto: `/uploads/segnalazioni/${req.file.filename}`,
            statoSegnalazione: 'inviata'
        });

        const salvata = await nuovaSegnalazione.save();
        res.status(201).json(salvata);

   } catch (err) {
        // 1. Risolviamo l'errore 'unknown'
        const errorObject = (err instanceof Error) ? err : new Error('Errore sconosciuto');
        const errorMessage = errorObject.message;

        // 2. Risolviamo l'errore sulla proprietà 'name'
        // Facciamo il cast a <any> per permettere il controllo del nome senza errori di tipo
        if (err && (err).name === 'MulterError') {
            return res.status(400).json({ 
                message: 'Errore nel caricamento del file (Multer)', 
                error: errorMessage 
            });
        }

        res.status(500).json({ 
            message: 'Errore interno nel server', 
            error: errorMessage 
        });
    }
});

module.exports = router;