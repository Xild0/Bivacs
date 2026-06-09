/**
 * @file percorsi.test.js
 * @description Test di integrazione per percorsi e GPX (US14, US16).
 * Usa i file GPX reali presenti in uploads/gpx. Se la cartella è vuota,
 * la suite viene saltata automaticamente.
 * Riferimento tabella test D4: TC78-TC83.
 */

const request = require('supertest');
const app = require('../app');
const {
  connectTestDb, closeTestDb, makeToken, listGpxFiles, gpxPoints
} = require('./helpers');
const Bivacco = require('../models/bivacco');
const Percorso = require('../models/percorso');

const gpxFiles = listGpxFiles();
const suite = gpxFiles.length > 0 ? describe : describe.skip;

/**
 * Distanza in metri (Haversine) tra due coordinate.
 */
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

suite('Percorsi e GPX (US14, US16)', () => {
  let token;
  let percorsoConFileId;
  let percorsoSenzaFileId;
  let bivaccoVicinoId;
  let bivaccoLontano; // { lat, lon } oppure null se non trovato

  beforeAll(async () => {
    await connectTestDb();
    token = makeToken({ discriminator: 'UtenteRegistrato' });

    const file = gpxFiles[0];
    const punti = gpxPoints(file);

    // Bivacco "host" per i percorsi
    const host = await Bivacco.create({
      id: 1, nome: 'Bivacco Host', latitudine: punti[0].lat, longitudine: punti[0].lon,
      altitudine: 2000, postiLetto: 2, zona: 'Test'
    });

    // Percorso con file GPX reale
    const p1 = await Percorso.create({
      id: 1, bivacco: host._id, tipo: 'ottimale', gpxFile: file,
      dislivello: 500, lunghezza: 5000, durataStimata: 7200, difficolta: 'E'
    });
    percorsoConFileId = p1._id;

    // Percorso con file mancante sul server
    const p2 = await Percorso.create({
      id: 2, bivacco: host._id, tipo: 'ottimale', gpxFile: '__inesistente__.gpx',
      dislivello: 100, lunghezza: 1000, durataStimata: 1000
    });
    percorsoSenzaFileId = p2._id;

    // Bivacco collocato sul primo punto del tracciato -> sicuramente entro la soglia (800 m)
    const vicino = await Bivacco.create({
      id: 3, nome: 'Bivacco Vicino', latitudine: punti[0].lat, longitudine: punti[0].lon,
      altitudine: 2000, postiLetto: 2, zona: 'Test'
    });
    bivaccoVicinoId = vicino._id;

    // Cerca un punto nel bounding box PAT lontano da OGNI tracciato (>2000 m) per TC81
    const tuttiPunti = gpxFiles.flatMap(f => gpxPoints(f, 150));
    outer:
    for (let lat = 45.65; lat <= 46.55; lat += 0.1) {
      for (let lon = 10.45; lon <= 11.95; lon += 0.1) {
        let min = Infinity;
        for (const p of tuttiPunti) {
          const dd = haversine(lat, lon, p.lat, p.lon);
          if (dd < min) min = dd;
        }
        if (min > 2000) {
          bivaccoLontano = { lat: Number(lat.toFixed(4)), lon: Number(lon.toFixed(4)) };
          break outer;
        }
      }
    }
  });

  afterAll(async () => {
    await closeTestDb();
  });

  test('TC78 - GET /percorsi/:id/gpx restituisce il file GPX', async () => {
    const res = await request(app).get(`/api/v1/percorsi/${percorsoConFileId}/gpx`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/gpx\+xml/);
  });

  test('TC79 - file GPX mancante sul server -> 404', async () => {
    const res = await request(app).get(`/api/v1/percorsi/${percorsoSenzaFileId}/gpx`);
    expect(res.status).toBe(404);
  });

  test('TC80 - auto-gpx restituisce il GPX più vicino con header', async () => {
    const res = await request(app).get(`/api/v1/percorsi/bivacco/${bivaccoVicinoId}/auto-gpx`);
    expect(res.status).toBe(200);
    expect(res.headers['x-gpx-file']).toBeDefined();
    expect(res.headers['x-gpx-distance']).toBeDefined();
  });

  test('TC81 - nessun GPX entro la soglia -> 404', async () => {
    if (!bivaccoLontano) {
      console.warn('TC81 saltato: nessun punto della PAT risulta lontano da tutti i tracciati.');
      return;
    }
    const lontano = await Bivacco.create({
      id: 4, nome: 'Bivacco Lontano',
      latitudine: bivaccoLontano.lat, longitudine: bivaccoLontano.lon,
      altitudine: 2000, postiLetto: 2, zona: 'Test'
    });
    const res = await request(app).get(`/api/v1/percorsi/bivacco/${lontano._id}/auto-gpx`);
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('distanza');
  });

  test('TC82 - download GPX di un percorso (autenticato)', async () => {
    const res = await request(app)
      .get(`/api/v1/percorsi/${percorsoConFileId}/download`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
  });

  test('TC83 - auto-download GPX SAT più vicino (autenticato)', async () => {
    const res = await request(app)
      .get(`/api/v1/percorsi/bivacco/${bivaccoVicinoId}/auto-download`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
  });
});
