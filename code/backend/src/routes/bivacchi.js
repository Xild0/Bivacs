/**
 * @file bivacchi.js
 * @description API REST per la gestione dei bivacchi.
 *
 * Include:
 * - ricerca e filtro dei bivacchi;
 * - dettaglio di un bivacco;
 * - creazione ed eliminazione;
 * - percorsi associati;
 * - aggiornamento delle risorse utili;
 * - gestione delle emergenze.
 */

const express = require('express');
const router = express.Router();

const Bivacco = require('../models/bivacco');
const RisorseUtili = require('../models/risorseUtili');
const Percorso = require('../models/percorso');
const Segnalazione = require('../models/segnalazione');
const {protectRoute, isSuperUser} = require('../middlewares/authMiddleware');
const Alert = require('../models/alert');
const TicketManutenzione = require('../models/ticketManutenzione');
const getNextSequence = require ('../utils/getNewSequence');

/**
 * Estrae un messaggio leggibile da un errore sconosciuto.
 *
 * @param {unknown} err - Errore catturato nel blocco catch.
 * @returns {string} Messaggio dell'errore.
 */
const getErrorMessage = (err) =>
  err instanceof Error ? err.message : String(err);

/**
 * Recupera la lista dei bivacchi.
 *
 * Supporta filtri opzionali per:
 * - nome;
 * - zona;
 * - altitudine minima e massima;
 * - numero minimo di posti letto;
 * - tipo di struttura.
 *
 * @route GET /api/v1/bivacchi
 * @access Public
 */
router.get('/', async (req, res) => {
  try {
    const {
      nome,
      zona,
      altitudineMin,
      altitudineMax,
      postiLetto,
      tipoStruttura
    } = req.query;

    const filtri = {};

    if (nome) {
      filtri.nome = {
        $regex: nome,
        $options: 'i'
      };
    }

    if (zona) {
      filtri.zona = {
        $regex: zona,
        $options: 'i'
      };
    }

    if (altitudineMin || altitudineMax) {
      filtri.altitudine = {};

      if (altitudineMin) {
        filtri.altitudine.$gte = Number(altitudineMin);
      }

      if (altitudineMax) {
        filtri.altitudine.$lte = Number(altitudineMax);
      }
    }

    if (postiLetto) {
      filtri.postiLetto = {
        $gte: Number(postiLetto)
      };
    }

    if (tipoStruttura) {
      filtri.tipoStruttura = tipoStruttura;
    }

    const bivacchi = await Bivacco.find(filtri);

    res.status(200).json(bivacchi);
  } catch (err) {
    res.status(500).json({
      message: 'Errore recupero bivacchi',
      error: getErrorMessage(err)
    });
  }
});

/**
 * Recupera tutte le emergenze attive.
 *
 * Restituisce la lista degli alert ancora attivi,
 * includendo il nome del bivacco associato.
 *
 * @route GET /api/v1/bivacchi/emergenze_attive
 * @access Public
 */
router.get('/emergenze_attive', async (req,res) => {
  try{
    const alerts = await Alert.find({attivo:true}).populate('bivacco', 'nome');
    res.status(200).json(alerts);
  } catch (error){
    res.status(500).json({error: 'Errore interno del server'});
  }
});

/**
 * Recupera la scheda dettagliata di un bivacco.
 *
 * La risposta include:
 * - dati del bivacco;
 * - percorsi associati;
 * - segnalazioni attive;
 * - ticket di manutenzione;
 * - ultimo aggiornamento su acqua e legna.
 *
 * @route GET /api/v1/bivacchi/:id
 * @access Public
 */
