/**
 * @file supporto.js
 * @description Route Express riservate al Supporto Tecnico.
 * Gestisce log API, configurazioni dei provider esterni,
 * modifica/creazione bivacchi e richieste di promozione a Supporto Tecnico.
 */

const express = require('express');
const router = express.Router();

const LogAPI = require('../models/logAPI');
const ConfigAPI = require('../models/configAPI');
const Bivacco = require('../models/bivacco');
const Utente = require('../models/utente');

const { protectRoute } = require('../middlewares/authMiddleware');
const getNextSequence = require('../utils/getNewSequence');
const inviaEmail = require('../utils/emailService');

const Segnalazione = require('../models/segnalazione');
const TicketManutenzione = require('../models/ticketManutenzione');

/**
 * Verifica che l'utente autenticato abbia ruolo SupportoTecnico.
 * Deve essere usato dopo protectRoute.
 *
 * @param {import('express').Request} req - Richiesta HTTP con utente autenticato.
 * @param {import('express').Response} res - Risposta HTTP.
 * @param {import('express').NextFunction} next - Middleware successivo.
 * @returns {void}
 */
function isSupportoTecnico(req, res, next) {
  if (req.utente.discriminator === 'SupportoTecnico') {
    return next();
  }

  return res.status(403).json({
    errore: 'Accesso negato. Solo il Supporto Tecnico può accedere.'
  });
}

/**
 * Recupera gli ultimi log delle chiamate verso API esterne.
 * US38.
 *
 * @route GET /api/v1/supporto/log-api
 * @param {import('express').Request} req - Richiesta HTTP autenticata.
 * @param {import('express').Response} res - Risposta HTTP.
 * @returns {Promise<void>} Lista dei log API ordinati dal più recente.
 */
router.get('/log-api', protectRoute, isSupportoTecnico, async (req, res) => {
  try {
    const logs = await LogAPI.find()
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json(logs);
  } catch (error) {
    res.status(500).json({
      message: 'Errore recupero log API',
      error: error.message
    });
  }
});

/**
 * Recupera la lista delle configurazioni dei provider API esterni.
 * US39.
 *
 * @route GET /api/v1/supporto/config-api
 * @param {import('express').Request} req - Richiesta HTTP autenticata.
 * @param {import('express').Response} res - Risposta HTTP.
 * @returns {Promise<void>} Lista delle configurazioni API.
 */
router.get('/config-api', protectRoute, isSupportoTecnico, async (req, res) => {
  try {
    const configs = await ConfigAPI.find().sort({ provider: 1 });

    res.status(200).json(configs);
  } catch (error) {
    res.status(500).json({
      message: 'Errore recupero configurazioni API',
      error: error.message
    });
  }
});

/**
 * Crea una nuova configurazione per un provider API esterno.
 * US39.
 *
 * @route POST /api/v1/supporto/config-api
 * @param {import('express').Request} req - Richiesta HTTP con provider, baseUrl, enabled e timeoutMs.
 * @param {import('express').Response} res - Risposta HTTP.
 * @returns {Promise<void>} Configurazione creata oppure errore.
 */
router.post('/config-api', protectRoute, isSupportoTecnico, async (req, res) => {
  try {
    const { provider, baseUrl, enabled, timeoutMs } = req.body;

    if (!provider || !baseUrl) {
      return res.status(400).json({
        message: 'provider e baseUrl sono obbligatori'
      });
    }

    const esistente = await ConfigAPI.findOne({ provider });

    if (esistente) {
      return res.status(409).json({
        message: 'Esiste già una configurazione per questo provider'
      });
    }

    const id = await getNextSequence('configApiId');

    const nuovaConfig = await ConfigAPI.create({
      id,
      provider,
      baseUrl,
      enabled: enabled !== undefined ? enabled : true,
      timeoutMs: timeoutMs || 5000
    });

    res.status(201).json(nuovaConfig);
  } catch (error) {
    res.status(500).json({
      message: 'Errore creazione configurazione API',
      error: error.message
    });
  }
});

