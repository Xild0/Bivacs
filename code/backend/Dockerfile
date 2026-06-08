FROM node:18-alpine

WORKDIR /app

# Copiamo i file di gestione pacchetti e installiamo tutto ISOLATI nel container
COPY package*.json ./
RUN npm install

# Copiamo il resto del codice del backend
COPY . .

EXPOSE 3000

# Avviamo in modalità sviluppo (utilizza nodemon per rinfrescare l'app a ogni tua modifica)
CMD ["npm", "run", "dev"]