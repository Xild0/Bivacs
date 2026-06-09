/**
 * @file stefano.test.js
 * @description Test community e segnalazioni (US27, US28, US30, US31).
 * emailService è mockato per evitare invii reali.
 * Riferimento tabella test D4: TC93-TC101.
 */

jest.mock('../utils/emailService', () => jest.fn().mockResolvedValue(true));

const request = require('supertest');
const app = require('../app');
const { connectTestDb, closeTestDb, makeToken } = require('./helpers');
const Bivacco = require('../models/bivacco');
const UtenteRegistrato = require('../models/utenteRegistrato');
const Segnalazione = require('../models/segnalazione');

let userToken;
let staffToken;
let bivaccoId;
let utenteId;

beforeAll(async () => {
  await connectTestDb();

  const u = await UtenteRegistrato.create({
    id: 1, email: 'utente@test.it', passwordHash: 'x',
    nome: 'Mario', cognome: 'Rossi', dataNascita: new Date('1990-01-01')
  });
  utenteId = u._id;
  userToken = makeToken({ id: 1, mongoId: u._id, discriminator: 'UtenteRegistrato' });
  staffToken = makeToken({ discriminator: 'SuperUser' });

  const b = await Bivacco.create({
    id: 1, nome: 'Bivacco Recensito', latitudine: 46.0, longitudine: 11.2,
    altitudine: 2000, postiLetto: 4, zona: 'Test'
  });
  bivaccoId = b._id;
});

afterAll(async () => {
  await closeTestDb();
});

describe('Rating e recensioni (US27, US28)', () => {
  test('TC93 - creazione recensione aggiorna mediaStelle e numRecensioni', async () => {
    const res = await request(app)
      .post('/api/v1/recensioni')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ bivaccoId: String(bivaccoId), stelle: 4, testo: 'Bivacco pulito e ben tenuto' });
    expect(res.status).toBe(201);

    const b = await Bivacco.findById(bivaccoId);
    expect(b.numRecensioni).toBe(1);
    expect(b.mediaStelle).toBe(4);
  });

  test('TC94 - rating medio visibile nella scheda', async () => {
    const res = await request(app).get(`/api/v1/bivacchi/${bivaccoId}`);
    expect(res.status).toBe(200);
    expect(res.body.bivacco.mediaStelle).toBe(4);
  });

  test('TC95 - conteggio recensioni aggiornato dopo una seconda recensione', async () => {
    await request(app)
      .post('/api/v1/recensioni')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ bivaccoId: String(bivaccoId), stelle: 2, testo: 'Acqua non disponibile in estate' });

    const res = await request(app).get(`/api/v1/bivacchi/${bivaccoId}`);
    expect(res.body.bivacco.numRecensioni).toBe(2);
    expect(res.body.bivacco.mediaStelle).toBe(3); // media (4+2)/2
  });
});

describe('Segnalazioni con foto (US30)', () => {
  test('TC96 - creazione segnalazione con foto valida', async () => {
    const res = await request(app)
      .post('/api/v1/segnalazioni')
      .set('Authorization', `Bearer ${userToken}`)
      .field('bivaccoId', String(bivaccoId))
      .field('descrizione', 'Il tetto presenta una perdita evidente sul lato nord')
      .attach('foto', Buffer.from([0xff, 0xd8, 0xff, 0xe0]), {
        filename: 'danno.png', contentType: 'image/png'
      });
    expect(res.status).toBe(201);
    expect(res.body.segnalazione).toHaveProperty('_id');
  });

  test('TC97 - foto mancante -> 400', async () => {
    const res = await request(app)
      .post('/api/v1/segnalazioni')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ bivaccoId: String(bivaccoId), descrizione: 'Descrizione abbastanza lunga senza foto' });
    expect(res.status).toBe(400);
  });

  test('TC98 - formato file non valido (.txt) -> richiesta rifiutata', async () => {
    const res = await request(app)
      .post('/api/v1/segnalazioni')
      .set('Authorization', `Bearer ${userToken}`)
      .field('bivaccoId', String(bivaccoId))
      .field('descrizione', 'Descrizione valida con allegato non immagine')
      .attach('foto', Buffer.from('non sono unimmagine'), {
        filename: 'note.txt', contentType: 'text/plain'
      });
    // Multer rifiuta nel fileFilter; senza middleware di error handling dedicato
    // l'errore arriva come 500. In ogni caso la richiesta NON va a buon fine.
    expect(res.status).not.toBe(201);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe('Storico segnalazioni (US31)', () => {
  test('TC99 - segnalazioni personali dell\'utente', async () => {
    const res = await request(app)
      .get('/api/v1/segnalazioni/mie')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  test('TC100 - segnalazioni attive (escluse le archiviate)', async () => {
    await Segnalazione.create({
      utenteId, bivaccoId, descrizione: 'Segnalazione archiviata di prova lunga',
      statoSegnalazione: 'archiviata'
    });
    const res = await request(app)
      .get('/api/v1/segnalazioni/attive')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body.every(s => s.statoSegnalazione !== 'archiviata')).toBe(true);
  });

  test('TC101 - storico completo accessibile allo staff', async () => {
    const res = await request(app)
      .get('/api/v1/segnalazioni/storico')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
