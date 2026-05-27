/**
 * @file percorsi.js
 * @description Route Express per la gestione dei percorsi associati ai bivacchi.
 * Espone endpoint per leggere, creare, servire e scaricare percorsi GPX.
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const Percorso = require('../models/percorso');
const { protectRoute } = require('../middlewares/authMiddleware');

const GPX_DIR = path.join(__dirname, '../../uploads/gpx');

/**
 * Recupera tutti i percorsi presenti nel database.
 *
 * @route GET /api/v1/percorsi
 */
router.get('/', async (req, res) => {
    try {
        const percorsi = await Percorso.find().populate('bivacco');
        res.status(200).json(percorsi);
    } catch (error) {
        res.status(500).json({
            message: 'Errore caricamento percorsi',
            error: error.message
        });
    }
});

const { XMLParser } = require('fast-xml-parser')
const Bivacco = require('../models/bivacco')

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: ''
})

const MAX_DISTANZA_GPX_METRI = 800
let gpxCache = null

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const toRad = deg => deg * Math.PI / 180

  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function estraiPuntiGpx(filePath) {
  const xml = fs.readFileSync(filePath, 'utf8')
  const data = parser.parse(xml)

  let points = []

  const trk = data?.gpx?.trk
  const rte = data?.gpx?.rte

  if (trk) {
    const tracks = Array.isArray(trk) ? trk : [trk]

    for (const t of tracks) {
      let segments = t.trkseg || []
      if (!Array.isArray(segments)) segments = [segments]

      for (const seg of segments) {
        let trkpts = seg.trkpt || []
        if (!Array.isArray(trkpts)) trkpts = [trkpts]

        points.push(...trkpts)
      }
    }
  }

  if (rte?.rtept) {
    const rtepts = Array.isArray(rte.rtept) ? rte.rtept : [rte.rtept]
    points.push(...rtepts)
  }

  return points
    .map(p => ({
      lat: Number(p.lat),
      lon: Number(p.lon)
    }))
    .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon))
}

function caricaGpxCache() {
  if (gpxCache) return gpxCache

  const files = fs
    .readdirSync(GPX_DIR)
    .filter(f => f.toLowerCase().endsWith('.gpx'))

  gpxCache = files.map(file => {
    const filePath = path.join(GPX_DIR, file)

    try {
      const points = estraiPuntiGpx(filePath)

      return {
        file,
        filePath,
        points
      }
    } catch (error) {
      console.warn('GPX non leggibile:', file, error.message)

      return {
        file,
        filePath,
        points: []
      }
    }
  }).filter(g => g.points.length > 0)

  console.log(`GPX caricati in cache: ${gpxCache.length}`)

  return gpxCache
}

function trovaGpxPiuVicino(bivacco) {
  const lat = Number(bivacco.latitudine)
  const lon = Number(bivacco.longitudine)

  const gpxFiles = caricaGpxCache()

  let migliore = null

  for (const gpx of gpxFiles) {
    let minDist = Infinity

    for (const p of gpx.points) {
      const d = haversine(lat, lon, p.lat, p.lon)

      if (d < minDist) {
        minDist = d
      }
    }

    if (!migliore || minDist < migliore.distanza) {
      migliore = {
        file: gpx.file,
        filePath: gpx.filePath,
        distanza: Math.round(minDist)
      }
    }
  }

  return migliore
}

/**
 * Trova automaticamente il GPX SAT più vicino al bivacco.
 * Non richiede documenti Percorso nel database.
 *
 * GET /api/v1/percorsi/bivacco/:bivaccoId/auto-gpx
 */
router.get('/bivacco/:bivaccoId/auto-gpx', async (req, res) => {
  try {
    const bivacco = await Bivacco.findById(req.params.bivaccoId)

    if (!bivacco) {
      return res.status(404).json({ message: 'Bivacco non trovato' })
    }

    const migliore = trovaGpxPiuVicino(bivacco)

    if (!migliore) {
      return res.status(404).json({ message: 'Nessun file GPX disponibile' })
    }

    if (migliore.distanza > MAX_DISTANZA_GPX_METRI) {
      return res.status(404).json({
        message: `Nessun GPX SAT abbastanza vicino. Il più vicino è ${migliore.distanza} m.`,
        filePiuVicino: migliore.file,
        distanza: migliore.distanza
      })
    }

    res.setHeader('X-GPX-File', migliore.file)
    res.setHeader('X-GPX-Distance', String(migliore.distanza))
    res.type('application/gpx+xml')
    res.sendFile(migliore.filePath)

  } catch (error) {
    res.status(500).json({
      message: 'Errore ricerca automatica GPX',
      error: error.message
    })
  }
})