/**
 * Modifica una configurazione API esistente.
 * US39.
 *
 * @route PATCH /api/v1/supporto/config-api/:id
 * @param {import('express').Request} req - Richiesta HTTP con campi da aggiornare.
 * @param {import('express').Response} res - Risposta HTTP.
 * @returns {Promise<void>} Configurazione aggiornata oppure errore.
 */
router.patch('/config-api/:id', protectRoute, isSupportoTecnico, async (req, res) => {
  try {
    const { baseUrl, enabled, timeoutMs } = req.body;

    const aggiornamenti = {};

    if (baseUrl !== undefined) aggiornamenti.baseUrl = baseUrl;
    if (enabled !== undefined) aggiornamenti.enabled = enabled;
    if (timeoutMs !== undefined) aggiornamenti.timeoutMs = timeoutMs;

    if (Object.keys(aggiornamenti).length === 0) {
      return res.status(400).json({
        message: 'Fornire almeno un campo da aggiornare'
      });
    }

    const configAggiornata = await ConfigAPI.findByIdAndUpdate(
      req.params.id,
      { $set: aggiornamenti },
      { new: true, runValidators: true }
    );

    if (!configAggiornata) {
      return res.status(404).json({
        message: 'Configurazione API non trovata'
      });
    }

    res.status(200).json({
      message: 'Configurazione API aggiornata con successo',
      config: configAggiornata
    });
  } catch (error) {
    res.status(500).json({
      message: 'Errore modifica configurazione API',
      error: error.message
    });
  }
});

/**
 * Modifica i dati tecnici di un bivacco.
 * US40.
 *
 * @route PATCH /api/v1/supporto/bivacchi/:id
 * @param {import('express').Request} req - Richiesta HTTP con campi tecnici da aggiornare.
 * @param {import('express').Response} res - Risposta HTTP.
 * @returns {Promise<void>} Bivacco aggiornato oppure errore.
 */
router.patch('/bivacchi/:id', protectRoute, isSupportoTecnico, async (req, res) => {
  try {
    const {
      nome,
      latitudine,
      longitudine,
      altitudine,
      postiLetto,
      dotazioni,
      zona,
      tipoStruttura,
      acquaPresente,
      legnaDisponibile,
      emergenza
    } = req.body;

    const aggiornamenti = {};

    if (nome !== undefined) aggiornamenti.nome = nome;
    if (latitudine !== undefined) aggiornamenti.latitudine = latitudine;
    if (longitudine !== undefined) aggiornamenti.longitudine = longitudine;
    if (altitudine !== undefined) aggiornamenti.altitudine = altitudine;
    if (postiLetto !== undefined) aggiornamenti.postiLetto = postiLetto;
    if (dotazioni !== undefined) aggiornamenti.dotazioni = dotazioni;
    if (zona !== undefined) aggiornamenti.zona = zona;
    if (tipoStruttura !== undefined) aggiornamenti.tipoStruttura = tipoStruttura;
    if (acquaPresente !== undefined) aggiornamenti.acquaPresente = acquaPresente;
    if (legnaDisponibile !== undefined) aggiornamenti.legnaDisponibile = legnaDisponibile;
    if (emergenza !== undefined) aggiornamenti.emergenza = emergenza;

    if (Object.keys(aggiornamenti).length === 0) {
      return res.status(400).json({
        message: 'Fornire almeno un campo da aggiornare'
      });
    }

    const bivaccoAggiornato = await Bivacco.findByIdAndUpdate(
      req.params.id,
      { $set: aggiornamenti },
      { new: true, runValidators: true }
    );

    if (!bivaccoAggiornato) {
      return res.status(404).json({
        message: 'Bivacco non trovato'
      });
    }

    res.status(200).json({
      message: 'Bivacco aggiornato con successo',
      bivacco: bivaccoAggiornato
    });
  } catch (error) {
    res.status(500).json({
      message: 'Errore modifica bivacco',
      error: error.message
    });
  }
});

