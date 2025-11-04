// ==========================================
// SCRIPT DE REGISTRO DE COMANDOS EN DISCORD
// Registra todos los comandos slash en Discord API
// ==========================================

const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

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
          console.log(`✅ Comando encontrado: ${command.data.name}`);
        }
      } catch (error) {
        console.error(`❌ Error cargando comando ${filePath}:`, error);
      }
    }
  }
}

// Cargar todos los comandos
const commandsPath = path.join(__dirname, 'commands');
console.log('📦 Buscando comandos...\n');
loadCommandsFromDirectory(commandsPath);

console.log(`\n📊 Total de comandos a registrar: ${commands.length}\n`);

// Configurar REST API
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

// Registrar comandos
(async () => {
  try {
    console.log(`🔄 Iniciando registro de ${commands.length} comandos en Discord...\n`);

    // Registrar comandos globalmente (disponibles en todos los servidores)
    // NOTA: Los comandos globales tardan hasta 1 hora en propagarse
    const data = await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );

    console.log(`✅ ${data.length} comandos registrados exitosamente en Discord!\n`);
    console.log('⏰ NOTA: Los comandos pueden tardar hasta 1 hora en aparecer en todos los servidores.\n');
    console.log('💡 Para testing inmediato, usa registro por servidor (guild commands).\n');

    // Mostrar comandos registrados
    console.log('📋 Comandos registrados:');
    data.forEach(cmd => {
      console.log(`   - /${cmd.name}`);
    });

  } catch (error) {
    console.error('❌ Error al registrar comandos:', error);
    
    if (error.code === 50001) {
      console.log('\n⚠️ Error 50001: Permisos insuficientes');
      console.log('   Asegúrate de que el bot tenga el scope "applications.commands"');
    }
    
    if (error.code === 'ENOTFOUND') {
      console.log('\n⚠️ Error de conexión a Discord API');
      console.log('   Verifica tu conexión a internet');
    }
    
    process.exit(1);
  }
})();
