// ==========================================
// COMANDO: /leaderboard
// Descripción: Muestra el top 10 de usuarios más ricos
// ==========================================

const { EmbedBuilder } = require('discord.js');
const { getTopUsers } = require('../../utils/economy');

module.exports = {
  name: 'leaderboard',
  description: 'Ver el top 10 de usuarios más ricos',
  category: 'economy',
  
  async execute(interaction) {
    const topUsers = getTopUsers(10);
    
    let description = '';
    for (let i = 0; i < topUsers.length; i++) {
      const [userId, data] = topUsers[i];
      const user = await interaction.guild.members.fetch(userId).catch(() => null);
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      description += `${medal} **${user ? user.user.username : 'Usuario Desconocido'}** - ${data.coins.toLocaleString()} 🪙\n`;
    }

    const embed = new EmbedBuilder()
      .setColor('#f39c12')
      .setTitle('🏆 Top 10 - Más Ricos')
      .setDescription(description || 'No hay datos aún')
      .setFooter({ text: '© Ea$y Esports | Leaderboard' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
