# Easy Esports Bot 🎮

Bot de Discord para el clan Easy Esports con sistema de tickets y economía virtual con juegos de casino.

## Características ✨

### Sistema de Tickets
- 📋 Tickets de reclutamiento
- 🎫 Tickets de soporte
- 📝 Logging automático en canal específico

### Economía Virtual
- 💰 Sistema de monedas
- 🎁 Recompensa diaria (/daily)
- 📊 Tabla de clasificación (/leaderboard)
- 🎮 Perfil de usuario con estadísticas

### Juegos de Casino 🎰
- 🃏 **Blackjack** - Juega al 21 con animaciones
- 🪙 **Coinflip** - Cara o cruz
- 🎲 **Dados** - Tira 2 dados
- 🎡 **Ruleta** - Apuesta a rojo/negro/números
- ✊ **Piedra/Papel/Tijera** - Contra el bot
- 🔢 **Adivina el Número** - 1-100 con pistas
- 📊 **Higher or Lower** - Sistema de rachas

### Comandos de Admin
- 💎 `/add-coins` - Agregar monedas a usuarios
- 💸 `/remove-coins` - Remover monedas de usuarios

## Instalación 🚀

### Requisitos
- Node.js v16 o superior
- Una aplicación de Discord Bot

### Configuración Local

1. Clona el repositorio:
```bash
git clone <tu-repo-url>
cd Easy-Tickets-Bot
```

2. Instala las dependencias:
```bash
npm install
```

3. Crea un archivo `.env` basado en `.env.example`:
```env
TOKEN=tu_token_de_discord
CLIENT_ID=tu_client_id
GUILD_ID=tu_guild_id
```

4. Registra los comandos:
```bash
node register.js
```

5. Inicia el bot:
```bash
npm start
```

## Despliegue en Railway 🚂

1. Crea una cuenta en [Railway](https://railway.app)
2. Conecta tu repositorio de GitHub
3. Agrega las variables de entorno:
   - `TOKEN`
   - `CLIENT_ID`
   - `GUILD_ID`
4. Railway detectará automáticamente el `package.json` y ejecutará `npm start`

## Estructura del Proyecto 📁

```
Easy-Tickets-Bot/
├── index.js          # Bot principal con toda la lógica
├── register.js       # Registro de comandos slash
├── package.json      # Dependencias y scripts
├── .env             # Variables de entorno (no subir a git)
├── tickets.json     # Base de datos de tickets
└── economy.json     # Base de datos de economía
```

## Comandos Disponibles 📝

### Economía
- `/balance` - Ver tu balance
- `/daily` - Reclamar recompensa diaria (500 🪙)
- `/leaderboard` - Ver tabla de clasificación
- `/give` - Transferir monedas a otro usuario

### Juegos
- `/blackjack [apuesta]` - Jugar Blackjack
- `/coinflip [apuesta] [eleccion]` - Lanzar moneda
- `/dice [apuesta]` - Tirar dados
- `/roulette [apuesta] [eleccion]` - Jugar ruleta
- `/rps [apuesta]` - Piedra, papel o tijera
- `/guessnumber [apuesta]` - Adivina el número
- `/higherlower [apuesta]` - Higher or Lower

### Admin (Solo administradores)
- `/panel-tickets` - Panel de tickets
- `/panel-admin` - Panel administrativo
- `/add-coins [usuario] [cantidad]` - Agregar monedas
- `/remove-coins [usuario] [cantidad]` - Remover monedas

## Tecnologías 🛠️

- **Discord.js** v14.14.1 - Librería de Discord
- **Node.js** - Runtime de JavaScript
- **dotenv** - Gestión de variables de entorno
- Sistema de almacenamiento JSON

## Autor 👨‍💻

Easy Esports Clan

## Licencia 📄

MIT
