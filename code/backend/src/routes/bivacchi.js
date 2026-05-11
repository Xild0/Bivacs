// @ts-nocheck
const express = require('express');
const router = express.Router();
const Bivacco = require('../models/bivacco');
const Percorso = require('../models/percorso');

/*
    GET /api/v1/bivacchi
    Restituisce la lista dei bivacchi con filtri opzionali.
    Copre le user story: US06, US07, US08, US09, US10
 */
router.get('/', async (req, res) => {
    try {
        // estrazione dei parametri dalla query string
        const { nome, zona, altitudineMin, altitudineMax, postiLetto } = req.query;

        // oggetto filtro: viene popolato solo con i parametri presenti nella richiesta
        const filtro = {};

        // US07: ricerca per nome (case-insensitive)
        if (nome) {
            filtro.nome = { $regex: nome, $options: 'i' };
        }

        // US09: filtro per zona geografica (case-insensitive)
        if (zona) {
            filtro.zona = { $regex: zona, $options: 'i' };
        }

        // US08: filtro per range di altitudine
        if (altitudineMin || altitudineMax) {
            filtro.altitudine = {};
            if (altitudineMin) filtro.altitudine.$gte = Number(altitudineMin);
            if (altitudineMax) filtro.altitudine.$lte = Number(altitudineMax);
        }

        // US10:filtro per posti letto minimi disponibili
        if (postiLetto) {
            filtro.postiLetto = { $gte: Number(postiLetto) };
        }

        const bivacchi = await Bivacco.find(filtro).select(
            'nome latitudine longitudine altitudine postiLetto zona dotazioni emergenza acquaPresente legnaDisponibile ultimoCheckStato'
        );

        res.status(200).json(bivacchi);

    } catch (err) {
        res.status(500).json({
            message: 'Errore interno del server',
            error: err.message
        });
    }
});

/*
    POST /api/v1/bivacchi
    Inserisce un nuovo bivacco nel database.
 */
router.post('/', async (req, res) => {
    try {
        // crea una nuova istanza del modello con i dati del body
        const bivacco = new Bivacco({
            nome:              req.body.nome,
            latitudine:        req.body.latitudine,
            longitudine:       req.body.longitudine,
            altitudine:        req.body.altitudine,
            postiLetto:        req.body.postiLetto,
            dotazioni:         req.body.dotazioni,
            zona:              req.body.zona,
            emergenza:         req.body.emergenza         || false,
            acquaPresente:     req.body.acquaPresente     || true,
            legnaDisponibile:  req.body.legnaDisponibile  || true,
        });

        // salvataggio nel database
        const bivaccoSalvato = await bivacco.save();

        res
            .status(201)
            .location('/api/v1/bivacchi/' + bivaccoSalvato._id)
            .json(bivaccoSalvato);

    } catch (err) {
        // ValidationError si verifica quando mancano campi required o i valori non rispettano i vincoli del modello
        if (err.name === 'ValidationError') {
            return res.status(400).json({
                message: 'Dati non validi',
                error: err.message
            });
        }
        res.status(500).json({
            message: 'Errore interno del server',
            error: err.message
        });
    }
});

/*
    GET /api/v1/bivacchi/:id
    Restituisce la scheda completa di un singolo bivacco.
    Copre le user story: US11 e US12
    Il campo emergenza (true/false) indica se è attivo un alert sul bivacco.
 */

router.get('/:id', async (req, res) => {
    try {
        const bivacco = await Bivacco.findById(req.params.id).populate('percorsi');

        if (!bivacco) {
            return res.status(404).json({ message: 'Bivacco non trovato' });
        }

        res.status(200).json(bivacco);

    } catch (err) {
        // CastError si verifica quando l'id passato non è un ObjectId MongoDB valido
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'ID bivacco non valido' });
        }
        res.status(500).json({
            message: 'Errore interno del server',
            error: err.message
        });
    }
});

/*
    GET /api/v1/bivacchi/:id/percorsi
    Restituisce tutti i percorsi associati a un bivacco.
    Copre la user story: US14
    Un bivacco può avere più percorsi (es. ottimale e panoramico).
 */
