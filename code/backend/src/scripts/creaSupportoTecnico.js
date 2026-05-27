const dns = require('dns')
dns.setServers(['8.8.8.8', '1.1.1.1'])

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') })

const bcrypt = require('bcryptjs')
const connectDB = require('../config/db')
const SupportoTecnico = require('../models/supportoTecnico')
const getNextSequence = require('../utils/getNewSequence')

async function main() {
  await connectDB()

  const email = 'noreply.bivacs@gmail.com'
  const password = 'Bivacs2026!'

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
  console.log('password:', password)

  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})