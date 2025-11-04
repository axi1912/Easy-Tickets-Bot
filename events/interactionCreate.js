const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    // ========== SLASH COMMANDS ==========
    if (interaction.isChatInputCommand()) {
      const command = client.commandHandler.getCommand(interaction.commandName);

      if (!command) {
        console.log(`⚠️ Comando no encontrado: ${interaction.commandName}`);
        return interaction.reply({ 
          content: '❌ Este comando no existe.', 
          flags: 64 
        });
      }

      try {
        // Ejecutar el comando
        await client.commandHandler.executeCommand(interaction.commandName, interaction, client);
      } catch (error) {
        console.error(`❌ Error ejecutando comando ${interaction.commandName}:`, error);
        
        const errorEmbed = new EmbedBuilder()
          .setColor('#e74c3c')
          .setTitle('❌ Error')
          .setDescription('Ocurrió un error al ejecutar este comando.')
          .setFooter({ text: 'Si el problema persiste, contacta al administrador' });

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ embeds: [errorEmbed], flags: 64 });
        } else {
          await interaction.reply({ embeds: [errorEmbed], flags: 64 });
        }
      }
    }

    // ========== BUTTONS ==========
    if (interaction.isButton()) {
      // Los handlers de botones se cargarán aquí
      // Por ahora, solo loguear
      console.log(`🔘 Botón presionado: ${interaction.customId}`);
    }

    // ========== STRING SELECT MENUS ==========
    if (interaction.isStringSelectMenu()) {
      // Los handlers de menús se cargarán aquí
      console.log(`📋 Menú seleccionado: ${interaction.customId}`);
    }

    // ========== MODALS ==========
    if (interaction.isModalSubmit()) {
      // Los handlers de modales se cargarán aquí
      console.log(`📝 Modal enviado: ${interaction.customId}`);
    }
  }
};
