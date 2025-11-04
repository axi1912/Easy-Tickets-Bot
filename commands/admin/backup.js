const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createBackup } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('backup')
    .setDescription('💾 Crear backup manual de todos los datos')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Necesitas permisos de administrador.', flags: 64 });
    }

    await interaction.deferReply({ flags: 64 });

    try {
      createBackup();
      await interaction.editReply({ 
        content: '✅ Backup creado exitosamente en la carpeta `backups/`' 
      });
    } catch (error) {
      console.error('Error creando backup:', error);
      await interaction.editReply({ 
        content: '❌ Error al crear el backup. Revisa los logs.' 
      });
    }
  }
};
