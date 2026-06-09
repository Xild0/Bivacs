/**
 * @file giacomo.test.js
 * @description Gestione ticket (US32-34), alert di emergenza (US35-36) ed
 * esportazione CSV (US37). Riferimento tabella test D4: TC102-TC118.
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const { connectTestDb, closeTestDb, makeToken } = require('./helpers');
const Bivacco = require('../models/bivacco');
const Segnalazione = require('../models/segnalazione');

let suToken;     // SuperUser
let userToken;   // utente non autorizzato
let bivaccoId;
let segnalazioneId;
let ticketId;

beforeAll(async () => {
  await connectTestDb();
  suToken = makeToken({ discriminator: 'SuperUser' });
  userToken = makeToken({ discriminator: 'UtenteRegistrato' });

  const b = await Bivacco.create({
    id: 1, nome: 'Bivacco Ticket', latitudine: 46.0, longitudine: 11.2,
    altitudine: 2000, postiLetto: 2, zona: 'Test'
  });
  bivaccoId = b._id;

  const s = await Segnalazione.create({
    utenteId: new mongoose.Types.ObjectId(),
    bivaccoId: b._id,
    descrizione: 'Porta del bivacco danneggiata e non chiude',
    statoSegnalazione: 'inviata'
  });
  segnalazioneId = s._id;
});

afterAll(async () => {
  await closeTestDb();
});

describe('Coda ticket (US32)', () => {
  test('TC102 - creazione ticket da segnalazione', async () => {
    const res = await request(app)
      .post('/api/v1/ticket')
      .set('Authorization', `Bearer ${suToken}`)
      .send({ segnalazioneId: String(segnalazioneId) });
    expect(res.status).toBe(201);
    ticketId = res.body.ticket._id;

    const s = await Segnalazione.findById(segnalazioneId);
    expect(s.statoSegnalazione).toBe('presa_in_carico');
  });

  test('TC103 - ticket già esistente -> 409', async () => {
    const res = await request(app)
      .post('/api/v1/ticket')
      .set('Authorization', `Bearer ${suToken}`)
      .send({ segnalazioneId: String(segnalazioneId) });
    expect(res.status).toBe(409);
  });

  test('TC104 - visualizzazione coda ticket', async () => {
    const res = await request(app)
      .get('/api/v1/ticket')
      .set('Authorization', `Bearer ${suToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  test('TC105 - accesso negato a utente non SuperUser -> 403', async () => {
    const res = await request(app)
      .get('/api/v1/ticket')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });
});

describe('Aggiornamento ticket (US33)', () => {
  test('TC106 - aggiornamento stato ticket', async () => {
    const res = await request(app)
      .patch(`/api/v1/ticket/${ticketId}/stato`)
      .set('Authorization', `Bearer ${suToken}`)
      .send({ nuovoStato: 'in_lavorazione' });
    expect(res.status).toBe(200);

    const s = await Segnalazione.findById(segnalazioneId);
    expect(s.statoSegnalazione).toBe('in_corso');
  });

  test('TC107 - stato non valido -> 400', async () => {
    const res = await request(app)
      .patch(`/api/v1/ticket/${ticketId}/stato`)
      .set('Authorization', `Bearer ${suToken}`)
      .send({ nuovoStato: 'pippo' });
    expect(res.status).toBe(400);
  });

  test('TC108 - ticket inesistente -> 404', async () => {
    const res = await request(app)
      .patch('/api/v1/ticket/000000000000000000000000/stato')
      .set('Authorization', `Bearer ${suToken}`)
      .send({ nuovoStato: 'aperto' });
    expect(res.status).toBe(404);
  });
});

describe('Chiusura e archiviazione ticket (US34)', () => {
  test('TC110 - chiusura senza note -> 400', async () => {
    const res = await request(app)
      .patch(`/api/v1/ticket/${ticketId}/chiudi`)
      .set('Authorization', `Bearer ${suToken}`)
      .send({ note: '' });
    expect(res.status).toBe(400);
  });

  test('TC109 - chiusura ticket con note', async () => {
    const res = await request(app)
      .patch(`/api/v1/ticket/${ticketId}/chiudi`)
      .set('Authorization', `Bearer ${suToken}`)
      .send({ note: 'Porta riparata e serratura sostituita' });
    expect(res.status).toBe(200);
    expect(res.body.ticket.stato).toBe('chiuso');

    const s = await Segnalazione.findById(segnalazioneId);
    expect(s.statoSegnalazione).toBe('risolta');
  });

  test('TC111 - archiviazione ticket chiuso', async () => {
    const res = await request(app)
      .patch(`/api/v1/ticket/${ticketId}/archivia`)
      .set('Authorization', `Bearer ${suToken}`);
    expect(res.status).toBe(200);

    const s = await Segnalazione.findById(segnalazioneId);
    expect(s.statoSegnalazione).toBe('archiviata');
  });
});

describe('Alert di emergenza (US35, US36)', () => {
  test('TC112 - attivazione alert', async () => {
    const res = await request(app)
      .post('/api/v1/alert')
      .set('Authorization', `Bearer ${suToken}`)
      .send({ bivaccoId: String(bivaccoId), messaggio: 'Frana sul sentiero di accesso' });
    expect(res.status).toBe(201);

    const b = await Bivacco.findById(bivaccoId);
    expect(b.emergenza).toBe(true);
  });

  test('TC113 - alert già attivo -> 409', async () => {
    const res = await request(app)
      .post('/api/v1/alert')
      .set('Authorization', `Bearer ${suToken}`)
      .send({ bivaccoId: String(bivaccoId), messaggio: 'Altro alert' });
    expect(res.status).toBe(409);
  });

  test('TC114 - dati obbligatori mancanti -> 400', async () => {
    const res = await request(app)
      .post('/api/v1/alert')
      .set('Authorization', `Bearer ${suToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  test('TC115 - revoca alert', async () => {
    const res = await request(app)
      .patch(`/api/v1/alert/${bivaccoId}/revoca`)
      .set('Authorization', `Bearer ${suToken}`);
    expect(res.status).toBe(200);

    const b = await Bivacco.findById(bivaccoId);
    expect(b.emergenza).toBe(false);
  });

  test('TC116 - revoca quando non c\'è alert attivo (idempotente)', async () => {
    const res = await request(app)
      .patch(`/api/v1/alert/${bivaccoId}/revoca`)
      .set('Authorization', `Bearer ${suToken}`);
    expect(res.status).toBe(200);
  });
});

describe('Export CSV segnalazioni (US37)', () => {
  test('TC117 - download CSV (staff)', async () => {
    const res = await request(app)
      .get('/api/v1/supporto/segnalazioni/export/csv')
      .set('Authorization', `Bearer ${suToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/csv/);
    expect(res.text).toContain('ID Segnalazione');
  });

  test('TC118 - accesso negato a utente non staff -> 403', async () => {
    const res = await request(app)
      .get('/api/v1/supporto/segnalazioni/export/csv')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });
});
