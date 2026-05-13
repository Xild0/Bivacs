const express = require('express');
const router = express.Router();
const Segnalazione = require('../models/segnalazione');
const upload = require('../config/multer'); // Importiamo la config sopra
const {protectRoute,isAdmin} = require('../middleware/authMiddleware');
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
       // Usiamo una variabile di supporto per estrarre il messaggio
        const errorAsAny = /** @type {any} */ (err);
        const errorMessage = errorAsAny.message || 'Errore sconosciuto';

        // Controlliamo il nome dell'errore usando la variabile "libera" dai vincoli di tipo
        if (errorAsAny.name === 'MulterError') {
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

// Recupera lo storico (Solo archiviate) -  SOLO per il Superuser
router.get('/storico', protectRoute, isAdmin, async (req, res) => {
   try {
        const storico = await Segnalazione.find({ statoSegnalazione: 'archiviata' });
        res.json(storico);
    } catch (err) {
        const errorAsAny = /** @type {any} */ (err);
        res.status(500).json({ message: errorAsAny.message || 'Errore nel recupero dello storico' });
    }
});

// Aggiorna lo stato di una segnalazione
router.patch('/:id/stato', async (req, res) => {
    try {
        const { nuovoStato } = req.body;
        // Verifica che lo stato sia uno di quelli permessi nell'enum
        const statiValidi = ['inviata', 'presa_in_carico', 'in_corso', 'risolta', 'archiviata'];
        if (!statiValidi.includes(nuovoStato)) {
            return res.status(400).json({ message: 'Stato non valido' });
        }
        const segnalazioneAggiornata = await Segnalazione.findByIdAndUpdate(
            req.params.id,
            { statoSegnalazione: nuovoStato },
            { new: true } // Restituisce il documento aggiornato
        );
        if (!segnalazioneAggiornata) {
            return res.status(404).json({ message: 'Segnalazione non trovata' });
        }
        res.json(segnalazioneAggiornata);
    } catch (err) {
        res.status(500).json({ message: 'Errore durante l\'aggiornamento' });
    }
});

module.exports = router;