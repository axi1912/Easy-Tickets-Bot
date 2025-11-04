// ==========================================
// BOT MODULAR - VERSIÓN DE PRUEBA
// Este archivo usa la estructura modular nueva
// ==========================================

const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const CommandHandler = require('./handlers/commandHandler');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent
  ]
});

// Inicializar colección de comandos
client.commands = new Collection();

// Inicializar CommandHandler
client.commandHandler = new CommandHandler();
console.log('📦 Inicializando sistema de comandos...');
client.commandHandler.initializeCommands();

// Map global para juegos activos (compartido con comandos)
client.activeGames = new Map();

// ========== CARGAR EVENTOS ==========
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

  for (const file of eventFiles) {
    const event = require(path.join(eventsPath, file));
    
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
    
    console.log(`✅ Evento cargado: ${event.name}`);
  }
} else {
  console.log('⚠️ Carpeta de eventos no encontrada, creando...');
  fs.mkdirSync(eventsPath);
}

// Pasar activeGames a los comandos que lo necesiten
const allCommands = client.commandHandler.getAllCommands();
for (const [name, command] of allCommands.entries()) {
  if (typeof command.setActiveGames === 'function') {
    command.setActiveGames(client.activeGames);
  }
  client.commands.set(name, command);
}

// Manejo de errores
client.on('error', error => {
  console.error('❌ Error del cliente:', error);
});

process.on('unhandledRejection', error => {
  console.error('❌ Promesa rechazada sin manejar:', error);
});

// Conectar el bot
client.login(process.env.DISCORD_TOKEN).catch(error => {
  console.error('❌ Error al conectar el bot:', error);
  process.exit(1);
});

module.exports = client;