router.get('/:id/percorsi', async (req, res) => {
    try {
        // prima verifica che il bivacco esista
        const bivacco = await Bivacco.findById(req.params.id);
        if (!bivacco) {
            return res.status(404).json({ message: 'Bivacco non trovato' });
        }

        // recupera tutti i percorsi che hanno questo bivacco come riferimento
        const percorsi = await Percorso.find({ bivacco: req.params.id });

        res.status(200).json(percorsi);

    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'ID bivacco non valido' });
        }
        res.status(500).json({
            message: 'Errore interno del server',
            error: err.message
        });
    }
});

/*
    POST /api/v1/bivacchi/:id/percorsi
    Inserisce un nuovo percorso associato a un bivacco.
    Un bivacco può avere più percorsi (es. ottimale e panoramico). Dopo il salvataggio, 
    l'ObjectId del percorso viene aggiunto all'array percorsi del bivacco corrispondente.
 */
router.post('/:id/percorsi', async (req, res) => {
    try {
        // verifica che il bivacco esista prima di creare il percorso
        const bivacco = await Bivacco.findById(req.params.id);
        if (!bivacco) {
            return res.status(404).json({ message: 'Bivacco non trovato' });
        }

        // crea il percorso collegato al bivacco tramite ObjectId
        const percorso = new Percorso({
            bivacco:       req.params.id,
            tipo:          req.body.tipo          || 'ottimale',
            gpxFile:       req.body.gpxFile,
            dislivello:    req.body.dislivello,
            difficolta:    req.body.difficolta,
            lunghezza:     req.body.lunghezza,
            durataStimata: req.body.durataStimata
        });

        const percorsoSalvato = await percorso.save();

        // aggiorna l'array percorsi del bivacco aggiungendo il nuovo ObjectId
        // $push aggiunge un elemento all'array senza sovrascrivere gli altri
        await Bivacco.findByIdAndUpdate(
            req.params.id,
            { $push: { percorsi: percorsoSalvato._id } }
        );

        res
            .status(201)
            .location('/api/v1/bivacchi/' + req.params.id + '/percorsi/' + percorsoSalvato._id)
            .json(percorsoSalvato);

    } catch (err) {
        if (err.name === 'ValidationError') {
            return res.status(400).json({
                message: 'Dati non validi',
                error: err.message
            });
        }
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'ID bivacco non valido' });
        }
        res.status(500).json({
            message: 'Errore interno del server',
            error: err.message
        });
    }
});
/*
    PATCH /api/v1/bivacchi/:id/risorse
    Permette a un utente di aggiornare lo stato di acqua e legna.
    Inoltre riporta anche la data in cui è avvenuta la segnalazione
    Copre le user story: US16 e US17.
*/
router.patch('/:id/risorse', async (req, res) => {
    try {
        const { id } = req.params;
        const { acquaPresente, legnaDisponibile } = req.body;

        // Creiamo un oggetto con i campi da aggiornare
        const aggiornamenti = {};
        
        // Controlliamo cosa è stato inviato nel body per non sovrascrivere con undefined
        if (acquaPresente !== undefined) aggiornamenti.acquaPresente = acquaPresente;
        if (legnaDisponibile !== undefined) aggiornamenti.legnaDisponibile = legnaDisponibile;
        
        // Aggiorniamo anche la data dell'ultima segnalazione
        aggiornamenti.ultimoCheckStato = Date.now();

        const bivaccoAggiornato = await Bivacco.findByIdAndUpdate(
            id,
            { $set: aggiornamenti },
            { new: true, runValidators: true }
        );

        if (!bivaccoAggiornato) {
            return res.status(404).json({ message: 'Bivacco non trovato' });
        }

        res.status(200).json({
            message: 'Risorse aggiornate con successo',
            data: bivaccoAggiornato
        });

    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'ID bivacco non valido' });
        }
        res.status(500).json({
            message: 'Errore durante l\'aggiornamento delle risorse',
            error: err.message
        });
    }


module.exports = router;