# Bivacs — Software Engineering Project 2026

**Bivacs** è una piattaforma web per la catalogazione, il monitoraggio e la consultazione dei **bivacchi della Provincia Autonoma di Trento**.

Integra dati geografici, tracciati ufficiali GPX SAT, meteo in tempo reale e previsioni, segnalazioni fotografiche sullo stato delle strutture, recensioni e preferiti, oltre a strumenti riservati a **Supporto Tecnico** e **Super User** per la gestione di ticket di manutenzione, alert di emergenza in tempo reale, configurazione dei servizi esterni ed esportazione dati.

Progetto del gruppo **9** — Corso di Ingegneria del Software, Università di Trento (A.A. 2025/2026).

| Membro | Matricola | GitHub |
|---|---|---|
| Corelli Stefano | 237953 | [@bohSonoSte](https://github.com/bohSonoSte) |
| Gagliardo Giovanna | 242278 | [@giovannagagliardo](https://github.com/giovannagagliardo) |
| Tollardo Giacomo | 242983 | [@Xild0](https://github.com/Xild0) |

---

## Indice

1. [Demo online e perché eseguire in locale](#demo-online-e-perché-eseguire-in-locale)
2. [Account di test](#account-di-test)
3. [Stack tecnologico](#stack-tecnologico)
4. [Struttura della repository](#struttura-della-repository)
5. [Prerequisiti](#prerequisiti)
6. [Avvio in locale (consigliato)](#avvio-in-locale-consigliato)
7. [Variabili dambiente](#variabili-dambiente)
8. [Esecuzione con Docker (opzionale)](#esecuzione-con-docker-opzionale)
9. [Test automatici](#test-automatici)
10. [Documentazione API](#documentazione-api)
11. [Workflow Git del team](#workflow-git-del-team)

---

## Demo online e perché eseguire in locale

Il progetto è deployato su Render (piano gratuito):

- **Frontend:** https://bivacs-frontend.onrender.com
- **Backend / API:** https://bivacs.onrender.com/api/v1

> ⚠️ La demo online ha limiti dovuti al tier gratuito di Render e **non offre l'esperienza completa**:
> - **Cold start:** dopo un periodo di inattività la prima richiesta può richiedere fino a ~1 minuto.
> - **Email disattivate:** Render blocca il traffico SMTP in uscita (porte 25/465/587), quindi verifica account, recupero password e notifiche email non vengono inviate nell'ambiente deployato.
> - **Rate limit meteo:** l'IP condiviso delle istanze gratuite può essere limitato (HTTP 429) da Open-Meteo, con impatto sulle previsioni.
>
> **Per provare l'applicazione completa si consiglia di clonarla ed eseguirla in locale** seguendo le istruzioni sotto: in locale email, meteo e routing funzionano correttamente.

---

## Account di test

Un account già pronto per ogni classe di utenza (utilizzabili sia in locale sia sulla demo, con i limiti sopra):

| Ruolo | Email | Password |
|---|---|---|
| Utente standard | `utenteregistrato.bivacs@gmail.com` | `Bivacs2026!` |
| Supporto Tecnico | `noreply.bivacs@gmail.com` | `Bivacs2026!` |
| Super User | `superuser.bivacs@gmail.com` | `Bivacs2026!` |

I bivacchi sono **già popolati** sul database condiviso: chi prova l'applicazione può consultare, filtrare, recensire e segnalare senza dover inserire dati di base.

---

## Stack tecnologico

**Backend** — Node.js · Express 5 (API REST sotto `/api/v1`) · MongoDB Atlas + Mongoose (con *discriminator* per i ruoli `UtenteRegistrato` / `SupportoTecnico` / `SuperUser`) · Socket.IO (banner di emergenza realtime) · jsonwebtoken (JWT) · bcryptjs · Nodemailer (Gmail SMTP) · Multer (upload immagini, max 5 MB, JPG/PNG/WEBP) · fast-xml-parser (GPX e XML MeteoTrentino) · cors · dotenv.

**Frontend** — Vue 3 + Vite (SPA) · Vue Router · Axios · Leaflet (mappa, marker, tracciati) · Socket.IO client · OpenRouteService (geocoding e routing outdoor lato client).

**Servizi esterni** — MeteoTrentino (provider meteo primario) · Open-Meteo (fallback + previsioni) · OpenRouteService (routing) · Gmail SMTP · Tracciati GPX SAT.

**DevOps / strumenti** — Git e GitHub (Feature Branch Workflow) · npm · Docker · Jest + Supertest + MongoDB Memory Server (test) · SwaggerHub (documentazione API).

---

## Struttura della repository

```
Bivacs/
├── code/
│   ├── backend/              # Server Node.js + Express
│   │   ├── src/
│   │   │   ├── app.js        # Configurazione app Express
│   │   │   ├── index.js      # Entry point (avvio server + Socket.IO)
│   │   │   ├── config/       # db.js (connessione Mongo), multer.js
│   │   │   ├── middlewares/  # authMiddleware (JWT + RBAC)
│   │   │   ├── models/       # Schemi Mongoose (bivacco, utente, segnalazione, ...)
│   │   │   ├── routes/       # Endpoint REST (autenticazione, meteo, ticket, ...)
│   │   │   ├── scripts/      # creaSupportoTecnico.js, verificaPercorsi.js
│   │   │   ├── tests/        # Suite Jest/Supertest (8 suite, 68 test)
│   │   │   └── utils/        # emailService, meteoTrentino, getNewSequence
│   │   ├── uploads/          # gpx/ tracciati SAT (versionati) + segnalazioni/ (runtime)
│   │   ├── package.json
│   │   └── jestConfig.js
│   └── frontend-vue/         # SPA Vue 3 + Vite
│       ├── src/
│       │   ├── App.vue
│       │   ├── main.js
│       │   ├── components/   # BivaccoMap, RouteModal, MeteoPanel, ...
│       │   └── services/api.js
│       ├── public/
│       ├── index.html
│       ├── vite.config.js
│       └── package.json
├── docs/
│   └── openapi.yaml          # Documentazione API (API Blueprint)
├── .gitattributes
├── .gitignore
└── README.md
```

> **Nota sui dati locali.** I file `.env`, le cartelle `node_modules/` e `dist/` e i file Docker sono esclusi dal versioning tramite `.gitignore`: dopo `npm install` devi quindi creare manualmente i `.env` (vedi sotto). I **tracciati GPX SAT** in `uploads/gpx/`, invece, sono già committati nel repository, quindi un clone pulito li riceve e le funzioni di visualizzazione/download tracciato funzionano da subito. La cartella `uploads/segnalazioni/` contiene immagini caricate a runtime dagli utenti: i nuovi upload non vengono versionati.

---

## Prerequisiti

Da installare una sola volta:

- **Git**
- **Node.js LTS** (versione 18 o superiore). Su Windows si consiglia *NVM for Windows*; dopo l'installazione:
  ```bash
  nvm install lts
  nvm use lts
  ```
- *(Opzionale)* **Docker**, solo se preferisci eseguire i container invece di npm.

Non è necessario installare MongoDB in locale: il backend si collega a un cluster **MongoDB Atlas** tramite la variabile `MONGO_URI`.

---

## Avvio in locale (consigliato)

Questo è il percorso multipiattaforma (Windows / Linux / macOS), quello usato dal team via `npm run dev`.

### 1. Clona la repository

```bash
git clone https://github.com/Xild0/Bivacs
cd Bivacs
```

### 2. Avvia il backend

In un primo terminale:

```bash
cd code/backend
npm install
```

Crea il file `code/backend/.env` (vedi [Variabili d'ambiente](#variabili-dambiente)), poi:

```bash
npm run dev
```

Il backend resta in ascolto su **http://localhost:5000**, con le API sotto **http://localhost:5000/api/v1**.

### 3. Avvia il frontend

In un **secondo** terminale:

```bash
cd code/frontend-vue
npm install
```

Crea il file `code/frontend-vue/.env` (vedi sotto), poi:

```bash
npm run dev
```

Il frontend Vite parte su **http://localhost:5173**.

### 4. Apri l'applicazione

Visita **http://localhost:5173** nel browser ed effettua il login con uno degli [account di test](#account-di-test).

> Gli script esatti (`dev`, `start`, `test`) sono definiti nei rispettivi `package.json`.

---

## Variabili d'ambiente

I file `.env` **non sono versionati** (contengono segreti) e vanno creati a mano in locale. Qui sotto i template con **valori segnaposto**: sostituiscili con i valori reali.


### `code/backend/.env`

```env
# Server
PORT=5000

# Database MongoDB Atlas (o istanza locale)
MONGO_URI=mongodb+srv://<utente>:<password>@<cluster>.mongodb.net/bivacs

# Sicurezza
JWT_SECRET=<stringa_segreta_lunga_e_casuale>

# Email transazionali (Gmail + App Password)
EMAIL_USER=<indirizzo_gmail>
EMAIL_PASS=<google_app_password>

# Account staff creati/garantiti all'avvio del backend
SUPPORTO_TECNICO_PASSWORD=<password_supporto_tecnico>
SUPERUSER_EMAIL=<email_superuser>
SUPERUSER_PASSWORD=<password_superuser>
SUPERUSER_ENTE=SAT
SUPERUSER_LIVELLO_AUTH=5

# URL applicazione (CORS, link nelle email, Socket.IO)
BACKEND_URL=http://localhost:5000
FRONTEND_URL=http://localhost:5173
```

### `code/frontend-vue/.env`

```env
# Base delle API REST del backend
VITE_API_BASE=http://localhost:5000/api/v1

# Endpoint Socket.IO (banner di emergenza realtime)
VITE_SOCKET_URL=http://localhost:5000

# OpenRouteService — chiave per geocoding e routing (lato client)
VITE_ORS_API_KEY=<chiave_openrouteservice>
```


---

## Esecuzione con Docker (opzionale)

Percorso usato internamente da un membro del team su Linux. I file Docker (`docker-compose.yaml`, `Dockerfile`) sono **esclusi dal versioning** (`.gitignore`) e mantenuti in locale: se non li trovi nel tuo clone è normale, vanno tenuti localmente.

Con i file Docker presenti e i `.env` configurati:

```bash
docker compose up            # aggiungi --build se sono cambiate le dipendenze
docker compose down          # spegnimento
```

Espone backend su `5000`, frontend su `5173` e un MongoDB locale su `27017`.

---

## Test automatici

La suite di integrazione gira sulle API REST tramite **Jest + Supertest**, usando **MongoDB Memory Server** (database in-memory) e mock dei servizi esterni: **non serve un database reale né configurazione aggiuntiva**.

```bash
cd code/backend
npm test
```

Esito atteso: **8 suite, 68 test, tutti superati**. Coprono consultazione bivacchi, percorsi/GPX, meteo (realtime, sintetico, previsioni, allerte preferiti), recensioni e segnalazioni, ticket e alert di emergenza, esportazione CSV, pannello Supporto Tecnico e workflow dei ruoli.

---

## Documentazione API

- **Online (Apiary):** https://portal.swaggerhub.com/apis/bivacs/bivacsAPI/1.0.0
- **Nel repository:** [`docs/openabi.yaml`](docs/openabi.yaml)

Tutte le API sono esposte sotto il prefisso `/api/v1`.

---

## Workflow Git del team

Sviluppo con **Feature Branch Workflow**: nessun push diretto su `main`, ogni modifica passa da Pull Request revisionata da almeno un altro membro.

1. Allineati a `main`:
   ```bash
   git checkout main
   git pull origin main
   ```
2. Crea un branch dedicato (`feature/...` o `bugfix/...`):
   ```bash
   git checkout -b feature/la-mia-feature
   ```
3. Sviluppa con commit locali (`git add .` → `git commit -m "..."`).
4. A lavoro concluso e testato, apri la PR verso `main`:
   ```bash
   git push origin feature/la-mia-feature
   ```
   Su GitHub apri la Pull Request descrivendo cosa è stato fatto e come testarlo.
5. Dopo l'approvazione, fai il merge (preferibilmente **Squash and merge**) ed elimina il branch:
   ```bash
   git checkout main
   git pull origin main
   git branch -d feature/la-mia-feature
   git fetch --prune
   ```

> ⚠️ Non eseguire mai `git add` sui file `.env`: contengono credenziali e devono restare solo in locale (sono già nel `.gitignore`).
