const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, updateUser } = require('../../utils/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('withdraw')
    .setDescription('🏦 Retirar monedas del banco')
    .addIntegerOption(option =>
      option.setName('cantidad')
        .setDescription('Cantidad a retirar')
        .setRequired(true)
        .setMinValue(1)),
  
  async execute(interaction) {
    const amount = interaction.options.getInteger('cantidad');
    const userData = getUser(interaction.user.id);

    if (userData.bank < amount) {
      return interaction.reply({ 
        content: `❌ No tienes suficientes monedas en el banco. Tienes: **${userData.bank.toLocaleString()}** 🪙`, 
        flags: 64 
      });
    }

    userData.bank -= amount;
    userData.coins += amount;
    updateUser(interaction.user.id, userData);

    const embed = new EmbedBuilder()
      .setColor('#e74c3c')
      .setTitle('🏦 Retiro Exitoso')
      .setDescription(`Has retirado **${amount.toLocaleString()}** 🪙 de tu banco`)
      .addFields(
        { name: '💰 En mano', value: `${userData.coins.toLocaleString()} 🪙`, inline: true },
        { name: '🏦 En banco', value: `${userData.bank.toLocaleString()} 🪙`, inline: true }
      );

    await interaction.reply({ embeds: [embed] });
  }
};
