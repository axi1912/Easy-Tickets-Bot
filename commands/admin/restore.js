const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('restore')
    .setDescription('♻️ Restaurar datos desde un backup')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('archivo')
        .setDescription('Nombre del archivo de backup (ej: economy_2025-11-04)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('tipo')
        .setDescription('Tipo de datos a restaurar')
        .setRequired(true)
        .addChoices(
          { name: 'Economía', value: 'economy' },
          { name: 'Tickets', value: 'tickets' },
          { name: 'Clanes', value: 'clans' },
          { name: 'Persistente', value: 'persistent' }
        )),
  
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Necesitas permisos de administrador.', flags: 64 });
    }

    const filename = interaction.options.getString('archivo');
    const type = interaction.options.getString('tipo');
    
    const backupPath = path.join(__dirname, '../../backups', `${filename}.json`);
    
    if (!fs.existsSync(backupPath)) {
      return interaction.reply({ 
        content: '❌ No se encontró ese archivo de backup. Verifica el nombre.', 
        flags: 64 
      });
    }

    await interaction.deferReply({ flags: 64 });

    try {
      const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      
      let targetPath = '';
      switch (type) {
        case 'economy':
          targetPath = path.join(__dirname, '../../economy.json');
          break;
        case 'tickets':
          targetPath = path.join(__dirname, '../../tickets.json');
          break;
        case 'clans':
          targetPath = path.join(__dirname, '../../clans.json');
          break;
        case 'persistent':
          targetPath = path.join(__dirname, '../../persistent.json');
          break;
      }

      // Crear backup del archivo actual antes de restaurar
      if (fs.existsSync(targetPath)) {
        const currentBackup = `${targetPath}.pre-restore-${Date.now()}.json`;
        fs.copyFileSync(targetPath, currentBackup);
      }

      // Restaurar datos
      fs.writeFileSync(targetPath, JSON.stringify(backupData, null, 2));

      const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('♻️ Restauración Exitosa')
        .setDescription(`Los datos de **${type}** han sido restaurados desde el backup.`)
        .addFields(
          { name: 'Archivo', value: filename, inline: true },
          { name: 'Tipo', value: type, inline: true }
        )
        .setFooter({ text: 'Se creó un backup del estado anterior por seguridad' });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error restaurando backup:', error);
      await interaction.editReply({ 
        content: '❌ Error al restaurar el backup. Verifica los logs del servidor.' 
      });
    }
  }
};