/**
 * Download automatico GPX SAT più vicino.
 *
 * GET /api/v1/percorsi/bivacco/:bivaccoId/auto-download
 */
router.get('/bivacco/:bivaccoId/auto-download', protectRoute, async (req, res) => {
  try {
    const bivacco = await Bivacco.findById(req.params.bivaccoId)

    if (!bivacco) {
      return res.status(404).json({ message: 'Bivacco non trovato' })
    }

    const migliore = trovaGpxPiuVicino(bivacco)

    if (!migliore || migliore.distanza > MAX_DISTANZA_GPX_METRI) {
      return res.status(404).json({ message: 'Nessun GPX SAT disponibile per questo bivacco' })
    }

    const nomeBivacco = bivacco.nome
      ? bivacco.nome.replace(/[^a-zA-Z0-9_-]/g, '_')
      : 'percorso_sat'

    res.download(migliore.filePath, `${nomeBivacco}_SAT.gpx`)

  } catch (error) {
    res.status(500).json({
      message: 'Errore download automatico GPX',
      error: error.message
    })
  }
})


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
            return res.status(404).json({ message: 'Percorso non trovato' });
        }

        res.status(200).json(percorso);
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ message: 'ID percorso non valido' });
        }
        res.status(500).json({
            message: 'Errore caricamento percorso',
            error: error.message
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
        const savedPercorso = await nuovoPercorso.save();
        res.status(201).json(savedPercorso);
    } catch (error) {
        res.status(400).json({
            message: 'Errore creazione percorso',
            error: error.message
        });
    }
});

/**
 * Serve il file GPX di un percorso per la visualizzazione del tracciato sulla mappa (US14).
 * Endpoint pubblico: non richiede autenticazione.
 *
 * @route GET /api/v1/percorsi/:id/gpx
 */
router.get('/:id/gpx', async (req, res) => {
    try {
        const percorso = await Percorso.findById(req.params.id);

        if (!percorso) {
            return res.status(404).json({ message: 'Percorso non trovato' });
        }

        if (!percorso.gpxFile) {
            return res.status(404).json({ message: 'Nessun file GPX associato a questo percorso' });
        }

        const filePath = path.join(GPX_DIR, percorso.gpxFile);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: 'File GPX non trovato sul server' });
        }

        res.type('application/gpx+xml');
        res.sendFile(filePath);
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ message: 'ID percorso non valido' });
        }
        res.status(500).json({
            message: 'Errore caricamento GPX',
            error: error.message
        });
    }
});

/**
 * Scarica il file GPX di un percorso per la navigazione offline (US16, RF19).
 * Endpoint riservato a utenti autenticati.
 *
 * @route GET /api/v1/percorsi/:id/download
 */
router.get('/:id/download', protectRoute, async (req, res) => {
    try {
        const percorso = await Percorso.findById(req.params.id).populate('bivacco');

        if (!percorso) {
            return res.status(404).json({ message: 'Percorso non trovato' });
        }

        if (!percorso.gpxFile) {
            return res.status(404).json({ message: 'Nessun file GPX associato a questo percorso' });
        }

        const filePath = path.join(GPX_DIR, percorso.gpxFile);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: 'File GPX non trovato sul server' });
        }

        const nomeBivacco = percorso.bivacco?.nome
            ? percorso.bivacco.nome.replace(/[^a-zA-Z0-9_-]/g, '_')
            : 'percorso';
        const downloadName = `${nomeBivacco}.gpx`;

        res.download(filePath, downloadName);
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ message: 'ID percorso non valido' });
        }
        res.status(500).json({
            message: 'Errore download GPX',
            error: error.message
        });
    }
});

module.exports = router;