/**
 * Crea un nuovo bivacco dal pannello Supporto Tecnico.
 * Estensione della US40.
 *
 * @route POST /api/v1/supporto/bivacchi
 * @param {import('express').Request} req - Richiesta HTTP con dati del nuovo bivacco.
 * @param {import('express').Response} res - Risposta HTTP.
 * @returns {Promise<void>} Bivacco creato oppure errore.
 */
router.post('/bivacchi', protectRoute, isSupportoTecnico, async (req, res) => {
  try {
    const {
      nome,
      latitudine,
      longitudine,
      altitudine,
      postiLetto,
      dotazioni,
      zona,
      tipoStruttura,
      acquaPresente,
      legnaDisponibile,
      emergenza
    } = req.body;

    if (
      !nome ||
      latitudine === undefined ||
      longitudine === undefined ||
      altitudine === undefined ||
      !zona
    ) {
      return res.status(400).json({
        message: 'Campi obbligatori mancanti (nome, latitudine, longitudine, altitudine, zona)'
      });
    }

    const id = await getNextSequence('bivaccoId');

    const nuovoBivacco = await Bivacco.create({
      id,
      nome,
      latitudine: Number(latitudine),
      longitudine: Number(longitudine),
      altitudine: Number(altitudine),
      postiLetto: Number(postiLetto) || 0,
      dotazioni: dotazioni || '',
      zona,
      tipoStruttura: tipoStruttura || 'fisso',
      emergenza: emergenza || false,
      acquaPresente: acquaPresente !== undefined ? acquaPresente : true,
      legnaDisponibile: legnaDisponibile !== undefined ? legnaDisponibile : true
    });

    res.status(201).json({
      message: 'Bivacco creato con successo',
      bivacco: nuovoBivacco
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        message: 'Errore validazione',
        error: error.message
      });
    }

    res.status(500).json({
      message: 'Errore creazione bivacco',
      error: error.message
    });
  }
});

/**
 * Recupera le richieste pendenti di promozione a Supporto Tecnico.
 *
 * @route GET /api/v1/supporto/richieste-supporto
 * @param {import('express').Request} req - Richiesta HTTP autenticata.
 * @param {import('express').Response} res - Risposta HTTP.
 * @returns {Promise<void>} Lista degli utenti con richiesta in attesa.
 */
router.get('/richieste-supporto', protectRoute, isSupportoTecnico, async (req, res) => {
  try {
    const richieste = await Utente.find({
      discriminator: 'UtenteRegistrato',
      'richiestaSupportoTecnico.stato': 'in_attesa'
    }).select('-passwordHash');

    res.status(200).json(richieste);
  } catch (error) {
    res.status(500).json({
      message: 'Errore recupero richieste supporto tecnico',
      error: error.message
    });
  }
});

/**
 * Approva una richiesta di promozione a Supporto Tecnico.
 * Aggiorna il discriminator dell'utente, assegna la matricola e invia una notifica email.
 *
 * @route PATCH /api/v1/supporto/richieste-supporto/:utenteId/approva
 * @param {import('express').Request} req - Richiesta HTTP con id dell'utente.
 * @param {import('express').Response} res - Risposta HTTP.
 * @returns {Promise<void>} Utente aggiornato oppure errore.
 */
router.patch('/richieste-supporto/:utenteId/approva', protectRoute, isSupportoTecnico, async (req, res) => {
  try {
    const utente = await Utente.findById(req.params.utenteId);

    if (!utente) {
      return res.status(404).json({
        message: 'Utente non trovato'
      });
    }

    const matricola = utente.richiestaSupportoTecnico?.matricolaRichiesta || `ST-${utente.id}`;

    /**
     * (TOLLO)
     * aggiornamento "grezzo" bypassando il controllo di mongoose 
     * che impedisce l'aggiornamento dei dati (discriminator in questo caso)
     * tramite il solo comando .save()
     */
    await Utente.collection.updateOne(
      {_id: utente._id},
      {
        $set:{
          discriminator: 'SupportoTecnico',
          matricola, 
          'richiestaSupportoTecnico.stato': 'approvata'
        }
      }
    );

    const aggiornato = await Utente.findById(req.params.utenteId).select('-passwordHash');

    await inviaEmail(
      utente.email,
      'Richiesta Supporto Tecnico approvata',
      `
        <h2>Richiesta approvata</h2>
        <p>La tua richiesta per diventare Supporto Tecnico su Bivacs è stata approvata.</p>
        <p>Effettua nuovamente il login per accedere al pannello tecnico.</p>
      `
    );

    res.status(200).json({
      message: 'Utente promosso a Supporto Tecnico',
      utente: aggiornato
    });
  } catch (error) {
    res.status(500).json({
      message: 'Errore approvazione richiesta',
      error: error.message
    });
  }
});

