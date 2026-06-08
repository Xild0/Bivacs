FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

# Avviamo il server Vite indicandogli di accettare connessioni dall'esterno del container
CMD ["npm", "run", "dev", "--", "--host"]