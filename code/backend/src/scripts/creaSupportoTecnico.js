/**
 * @file creaSupportoTecnico.js
 * @description Script per la creazione dell'account Supporto Tecnico iniziale.
 *
 * L'operazione:
 * - configura i DNS usati da Node.js;
 * - carica le variabili d'ambiente;
 * - si connette al database;
 * - verifica se l'account esiste già;
 * - crea l'account Supporto Tecnico predefinito.
 *
 * Uso:
 * node src/scripts/creaSupportoTecnico.js
 */
const dns = require('dns')
dns.setServers(['8.8.8.8', '1.1.1.1'])

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') })

const bcrypt = require('bcryptjs')
const connectDB = require('../config/db')
const SupportoTecnico = require('../models/supportoTecnico')
const getNextSequence = require('../utils/getNewSequence')

/**
 * Esegue la creazione dell'account Supporto Tecnico iniziale.
 *
 * L'operazione:
 * - apre la connessione al database;
 * - verifica se l'account esiste già;
 * - genera hash della password e id numerico;
 * - crea l'utente SupportoTecnico.
 *
 * @returns {Promise<void>}
 */

async function main() {
  await connectDB()

  const email = 'noreply.bivacs@gmail.com'
  const password = process.env.SUPPORTO_TECNICO_PASSWORD;

  const esistente = await SupportoTecnico.findOne({ email })
  if (esistente) {
    console.log('Supporto tecnico già esistente')
    process.exit(0)
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const id = await getNextSequence('utenteId')

  await SupportoTecnico.create({
    id,
    email,
    passwordHash,
    discriminator: 'SupportoTecnico',
    isVerified: true,
    matricola: 'ST-ADMIN'
})

  console.log('Creato supporto tecnico:')
  console.log('email:', email)

  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})