/**
 * Rifiuta una richiesta di promozione a Supporto Tecnico.
 * Aggiorna lo stato della richiesta e invia una notifica email all'utente.
 *
 * @route PATCH /api/v1/supporto/richieste-supporto/:utenteId/rifiuta
 * @param {import('express').Request} req - Richiesta HTTP con motivoRifiuto opzionale.
 * @param {import('express').Response} res - Risposta HTTP.
 * @returns {Promise<void>} Utente aggiornato oppure errore.
 */
router.patch('/richieste-supporto/:utenteId/rifiuta', protectRoute, isSupportoTecnico, async (req, res) => {
  try {
    const { motivoRifiuto } = req.body;

    const utente = await Utente.findByIdAndUpdate(
      req.params.utenteId,
      {
        $set: {
          'richiestaSupportoTecnico.stato': 'rifiutata'
        }
      },
      { new: true }
    ).select('-passwordHash');

    if (!utente) {
      return res.status(404).json({
        message: 'Utente non trovato'
      });
    }

    await inviaEmail(
      utente.email,
      'Richiesta Supporto Tecnico rifiutata',
      `
        <h2>Richiesta rifiutata</h2>
        <p>La tua richiesta per diventare Supporto Tecnico su Bivacs è stata rifiutata.</p>
        <p>${motivoRifiuto || 'Non è stata indicata una motivazione specifica.'}</p>
      `
    );

    res.status(200).json({
      message: 'Richiesta rifiutata correttamente',
      utente
    });
  } catch (error) {
    res.status(500).json({
      message: 'Errore rifiuto richiesta',
      error: error.message
    });
  }
});

/**
 * @description recupera le richieste per SuperUser
 * @route GET /api/v1/supporto/richieste-superuser
 */
router.get('/richieste-superuser', protectRoute, isSupportoTecnico, async (req, res) => {
  try {
    const richieste = await Utente.find({
      discriminator: 'UtenteRegistrato',
      'richiestaSuperUser.stato': 'in_attesa'
    }).select('-passwordHash');

    res.status(200).json(richieste);
  } catch (error) {
    res.status(500).json({message: 'Errore recupero richieste SuperUser', error: error.message});
  }
});

/**
 * @description approva una richiesta SuperUser
 * @route PATCH /api/v1/supporto/richieste-superuser/:utenteId/approva
 */
router.patch('/richieste-superuser/:utenteId/approva', protectRoute, isSupportoTecnico, async (req, res) => {
  try {
    const utente = await Utente.findById(req.params.utenteId);
    if (!utente) {
      return res.status(404).json({ message: 'Utente non trovato' });
    }
    
    /**
     * (TOLLO)
     * aggiornamento "grezzo" bypassando il controllo di mongoose 
     * che impedisce l'aggiornamento dei dati (discriminator in questo caso)
     * tramite il solo comando .save()
     */
    await Utente.collection.updateOne(
      {_id: utente._id},
      {
        $set:{
          discriminator: 'SuperUser',
          'richiestaSuperUser.stato': 'approvata'
        }
      }
    );

    const aggiornato = await Utente.findById(req.params.utenteId).select('-passwordHash');

    await inviaEmail(
      utente.email,
      'Richiesta SuperUser approvata',
      `<h2>Richiesta approvata</h2>
       <p>Sei stato promosso a SuperUser su Bivacs. Effettua nuovamente il login per accedere al pannello.</p>`
    );

    res.status(200).json({ message: 'Utente promosso a SuperUser', utente: aggiornato });
  } catch (error) {
    res.status(500).json({ message: 'Errore approvazione richiesta', error: error.message });
  }
});