router.get('/:id', async (req, res) => {
  try {
    const bivacco = await Bivacco.findById(req.params.id).populate('percorsi');

    if (!bivacco) {
      return res.status(404).json({
        message: 'Bivacco non trovato'
      });
    }

    const segnalazioni = await Segnalazione.find({
      bivaccoId: bivacco._id
    });

    const segnalazioniIds = segnalazioni.map((segnalazione) => segnalazione._id);

    const ticketManutenzione = await TicketManutenzione.find({
      segnalazione: { $in: segnalazioniIds }
    })
      .populate('segnalazione', 'descrizione statoSegnalazione')
      .sort({ createdAt: -1 });

    const statiAttivi = ['inviata', 'presa_in_carico', 'in_corso'];

    const numeroSegnalazioniAttive = segnalazioni.filter((segnalazione) =>
      statiAttivi.includes(segnalazione.statoSegnalazione)
    ).length;

    const ultimeRisorse = await RisorseUtili.findOne({
      bivacco: bivacco._id
    })
      .sort({ createdAt: -1 })
      .populate('autore', 'email lingua');

    const bivaccoObj = bivacco.toObject();

    bivaccoObj.ticketAperti = numeroSegnalazioniAttive > 0;
    bivaccoObj.numeroTicketAperti = numeroSegnalazioniAttive;

    res.status(200).json({
      bivacco: bivaccoObj,
      ticketManutenzione,
      risorse: ultimeRisorse || {
        acqua: 'non_verificata',
        legna: 'non_verificata',
        messaggio: 'Nessun aggiornamento recente disponibile'
      }
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'CastError') {
      return res.status(400).json({
        message: 'ID bivacco non valido'
      });
    }

    res.status(500).json({
      message: 'Errore nel recupero della scheda del bivacco',
      error: getErrorMessage(err)
    });
  }
});

/**
 * Crea un nuovo bivacco.
 *
 * L'operazione:
 * - valida i campi obbligatori;
 * - verifica che l'id numerico non sia già presente;
 * - salva il bivacco nel database.
 *
 * @route POST /api/v1/bivacchi
 * @access Public
 */
router.post('/', async (req, res) => {
  try {
    const {
      id,
      nome,
      latitudine,
      longitudine,
      altitudine,
      postiLetto,
      dotazioni,
      zona,
      tipoStruttura,
      emergenza,
      acquaPresente,
      legnaDisponibile
    } = req.body;

    if (
      id === undefined ||
      !nome ||
      latitudine === undefined ||
      longitudine === undefined ||
      altitudine === undefined ||
      !zona
    ) {
      return res.status(400).json({
        message: 'Campi obbligatori mancanti'
      });
    }

    const bivaccoEsistente = await Bivacco.findOne({ id });

    if (bivaccoEsistente) {
      return res.status(409).json({
        message: 'Esiste già un bivacco con questo id'
      });
    }

    const nuovoBivacco = new Bivacco({
      id,
      nome,
      latitudine,
      longitudine,
      altitudine,
      postiLetto: postiLetto || 0,
      dotazioni: dotazioni || '',
      zona,
      tipoStruttura: tipoStruttura || 'fisso',
      emergenza: emergenza || false,
      acquaPresente: acquaPresente !== undefined ? acquaPresente : true,
      legnaDisponibile: legnaDisponibile !== undefined ? legnaDisponibile : true
    });

    const bivaccoSalvato = await nuovoBivacco.save();

    res.status(201).json(bivaccoSalvato);
  } catch (err) {
    if (err instanceof Error && err.name === 'ValidationError') {
      return res.status(400).json({
        message: 'Errore validazione',
        error: getErrorMessage(err)
      });
    }

    res.status(500).json({
      message: 'Errore creazione bivacco',
      error: getErrorMessage(err)
    });
  }
});

/**
 * Elimina un bivacco.
 *
 * L'operazione cerca il bivacco tramite ObjectId MongoDB
 * e lo rimuove dal database.
 *
 * @route DELETE /api/v1/bivacchi/:id
 * @access Public
 */
router.delete('/:id', async (req, res) => {
  try {
    const bivaccoEliminato = await Bivacco.findByIdAndDelete(req.params.id);

    if (!bivaccoEliminato) {
      return res.status(404).json({
        message: 'Bivacco non trovato'
      });
    }

    res.status(200).json({
      message: 'Bivacco eliminato correttamente'
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'CastError') {
      return res.status(400).json({
        message: 'ID bivacco non valido'
      });
    }

    res.status(500).json({
      message: 'Errore eliminazione bivacco',
      error: getErrorMessage(err)
    });
  }
});

/**
 * Recupera i percorsi associati a un bivacco.
 *
 * L'operazione:
 * - verifica che il bivacco esista;
 * - restituisce tutti i percorsi collegati.
 *
 * @route GET /api/v1/bivacchi/:id/percorsi
 * @access Public
 */
router.get('/:id/percorsi', async (req, res) => {
  try {
    const bivacco = await Bivacco.findById(req.params.id);

    if (!bivacco) {
      return res.status(404).json({
        message: 'Bivacco non trovato'
      });
    }

    const percorsi = await Percorso.find({
      bivacco: req.params.id
    });

    res.status(200).json(percorsi);
  } catch (err) {
    if (err instanceof Error && err.name === 'CastError') {
      return res.status(400).json({
        message: 'ID bivacco non valido'
      });
    }

    res.status(500).json({
      message: 'Errore recupero percorsi',
      error: getErrorMessage(err)
    });
  }
});

/**
 * Aggiorna lo stato delle risorse utili di un bivacco.
 *
 * L'operazione:
 * - salva un nuovo aggiornamento storico;
 * - collega l'autore autenticato;
 * - sincronizza acqua e legna nel documento Bivacco.
 *
 * @route POST /api/v1/bivacchi/:id/risorse
 * @access Private
 */
router.post('/:id/risorse', protectRoute, async (req, res) => {
  try {
    const { acqua, legna } = req.body;
    const bivaccoId = req.params.id;
    const utenteId = req.utente.mongoId;

    if (!acqua || !legna) {
      return res.status(400).json({
        message: 'I campi "acqua" e "legna" sono obbligatori.'
      });
    }

    const nuovaRisorsa = new RisorseUtili({
      id: Date.now(),
      bivacco: bivaccoId,
      autore: utenteId,
      acqua,
      legna
    });

    await nuovaRisorsa.save();

    const acquaPresente = acqua === 'disponibile' || acqua === 'scarsa';
    const legnaDisponibile = legna === 'disponibile' || legna === 'scarsa';

    const bivaccoAggiornato = await Bivacco.findByIdAndUpdate(
      bivaccoId,
      {
        $set: {
          acquaPresente,
          legnaDisponibile,
          ultimoCheckStato: Date.now()
        }
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!bivaccoAggiornato) {
      return res.status(404).json({
        message: 'Bivacco non trovato'
      });
    }

    res.status(201).json({
      message: 'Stato risorse aggiornato con successo e salvato nella cronologia',
      risorse: nuovaRisorsa,
      bivacco: bivaccoAggiornato
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'CastError') {
      return res.status(400).json({
        message: 'ID bivacco non valido'
      });
    }

    res.status(500).json({
      message: 'Errore aggiornamento risorse',
      error: getErrorMessage(err)
    });
  }
});

/**
 * Attiva lo stato di emergenza per un bivacco.
 *
 * L'operazione:
 * - aggiorna il campo emergenza;
 * - crea un alert attivo;
 * - notifica i client collegati tramite Socket.IO.
 *
 * @route POST /api/v1/bivacchi/:id/emergenza
 * @access Private - SuperUser
 */

router.post('/:id/emergenza', protectRoute, isSuperUser, async (req,res) => {
  try {
    const {note} = req.body;
    const bivaccoId = req.params.id;

    const bivacco = await Bivacco.findOneAndUpdate(
      { id: Number(bivaccoId) }, 
      { emergenza: true }, 
      { new: true }
    );

    if (!bivacco){
      return res.status(404).json({error:'Bivacco non trovato'});
    }
    
    const newAlertId = await getNextSequence('alertId');
    const newAlert = new Alert ({
      id : newAlertId,
      bivacco: bivacco._id,
      messaggio: note || 'Allerta di emergenza attiva! Prestare attenzione.',
      attivo: true
    });
    await newAlert.save();

    const socketServer = req.app.get('socketServer');
    if(socketServer){
      socketServer.emit('BannerAttivato', {
        bivaccoId: bivacco.id,
        messaggio: newAlert.messaggio
      });
    }

    res.status(201).json({
      success: true, 
      message: 'Stato di emergenza attivato con successo',
      bivacco
    });
  } catch(error){
    console.error("Errore attivazione emergenza:", getErrorMessage(error));
    res.status(500).json({error: 'Errore interno del server'});
  }
});

/**
 * Revoca lo stato di emergenza di un bivacco.
 *
 * L'operazione:
 * - disattiva l'emergenza;
 * - revoca l'alert attivo associato;
 * - notifica i client collegati tramite Socket.IO.
 *
 * @route DELETE /api/v1/bivacchi/:id/revoca-emergenza
 * @access Private - SuperUser
 */
router.delete('/:id/revoca-emergenza', protectRoute, isSuperUser, async (req, res) => {
  try {
    const bivaccoId = req.params.id;
    const bivacco = await Bivacco.findOneAndUpdate(
      { id: Number(bivaccoId) }, 
      { emergenza: false }, 
      { new: true }
    );

    if(!bivacco){
      return res.status(404).json({error:'Bivacco non trovato'});
    }

    const alertTrue = await Alert.findOne({bivacco:bivacco._id, attivo: true});
    if(alertTrue){
      await alertTrue.revoca();
    }

    const socketServer = req.app.get('socketServer');
    if(socketServer){
      socketServer.emit('bannerRevocato', {bivaccoId: bivacco.id});
    }

    res.status(200).json({success:true, message:'Banner revocato con successo'});
  } catch(error){
    console.error('Errore revoca emergenza:', getErrorMessage(error));
    res.status(500).json({error:'Errore interno del server'});
  }
});

module.exports = router;