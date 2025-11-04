// ==========================================
// REGISTRO RÁPIDO DE COMANDOS (POR SERVIDOR)
// Para testing inmediato en tu servidor de desarrollo
// ==========================================

const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ⚠️ CONFIGURACIÓN: Cambia esto por tu GUILD_ID (ID del servidor)
const GUILD_ID = process.env.GUILD_ID || '1241209964774834206'; // Tu servidor de desarrollo

const commands = [];

// Función recursiva para cargar comandos
function loadCommandsFromDirectory(dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      loadCommandsFromDirectory(filePath);
    } else if (file.endsWith('.js')) {
      try {
        const command = require(filePath);
        if (command.data) {
          commands.push(command.data.toJSON());
          console.log(`✅ ${command.data.name}`);
        }
      } catch (error) {
        console.error(`❌ Error: ${file}`, error.message);
      }
    }
  }
}

const commandsPath = path.join(__dirname, 'commands');
console.log('📦 Cargando comandos...\n');
loadCommandsFromDirectory(commandsPath);

console.log(`\n📊 Total: ${commands.length} comandos\n`);

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`🚀 Registrando ${commands.length} comandos en servidor ${GUILD_ID}...\n`);

    // Registrar comandos en un servidor específico (INSTANTÁNEO)
    const data = await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, GUILD_ID),
      { body: commands },
    );

    console.log(`✅ ${data.length} comandos registrados INSTANTÁNEAMENTE!\n`);
    console.log('✨ Los comandos ya están disponibles en tu servidor.\n');

    console.log('📋 Comandos registrados:');
    const commandsByCategory = {};
    data.forEach(cmd => {
      // Intentar determinar categoría por nombre
      const category = commands.find(c => c.name === cmd.name)?.category || 'general';
      if (!commandsByCategory[category]) commandsByCategory[category] = [];
      commandsByCategory[category].push(cmd.name);
    });

    Object.entries(commandsByCategory).forEach(([cat, cmds]) => {
      console.log(`\n  ${cat}:`);
      cmds.forEach(cmd => console.log(`    /${cmd}`));
    });

    console.log('\n💡 Para registrar globalmente (todos los servidores), usa: node deploy-commands.js');

  } catch (error) {
    console.error('❌ Error:', error);
    
    if (!process.env.CLIENT_ID) {
      console.log('\n⚠️ Falta CLIENT_ID en .env');
      console.log('   Añade: CLIENT_ID=tu_client_id_aqui');
    }
    
    if (!process.env.DISCORD_TOKEN) {
      console.log('\n⚠️ Falta DISCORD_TOKEN en .env');
    }
    
    process.exit(1);
  }
})();