/**
 * @description rifiuta una richiesta di promozione a SuperUser, 
 * aggiorna lo stato e invia una mail all'utente rifiutato
 * @route PATCH /api/v1/supporto/richieste-superuser/:utenteId/rifiuta
 * @param {import('express').Request} req - richiesta HTTP motivoRifiuto (opzionale)
 * @param {import('express').Response} res - risposta HTTP
 * @returns {Promise<void>} utente aggiornato oppure errore
 */
router.patch('/richieste-superuser/:utenteId/rifiuta', protectRoute, isSupportoTecnico, async (req, res) => {
  try {
    const {motivoRifiuto} = req.body;
    const utente = await Utente.findByIdAndUpdate(
      req.params.utenteId,
      {
        $set: {
          'richiestaSuperUser.stato': 'rifiutata'
        }
      },
      { new: true }
    ).select('-passwordHash');
    if (!utente) {
      return res.status(404).json({
        message: 'Utente non trovato'
      });
    }

    await inviaEmail(
      utente.email,
      'Richiesta SuperUser rifiutata',
      `
        <h2>Richiesta rifiutata</h2>
        <p>La tua richiesta per diventare SuperUser su Bivacs è stata rifiutata.</p>
        <p>${motivoRifiuto || 'Non è stata indicata una motivazione specifica.'}</p>
      `
    );

    res.status(200).json({
      message: 'Richiesta rifiutata correttamente',
      utente
    });
  } catch (error) {
    res.status(500).json({
      message: 'Errore rifiuto richiesta',
      error: error.message
    });
  }
});

/**
 * @route GET /api/v1/supporto/segnalazioni
 * @description Recupera la lista delle segnalazioni escludendo quelle archiviate.
 * @returns {Promise<Array>} Array delle segnalazioni.
 */
router.get('/segnalazioni', protectRoute, isSupportoTecnico, async (req, res) => {
    try {
        const segnalazioni = await Segnalazione.find({statoSegnalazione: { $ne: 'archiviata'}})
            .populate('utenteId', 'nome cognome email')
            .populate('bivaccoId', 'nome');
            
        res.status(200).json(segnalazioni);
    } catch (error) {
        res.status(500).json({ errore: 'Errore recupero segnalazioni', dettaglio: error.message });
    }
});

/**
 * @route GET /api/v1/supporto/ticket
 * @description Recupera la coda dei ticket e
 * filtra opzionalmente per escludere i ticket già archiviati
 * @returns {Promise<Array>} Ritorna l'array dei ticket 
 */
router.get('/ticket', protectRoute, isSupportoTecnico, async (req, res) => {
    try {
        const tickets = await TicketManutenzione.find({stato:{$ne:'archiviato'}})
            .populate('segnalazione')
            .sort({priority: -1, dataApertura: 1});
            
        res.status(200).json(tickets);
    } catch (error) {
        res.status(500).json({errore: 'Errore recupero coda ticket', dettaglio: error.message});
    }
});

/**
 * @route POST /api/v1/supporto/ticket
 * @description Genera un nuovo ticket di manutenzione a partire da una segnalazione
 * @param {string} req.body.segnalazioneId - ObjectId della Segnalazione.
 * @param {number} req.body.priorita - Priorità assegnata
 */
router.post('/ticket', protectRoute, isSupportoTecnico, async (req, res) => {
    try {
        const {segnalazioneId, priority} = req.body;
        const idNumerico = await getNextSequence('ticketId');

        const nuovoTicket = new TicketManutenzione({
            id: idNumerico,
            segnalazione: segnalazioneId,
            stato: 'aperto',
            priorita: priority || 5
        });
        await nuovoTicket.save();

        // Passa in automatico allo stato "presa_in_carico"
        await Segnalazione.findByIdAndUpdate(segnalazioneId, {statoSegnalazione: 'presa_in_carico'});

        res.status(201).json(nuovoTicket);
    } catch (error) {
        res.status(500).json({errore: 'Errore durante la creazione del ticket', dettaglio: error.message});
    }
});

