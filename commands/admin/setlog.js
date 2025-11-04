const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlog')
    .setDescription('📝 Configurar canal de logs del servidor')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
      option.setName('canal')
        .setDescription('Canal para logs')
        .setRequired(true)),
  
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Necesitas permisos de administrador.', flags: 64 });
    }

    const channel = interaction.options.getChannel('canal');
    
    // Guardar configuración
    const configPath = path.join(__dirname, '../../config/server-config.json');
    let config = {};
    
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }

    if (!config[interaction.guild.id]) {
      config[interaction.guild.id] = {};
    }

    config[interaction.guild.id].logChannel = channel.id;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    const embed = new EmbedBuilder()
      .setColor('#2ecc71')
      .setTitle('✅ Canal de Logs Configurado')
      .setDescription(`El canal de logs ha sido establecido en ${channel}`)
      .setFooter({ text: 'Los logs del servidor se enviarán aquí' });

    await interaction.reply({ embeds: [embed] });
  }
};
