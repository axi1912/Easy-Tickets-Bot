const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../../utils/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dep')
    .setDescription('🏦 Alias para depositar monedas en el banco')
    .addIntegerOption(option =>
      option.setName('cantidad')
        .setDescription('Cantidad a depositar')
        .setRequired(true)
        .setMinValue(1)),
  
  async execute(interaction) {
    const amount = interaction.options.getInteger('cantidad');
    const userData = getUser(interaction.user.id);

    if (userData.coins < amount) {
      return interaction.reply({ 
        content: `❌ No tienes suficientes monedas. Tienes: **${userData.coins.toLocaleString()}** 🪙`, 
        flags: 64 
      });
    }

    const { updateUser } = require('../../utils/economy');
    userData.coins -= amount;
    userData.bank += amount;
    updateUser(interaction.user.id, userData);

    const embed = new EmbedBuilder()
      .setColor('#2ecc71')
      .setTitle('🏦 Depósito Exitoso')
      .setDescription(`Has depositado **${amount.toLocaleString()}** 🪙 en tu banco`)
      .addFields(
        { name: '💰 En mano', value: `${userData.coins.toLocaleString()} 🪙`, inline: true },
        { name: '🏦 En banco', value: `${userData.bank.toLocaleString()} 🪙`, inline: true }
      );

    await interaction.reply({ embeds: [embed] });
  }
};
