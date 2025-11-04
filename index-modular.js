// ==========================================
// BOT MODULAR - VERSIÓN DE PRUEBA
// Este archivo usa la estructura modular nueva
// ==========================================

const { Client, GatewayIntentBits } = require('discord.js');
const { initializeCommands, executeCommand } = require('./handlers/commandHandler');
require('dotenv').config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// Inicializar comandos modulares
initializeCommands();

client.once('ready', () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);
  console.log(`🎮 Sirviendo en ${client.guilds.cache.size} servidores`);
  
  client.user.setActivity('Ea$y Esports | Sistema Modular', { type: 'WATCHING' });
});

// Manejar interacciones
client.on('interactionCreate', async (interaction) => {
  try {
    // Manejar comandos de chat
    if (interaction.isChatInputCommand()) {
      const commandName = interaction.commandName;
      
      // Intentar ejecutar comando modular
      const executed = await executeCommand(commandName, interaction);
      
      if (!executed) {
        console.log(`⚠️ Comando no encontrado en sistema modular: ${commandName}`);
        await interaction.reply({
          content: '❌ Este comando aún no está disponible en el sistema modular.',
          flags: 64
        }).catch(() => {});
      }
    }
    
    // Botones y modales se manejarán después
    if (interaction.isButton()) {
      console.log(`🔘 Botón presionado: ${interaction.customId}`);
    }
    
    if (interaction.isStringSelectMenu()) {
      console.log(`📋 Menú seleccionado: ${interaction.customId}`);
    }
    
    if (interaction.isModalSubmit()) {
      console.log(`📝 Modal enviado: ${interaction.customId}`);
    }
    
  } catch (error) {
    console.error('❌ Error en interactionCreate:', error);
  }
});

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
