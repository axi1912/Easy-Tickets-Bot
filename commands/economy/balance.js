// ==========================================
// COMANDO: /balance
// Descripción: Muestra el balance de monedas y estadísticas de un usuario
// ==========================================

const { EmbedBuilder } = require('discord.js');
const { getUser } = require('../../utils/economy');

module.exports = {
  name: 'balance',
  description: 'Ver el balance de monedas de un usuario',
  category: 'economy',
  
  async execute(interaction) {
    const targetUser = interaction.options.getUser('usuario') || interaction.user;
    const userData = getUser(targetUser.id);

    const embed = new EmbedBuilder()
      .setColor('#f1c40f')
      .setTitle(`💰 Balance de ${targetUser.username}`)
      .setDescription(`**${userData.coins.toLocaleString()}** 🪙 Ea$y Coins`)
      .addFields(
        { name: '🏦 Banco', value: `${userData.bank.toLocaleString()} 🪙`, inline: true },
        { name: '💰 Total', value: `${(userData.coins + userData.bank).toLocaleString()} 🪙`, inline: true },
        { name: '⭐ Nivel BP', value: `${userData.battlepass?.level || 0}`, inline: true },
        { name: '🎮 Partidas jugadas', value: `${userData.stats.gamesPlayed}`, inline: true },
        { name: '✅ Victorias', value: `${userData.stats.gamesWon}`, inline: true },
        { name: '❌ Derrotas', value: `${userData.stats.gamesLost}`, inline: true }
      )
      .setThumbnail(targetUser.displayAvatarURL())
      .setFooter({ text: '© Ea$y Esports | Sistema de Economía' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
