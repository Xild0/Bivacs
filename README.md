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
3. Quando creeremo il database o useremo chiavi segrete, ognuno dovrà creare un file chiamato `.env` dentro code/backend. 
**NON FATE MAI** `git add .env`, questo file deve rimanere strettamente locale sui nostri pc, ma se dalla cartella origin farete `git add .` non ci saranno problemi in quanto ho inserito dentro `.gitignore` un comando per ignorare il file .env


--- 

## Workflow di sviluppo Git / GitHub (AGGIORNATO) 

**Feature Branch Workflow** 
Non facciamo push diretto sul branch `main`; tutte le modifiche devono passare tramite Pull Request (PR) **solo quando l'implementazione è completa e testata**.

### Nomenclatura dei Branch
Creiamo sempre un nuovo branch a partire dall'ultima versione di `main` con un titolo pari ad uno dei seguenti prefissi per categorizzare il lavoro:
* `feature/nome-funzionalita` (per nuove implementazioni)
* `bugfix/nome-del-bug` (per la risoluzione di problemi)

### Operazioni: 

1. Assicurarsi di avere l'ultima versione stabile prima di modificare il codice:
* `git checkout main`
* `git pull origin main`

2. Creare il proprio branch di lavoro:
* `git checkout -b feature/la-mia-nuova-feature`

3. Sviluppare il codice con **commit locali**:
* `git add .`
* `git commit -m "commento"`

4. Apri la pull request **solo a lavoro concluso**: 
quando la funzionalità è completamente finita e testata (vale a dire nessun errore in esecuzione della webapp), eseguire i seguenti comandi: 
* `git push origin <nome branch>`
* Su GitHub aprire una pull request verso il branch `main`.
* Nel corpo della pull request, descrivere brevemente cosa è stato fatto, come testarlo e se ci sono dipendenze particolari.

5. Revisione e Merge:
* Una volta approvata la pull request, eseguire il merge su GitHub utilizzando preferibilmente l'opzione **Squash and merge**, questo manterrà il `main` pulito con un solo commit per l'intera funzionalità.
* **Elimina il branch** dopo il merge: 
    * **Su GitHub:** subito dopo aver fatto il merge, comparirà automaticamente un pulsante con scritto **"Delete branch"**
    * **In locale:** scarica il codice appena unito e cancella il vecchio branch di lavoro con questi comandi:
    ``` bash
    git checkout main
    git pull origin main
    git branch -d <nome branch>
    
    # Consigliato: pulisce l'elenco dei branch remoti obsoleti sul tuo PC
    git fetch --prune
    ```

6. Aggiornamento locale
Dopo che la pull request è stata unita al `main`, tornare al punto 1 per avere l'ultima versione del codice
    

