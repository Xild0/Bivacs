/**
 * @file ruoli.test.js
 * @description Workflow di richiesta e approvazione dei ruoli (refinement D4).
 * emailService è mockato. Riferimento tabella test D4: TC119-TC121.
 */

jest.mock('../utils/emailService', () => jest.fn().mockResolvedValue(true));

const request = require('supertest');
const app = require('../app');
const { connectTestDb, closeTestDb, makeToken } = require('./helpers');
const UtenteRegistrato = require('../models/utenteRegistrato');

let richiedenteToken;   // utente che invia le richieste
let stToken;            // SupportoTecnico che approva
let targetId;           // utente con richiesta in_attesa da approvare

beforeAll(async () => {
  await connectTestDb();

  const richiedente = await UtenteRegistrato.create({
    id: 1, email: 'richiedente@test.it', passwordHash: 'x',
    nome: 'Luca', cognome: 'Verdi', dataNascita: new Date('1992-05-05')
  });
  richiedenteToken = makeToken({ id: 1, mongoId: richiedente._id, discriminator: 'UtenteRegistrato' });

  stToken = makeToken({ discriminator: 'SupportoTecnico' });

  const target = await UtenteRegistrato.create({
    id: 2, email: 'target@test.it', passwordHash: 'x',
    nome: 'Sara', cognome: 'Neri', dataNascita: new Date('1993-03-03'),
    richiestaSupportoTecnico: { stato: 'in_attesa', motivo: 'Voglio aiutare', matricolaRichiesta: '' }
  });
  targetId = target._id;
});

afterAll(async () => {
  await closeTestDb();
});

test('TC119 - richiesta promozione a Supporto Tecnico', async () => {
  const res = await request(app)
    .post('/api/v1/profilo/richiesta-supporto-tecnico')
    .set('Authorization', `Bearer ${richiedenteToken}`)
    .send({ motivo: 'Esperienza tecnica pregressa' });
  expect(res.status).toBe(200);

  const u = await UtenteRegistrato.findOne({ email: 'richiedente@test.it' });
  expect(u.richiestaSupportoTecnico.stato).toBe('in_attesa');
});

test('TC120 - richiesta promozione a SuperUser', async () => {
  const res = await request(app)
    .post('/api/v1/profilo/richiesta-superuser')
    .set('Authorization', `Bearer ${richiedenteToken}`)
    .send({ motivo: 'Sono un volontario SAT' });
  expect(res.status).toBe(200);

  const u = await UtenteRegistrato.findOne({ email: 'richiedente@test.it' });
  expect(u.richiestaSuperUser.stato).toBe('in_attesa');
});

test('TC121 - approvazione richiesta Supporto Tecnico da parte dello staff', async () => {
  const res = await request(app)
    .patch(`/api/v1/supporto/richieste-supporto/${targetId}/approva`)
    .set('Authorization', `Bearer ${stToken}`);
  expect(res.status).toBe(200);
  expect(res.body.utente.discriminator).toBe('SupportoTecnico');
  expect(res.body.utente.matricola).toMatch(/^ST-/);
});
