// ==========================================
// COMMAND HANDLER
// Carga automáticamente todos los comandos desde las carpetas
// ==========================================

const fs = require('fs');
const path = require('path');

// Mapa para almacenar todos los comandos
const commands = new Map();

/**
 * Carga todos los comandos recursivamente desde una carpeta
 * @param {string} dir - Directorio a escanear
 */
function loadCommandsFromDirectory(dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Si es un directorio, cargar recursivamente
      loadCommandsFromDirectory(filePath);
    } else if (file.endsWith('.js')) {
      // Si es un archivo .js, cargarlo como comando
      try {
        const command = require(filePath);
        
        if (command.name && command.execute) {
          commands.set(command.name, command);
          console.log(`✅ Comando cargado: ${command.name} (${command.category || 'general'})`);
        } else {
          console.warn(`⚠️ Archivo ignorado (falta name o execute): ${filePath}`);
        }
      } catch (error) {
        console.error(`❌ Error al cargar comando ${filePath}:`, error);
      }
    }
  }
}

/**
 * Inicializa el command handler
 */
function initializeCommands() {
  const commandsPath = path.join(__dirname, '../commands');
  
  if (!fs.existsSync(commandsPath)) {
    console.warn('⚠️ Carpeta commands/ no encontrada');
    return;
  }

  console.log('📦 Cargando comandos...');
  loadCommandsFromDirectory(commandsPath);
  console.log(`✅ ${commands.size} comandos cargados exitosamente`);
}

/**
 * Obtiene un comando por su nombre
 * @param {string} commandName 
 * @returns {Object|null}
 */
function getCommand(commandName) {
  return commands.get(commandName);
}

/**
 * Ejecuta un comando
 * @param {string} commandName 
 * @param {Interaction} interaction 
 */
async function executeCommand(commandName, interaction) {
  const command = getCommand(commandName);
  
  if (!command) {
    return false; // Comando no encontrado
  }

  try {
    await command.execute(interaction);
    return true;
  } catch (error) {
    console.error(`❌ Error al ejecutar comando ${commandName}:`, error);
    
    // Intentar responder con error al usuario
    const errorMessage = { 
      content: '❌ Hubo un error al ejecutar este comando.', 
      flags: 64 
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage).catch(() => {});
    } else {
      await interaction.reply(errorMessage).catch(() => {});
    }
    
    return false;
  }
}

/**
 * Obtiene todos los comandos cargados
 * @returns {Map}
 */
function getAllCommands() {
  return commands;
}

module.exports = {
  initializeCommands,
  getCommand,
  executeCommand,
  getAllCommands
};
