# Software Engineering Project 2026 - Bivacs
Bivacs è una piattaforma per rivoluzionare la sicurezza e la gestione dei bivacchi in Trentino attraverso mappe e tracciati ufficiali, il loro download preventivo in locale, monitoraggio della posizione GPS e, tramite API meteo, previsioni metereologiche e allerte meteo o rischi idrogeologici.

---

## Struttura attuale della repository: 
### File di configurazione
* `.gitignore`: dice a Git quali file non caricare mai su GitHub, serve per evitare di caricare cartelle pesanti o file contenenti password e chiavi segrete
* `.gitattributes`: risolve il problema dei line endings tra windows e linux (per avere codice runnabile multipiattaforma) 
* `README.md`: questo documento aggiornabile per mantenere tutta la struttura e il file corretti e chiari

### Cartella code/
Contiene tutto il codice del progetto, al momento ospita altre due cartelle: backend/ e frontend/

### Cartella backend/ 
Cuore del server Node.js
* `package.json`: contiene l'elenco di tutte le librerie necessarie per far girare il progetto e gli script rapidi per avviare il server
* `package-lock.json`: garantisce che le librerie abbiano le stesse versioni scaricabili da tutti gli utenti evitando bug

### Cartella src/
* `index.js`: file principale che avvia il server Express e lo mette in ascolto delle richieste
* `config/`: contiene i file di configurazione di base
* `models/`: conterrà gli schemi Mongoose del diagramma delle classi
* `routes/`: definiremo qui dentro gli endpoint (URL) delle API 
* `controllers/`: logica del codice

--- 

## Guida rapida Git 
0. **Prerequisiti (da fare solo la prima volta)**: assicuratevi di avere installato Git, Node.js e VS Code. Per Node.js installate *NVM-Windows* e, una volta installato, aprite il terminale e digitate `nvm install lts` seguito `nvm use lts` per usare l'ultima versione stabile.
1. **Clonare la repository**: `git clone https://github.com/Xild0/Bivacs`
2. **Entrate nella cartella backend per installare le dipendenze**: dentro la cartella code/backend lanciate questo comando `npm install`


--- 

## Regole d'oro
1. Mai lavorare tutti sul ramo `main`. Quando dobbiamo creare una nuova funzionalità, creiamo un nuovo branch, facciamo i commit li e poi apriamo una Pull Request du GitHub
2. File `.env`: quando creeremo il database o useremo chiavi segrete, ognuno dovrà creare un file chiamato `.env` dentro code/backend. **NON FATE MAI** `git add .env`, questo file deve rimanere strettamente locale sui nostri pc.