/**
 * @route PATCH /api/v1/supporto/ticket/:id/stato
 * @description Aggiorna lo stato di un ticket, se nuovo stato è 'chiuso'
 * compila in automatico la dataChiusura
 * @param {string} req.params.id - ObjectId ticket da aggiornare
 * @param {string} req.body.stato - Nuovo stato
 */
router.patch('/ticket/:id/stato', protectRoute, isSupportoTecnico, async (req, res) => {
  console.log("ID ricevuto:", req.params.id);
  console.log("Body ricevuto:", req.body);
    try {
        const {stato, note} = req.body;
        const updateData = {stato};
        
        if (note) updateData.note = note;
        if (stato === 'chiuso') updateData.dataChiusura = Date.now();
        const ticketAggiornato = await TicketManutenzione.findByIdAndUpdate(
            req.params.id, 
            {$set: updateData}, 
            {new: true, runValidators: true}
        );
        if (!ticketAggiornato) return res.status(404).json({ errore: 'Ticket non trovato' });
        
        res.status(200).json(ticketAggiornato);
    } catch (error) {
        res.status(500).json({ errore: 'Errore aggiornamento ticket', dettaglio: error.message });
    }
});

/**
 * @route PATCH /api/v1/supporto/ticket/:id/archivia
 * @description Archivia un ticket
 * @param {string} req.params.id - ObjectId ticket da archiviare
 */
router.patch('/ticket/:id/archivia', protectRoute, isSupportoTecnico, async (req, res) => {
    try {
        const ticket = await TicketManutenzione.findById(req.params.id);
        if (!ticket) return res.status(404).json({errore: 'Ticket non trovato'});

        // Verifica che lo stato sia chiuso, altrimenti non archivia
        if (ticket.stato !== 'chiuso') {
            return res.status(400).json({ 
                errore: 'Errore: il ticket deve essere CHIUSO per poter essere archiviato' 
            });
        }

        ticket.stato = 'archiviato';
        await ticket.save();

        res.status(200).json({ messaggio: 'Ticket archiviato con successo', ticket });
    } catch (error) {
        res.status(500).json({ errore: 'Errore durante l\'archiviazione', dettaglio: error.message });
    }
});

/**
 * @route GET /api/v1/supporto/segnalazioni/export/csv
 * @description Genera e scarica un file CSV contenente l'intero dataset delle segnalazioni
 * @returns {string} File CSV come stream HTTP
 */
router.get('/segnalazioni/export/csv', protectRoute, isSupportoTecnico, async (req, res) => {
    try {
        const segnalazioni = await Segnalazione.find()        // Recupero tutte le segnalazioni
            .populate('utenteId', 'email')
            .populate('bivaccoId', 'nome')
            .lean();
        if (segnalazioni.length === 0) {
            return res.status(404).json({ errore: 'Nessuna segnalazione presente nel database.' });
        }

        const headers = ['ID Segnalazione', 'Email Utente', 'Nome Bivacco', 'Stato', 'Descrizione', 'Data Creazione'];  //definisco le intestazioni del file
        const csvRows = segnalazioni.map(s => {
            const id = s._id;
            const email = s.utenteId?.email || 'Utente Eliminato/Sconosciuto';
            const bivacco = s.bivaccoId?.nome || 'Bivacco Rimosso';
            const stato = s.statoSegnalazione;
            const descrizione = `"${(s.descrizione || '').replace(/"/g, '""')}"`;               // tolgo le virgolette
            const data = s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '';
            return `${id},${email},${bivacco},${stato},${descrizione},${data}`;
        });

        const csvString = [headers.join(','), ...csvRows].join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="dataset_segnalazioni.csv"');
        
        res.status(200).send(csvString);          // invio il file completo
    } catch (error) {
        res.status(500).json({ errore: 'Errore durante l\'esportazione del dataset', dettaglio: error.message });
    }
});

module.exports = router;