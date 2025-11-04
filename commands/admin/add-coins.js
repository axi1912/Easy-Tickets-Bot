const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getUser, updateUser } = require('../../utils/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add-coins')
    .setDescription('💰 [ADMIN] Agregar monedas a un usuario')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('Usuario al que agregar monedas')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('cantidad')
        .setDescription('Cantidad de monedas a agregar')
        .setRequired(true)
        .setMinValue(1)),
  
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Necesitas permisos de administrador para usar este comando.', flags: 64 });
    }

    const targetUser = interaction.options.getUser('usuario');
    const amount = interaction.options.getInteger('cantidad');

    if (amount <= 0) {
      return interaction.reply({ content: '❌ La cantidad debe ser mayor a 0.', flags: 64 });
    }

    const userData = getUser(targetUser.id);
    userData.coins += amount;
    updateUser(targetUser.id, userData);

    const embed = new EmbedBuilder()
      .setColor('#2ecc71')
      .setTitle('💰 Monedas Agregadas')
      .setDescription(`**${interaction.user.username}** agregó **${amount.toLocaleString()}** 🪙 a **${targetUser.username}**`)
      .addFields(
        { name: 'Nuevo balance', value: `${userData.coins.toLocaleString()} 🪙`, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
