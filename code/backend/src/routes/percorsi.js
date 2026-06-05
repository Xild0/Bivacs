/**
 * @file percorsi.js
 * @description Route Express per la gestione dei percorsi associati ai bivacchi.
 * Espone endpoint per leggere, creare, servire e scaricare percorsi GPX.
 * Include anche la ricerca automatica del tracciato SAT più vicino a un bivacco.
 */

const express = require('express');
const router = express.Router();

const fs = require('fs');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');

const Percorso = require('../models/percorso');
const Bivacco = require('../models/bivacco');
const { protectRoute } = require('../middlewares/authMiddleware');

const GPX_DIR = path.join(__dirname, '../../uploads/gpx');
const MAX_DISTANZA_GPX_METRI = 800;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: ''
});

let gpxCache = null;

/**
 * Estrae un messaggio leggibile da un errore sconosciuto.
 *
 * @param {unknown} err - Errore catturato.
 * @returns {string} Messaggio dell'errore.
 */
function getErrorMessage(err) {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Calcola la distanza in metri tra due coordinate geografiche.
 *
 * @param {number} lat1 - Latitudine del primo punto.
 * @param {number} lon1 - Longitudine del primo punto.
 * @param {number} lat2 - Latitudine del secondo punto.
 * @param {number} lon2 - Longitudine del secondo punto.
 * @returns {number} Distanza in metri.
 */
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => deg * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Estrae i punti geografici da un file GPX.
 * Supporta sia tracciati `trk/trkseg/trkpt` sia rotte `rte/rtept`.
 *
 * @param {string} filePath - Percorso assoluto del file GPX.
 * @returns {Array<{lat: number, lon: number}>} Lista dei punti validi.
 */
function estraiPuntiGpx(filePath) {
  const xml = fs.readFileSync(filePath, 'utf8');
  const data = parser.parse(xml);

  let points = [];

  const trk = data?.gpx?.trk;
  const rte = data?.gpx?.rte;

  if (trk) {
    const tracks = Array.isArray(trk) ? trk : [trk];

    for (const track of tracks) {
      let segments = track.trkseg || [];

      if (!Array.isArray(segments)) {
        segments = [segments];
      }

      for (const segment of segments) {
        let trkpts = segment.trkpt || [];

        if (!Array.isArray(trkpts)) {
          trkpts = [trkpts];
        }

        points.push(...trkpts);
      }
    }
  }

  if (rte?.rtept) {
    const rtepts = Array.isArray(rte.rtept) ? rte.rtept : [rte.rtept];
    points.push(...rtepts);
  }

  return points
    .map((point) => ({
      lat: Number(point.lat),
      lon: Number(point.lon)
    }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon));
}

/**
 * Carica in memoria i file GPX disponibili nella cartella uploads/gpx.
 * La cache evita di rileggere tutti i file a ogni richiesta.
 *
 * @returns {Array<{file: string, filePath: string, points: Array<{lat: number, lon: number}>}>}
 */
function caricaGpxCache() {
  if (gpxCache) {
    return gpxCache;
  }

  const files = fs
    .readdirSync(GPX_DIR)
    .filter((file) => file.toLowerCase().endsWith('.gpx'));

  gpxCache = files
    .map((file) => {
      const filePath = path.join(GPX_DIR, file);

      try {
        const points = estraiPuntiGpx(filePath);

        return {
          file,
          filePath,
          points
        };
      } catch (error) {
        console.warn('GPX non leggibile:', file, getErrorMessage(error));

        return {
          file,
          filePath,
          points: []
        };
      }
    })
    .filter((gpx) => gpx.points.length > 0);

  console.log(`GPX caricati in cache: ${gpxCache.length}`);

  return gpxCache;
}

/**
 * Trova il file GPX più vicino alle coordinate di un bivacco.
 *
 * @param {{latitudine: number, longitudine: number}} bivacco - Bivacco di riferimento.
 * @returns {{file: string, filePath: string, distanza: number}|null} GPX più vicino o null.
 */
function trovaGpxPiuVicino(bivacco) {
  const lat = Number(bivacco.latitudine);
  const lon = Number(bivacco.longitudine);
  const gpxFiles = caricaGpxCache();

  let migliore = null;

  for (const gpx of gpxFiles) {
    let minDist = Infinity;

    for (const point of gpx.points) {
      const distanza = haversine(lat, lon, point.lat, point.lon);

      if (distanza < minDist) {
        minDist = distanza;
      }
    }

    if (!migliore || minDist < migliore.distanza) {
      migliore = {
        file: gpx.file,
        filePath: gpx.filePath,
        distanza: Math.round(minDist)
      };
    }
  }

  return migliore;
}

/**
 * Recupera tutti i percorsi presenti nel database.
 *
 * @route GET /api/v1/percorsi
 */
router.get('/', async (req, res) => {
  try {
    const percorsi = await Percorso.find().populate('bivacco');

    res.status(200).json(percorsi);
  } catch (err) {
    res.status(500).json({
      message: 'Errore caricamento percorsi',
      error: getErrorMessage(err)
    });
  }
});

/**
 * Trova automaticamente il GPX SAT più vicino al bivacco e lo restituisce come file GPX.
 *
 * @route GET /api/v1/percorsi/bivacco/:bivaccoId/auto-gpx
 */
router.get('/bivacco/:bivaccoId/auto-gpx', async (req, res) => {
  try {
    const bivacco = await Bivacco.findById(req.params.bivaccoId);

    if (!bivacco) {
      return res.status(404).json({
        message: 'Bivacco non trovato'
      });
    }

    const migliore = trovaGpxPiuVicino(bivacco);

    if (!migliore) {
      return res.status(404).json({
        message: 'Nessun file GPX disponibile'
      });
    }

    if (migliore.distanza > MAX_DISTANZA_GPX_METRI) {
      return res.status(404).json({
        message: `Nessun GPX SAT abbastanza vicino. Il più vicino è ${migliore.distanza} m.`,
        filePiuVicino: migliore.file,
        distanza: migliore.distanza
      });
    }

    res.setHeader('X-GPX-File', migliore.file);
    res.setHeader('X-GPX-Distance', String(migliore.distanza));
    res.type('application/gpx+xml');
    res.sendFile(migliore.filePath);
  } catch (err) {
    res.status(500).json({
      message: 'Errore ricerca automatica GPX',
      error: getErrorMessage(err)
    });
  }
});

/**
 * Scarica automaticamente il GPX SAT più vicino al bivacco.
 * Endpoint riservato a utenti autenticati.
 *
 * @route GET /api/v1/percorsi/bivacco/:bivaccoId/auto-download
 */
router.get('/bivacco/:bivaccoId/auto-download', protectRoute, async (req, res) => {
  try {
    const bivacco = await Bivacco.findById(req.params.bivaccoId);

    if (!bivacco) {
      return res.status(404).json({
        message: 'Bivacco non trovato'
      });
    }

    const migliore = trovaGpxPiuVicino(bivacco);

    if (!migliore || migliore.distanza > MAX_DISTANZA_GPX_METRI) {
      return res.status(404).json({
        message: 'Nessun GPX SAT disponibile per questo bivacco'
      });
    }

    const nomeBivacco = bivacco.nome
      ? bivacco.nome.replace(/[^a-zA-Z0-9_-]/g, '_')
      : 'percorso_sat';

    res.download(migliore.filePath, `${nomeBivacco}_SAT.gpx`);
  } catch (err) {
    res.status(500).json({
      message: 'Errore download automatico GPX',
      error: getErrorMessage(err)
    });
  }
});

/**
 * Recupera un percorso specifico tramite ObjectId MongoDB.
 *
 * @route GET /api/v1/percorsi/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const percorso = await Percorso.findById(req.params.id)
      .populate('bivacco');

    if (!percorso) {
      return res.status(404).json({
        message: 'Percorso non trovato'
      });
    }

    res.status(200).json(percorso);
  } catch (err) {
    if (err instanceof Error && err.name === 'CastError') {
      return res.status(400).json({
        message: 'ID percorso non valido'
      });
    }

    res.status(500).json({
      message: 'Errore caricamento percorso',
      error: getErrorMessage(err)
    });
  }
});

/**
 * Crea un nuovo percorso associato a un bivacco.
 *
 * @route POST /api/v1/percorsi
 */
router.post('/', async (req, res) => {
  try {
    const nuovoPercorso = new Percorso(req.body);
    const percorsoSalvato = await nuovoPercorso.save();

    res.status(201).json(percorsoSalvato);
  } catch (err) {
    res.status(400).json({
      message: 'Errore creazione percorso',
      error: getErrorMessage(err)
    });
  }
});

/**
 * Serve il file GPX associato a un percorso per la visualizzazione sulla mappa.
 * Endpoint pubblico: non richiede autenticazione.
 *
 * @route GET /api/v1/percorsi/:id/gpx
 */
router.get('/:id/gpx', async (req, res) => {
  try {
    const percorso = await Percorso.findById(req.params.id);

    if (!percorso) {
      return res.status(404).json({
        message: 'Percorso non trovato'
      });
    }

    if (!percorso.gpxFile) {
      return res.status(404).json({
        message: 'Nessun file GPX associato a questo percorso'
      });
    }

    const filePath = path.join(GPX_DIR, percorso.gpxFile);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        message: 'File GPX non trovato sul server'
      });
    }

    res.type('application/gpx+xml');
    res.sendFile(filePath);
  } catch (err) {
    if (err instanceof Error && err.name === 'CastError') {
      return res.status(400).json({
        message: 'ID percorso non valido'
      });
    }

    res.status(500).json({
      message: 'Errore caricamento GPX',
      error: getErrorMessage(err)
    });
  }
});

/**
 * Scarica il file GPX associato a un percorso per la navigazione offline.
 * Endpoint riservato a utenti autenticati.
 *
 * @route GET /api/v1/percorsi/:id/download
 */
router.get('/:id/download', protectRoute, async (req, res) => {
  try {
    const percorso = await Percorso.findById(req.params.id)
      .populate('bivacco');

    if (!percorso) {
      return res.status(404).json({
        message: 'Percorso non trovato'
      });
    }

    if (!percorso.gpxFile) {
      return res.status(404).json({
        message: 'Nessun file GPX associato a questo percorso'
      });
    }

    const filePath = path.join(GPX_DIR, percorso.gpxFile);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        message: 'File GPX non trovato sul server'
      });
    }

    const nomeBivacco = percorso.bivacco?.nome
      ? percorso.bivacco.nome.replace(/[^a-zA-Z0-9_-]/g, '_')
      : 'percorso';

    res.download(filePath, `${nomeBivacco}.gpx`);
  } catch (err) {
    if (err instanceof Error && err.name === 'CastError') {
      return res.status(400).json({
        message: 'ID percorso non valido'
      });
    }

    res.status(500).json({
      message: 'Errore download GPX',
      error: getErrorMessage(err)
    });
  }
});

module.exports = router;