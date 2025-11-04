const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../../utils/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('🎒 Ver tu inventario de items')
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('Ver inventario de otro usuario')
        .setRequired(false)),
  
  async execute(interaction) {
    const targetUser = interaction.options.getUser('usuario') || interaction.user;
    const userData = getUser(targetUser.id);

    const activeItems = userData.inventory ? userData.inventory.filter(item => item.expires > Date.now()) : [];

    const embed = new EmbedBuilder()
      .setColor('#9b59b6')
      .setTitle(`🎒 Inventario de ${targetUser.username}`)
      .setDescription(activeItems.length > 0 ? 'Items activos:' : 'No tienes items activos.')
      .setTimestamp();

    if (activeItems.length > 0) {
      activeItems.forEach(item => {
        const timeLeft = Math.floor((item.expires - Date.now()) / 1000 / 60);
        const hours = Math.floor(timeLeft / 60);
        const mins = timeLeft % 60;
        embed.addFields({
          name: item.name,
          value: `⏱️ Expira en: ${hours}h ${mins}m`,
          inline: true
        });
      });
    }

    if (userData.titles && userData.titles.length > 0) {
      embed.addFields({
        name: '🏆 Títulos',
        value: userData.titles.join(', '),
        inline: false
      });
    }

    await interaction.reply({ embeds: [embed] });
  }
};
