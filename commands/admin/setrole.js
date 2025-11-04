const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setrole')
    .setDescription('👮 Configurar roles del staff')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('staff')
        .setDescription('Establecer rol de staff')
        .addRoleOption(option =>
          option.setName('rol')
            .setDescription('Rol de staff')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('admin')
        .setDescription('Establecer rol de admin')
        .addRoleOption(option =>
          option.setName('rol')
            .setDescription('Rol de admin')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('moderator')
        .setDescription('Establecer rol de moderador')
        .addRoleOption(option =>
          option.setName('rol')
            .setDescription('Rol de moderador')
            .setRequired(true))),
  
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Necesitas permisos de administrador.', flags: 64 });
    }

    const subcommand = interaction.options.getSubcommand();
    const role = interaction.options.getRole('rol');

    // Guardar configuración
    const configPath = path.join(__dirname, '../../config/server-config.json');
    let config = {};
    
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }

    if (!config[interaction.guild.id]) {
      config[interaction.guild.id] = {};
    }

    if (!config[interaction.guild.id].roles) {
      config[interaction.guild.id].roles = {};
    }

    config[interaction.guild.id].roles[subcommand] = role.id;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    const roleNames = {
      staff: 'Staff',
      admin: 'Administrador',
      moderator: 'Moderador'
    };

    const embed = new EmbedBuilder()
      .setColor('#3498db')
      .setTitle('✅ Rol Configurado')
      .setDescription(`El rol de **${roleNames[subcommand]}** ha sido establecido en ${role}`)
      .setFooter({ text: 'Los permisos se aplicarán automáticamente' });

    await interaction.reply({ embeds: [embed] });
  }
};
