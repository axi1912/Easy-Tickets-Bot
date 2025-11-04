// ==========================================
// COMMAND HANDLER - Sistema de carga automática de comandos
// ==========================================

const fs = require('fs');
const path = require('path');

class CommandHandler {
  constructor() {
    this.commands = new Map();
  }

  /**
   * Carga todos los comandos recursivamente desde una carpeta
   * @param {string} dir - Directorio a escanear
   */
  loadCommandsFromDirectory(dir) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        // Si es un directorio, cargar recursivamente
        this.loadCommandsFromDirectory(filePath);
      } else if (file.endsWith('.js')) {
        // Si es un archivo .js, cargarlo como comando
        try {
          // Limpiar caché para permitir hot-reload en desarrollo
          delete require.cache[require.resolve(filePath)];
          
          const command = require(filePath);
          
          // Soporte para formato nuevo (con data property)
          if (command.data && command.execute) {
            const commandName = command.data.name;
            const category = path.basename(path.dirname(filePath));
            
            this.commands.set(commandName, {
              ...command,
              name: commandName,
              category: category
            });
            
            console.log(`✅ Comando cargado: ${commandName} (${category})`);
          }
          // Soporte para formato antiguo (con name property)
          else if (command.name && command.execute) {
            const category = path.basename(path.dirname(filePath));
            this.commands.set(command.name, { ...command, category });
            console.log(`✅ Comando cargado: ${command.name} (${category})`);
          } else {
            console.warn(`⚠️ Archivo ignorado (falta data/name o execute): ${filePath}`);
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
  initializeCommands() {
    const commandsPath = path.join(__dirname, '../commands');
    
    if (!fs.existsSync(commandsPath)) {
      console.warn('⚠️ Carpeta commands/ no encontrada');
      return;
    }

    console.log('📦 Cargando comandos...');
    this.loadCommandsFromDirectory(commandsPath);
    console.log(`✅ ${this.commands.size} comandos cargados exitosamente`);
  }

  /**
   * Obtiene un comando por su nombre
   * @param {string} commandName 
   * @returns {Object|null}
   */
  getCommand(commandName) {
    return this.commands.get(commandName);
  }

  /**
   * Ejecuta un comando
   * @param {string} commandName 
   * @param {Interaction} interaction 
   * @param {Client} client - Cliente de Discord
   */
  async executeCommand(commandName, interaction, client) {
    const command = this.getCommand(commandName);
    
    if (!command) {
      return false; // Comando no encontrado
    }

    try {
      await command.execute(interaction, client);
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
  getAllCommands() {
    return this.commands;
  }

  /**
   * Recarga todos los comandos
   */
  reloadCommands() {
    this.commands.clear();
    this.initializeCommands();
  }
}

module.exports = CommandHandler;
