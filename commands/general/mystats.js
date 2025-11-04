const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../../utils/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mystats')
    .setDescription('📊 Ver tus estadísticas detalladas'),
  
  async execute(interaction) {
    const userData = getUser(interaction.user.id);

    const totalWealth = userData.coins + (userData.bank || 0);
    const totalGames = userData.stats?.gamesPlayed || 0;
    const wins = userData.stats?.gamesWon || 0;
    const losses = totalGames - wins;
    const winRate = totalGames > 0 ? Math.floor((wins / totalGames) * 100) : 0;
    const totalWinnings = userData.stats?.totalWinnings || 0;
    const totalLosses = userData.stats?.totalLosses || 0;
    const netProfit = totalWinnings - totalLosses;

    const embed = new EmbedBuilder()
      .setColor('#9b59b6')
      .setTitle('📊 Mis Estadísticas')
      .addFields(
        { name: '💰 Economía', value: 
          `Monedas: **${userData.coins.toLocaleString()} 🪙**\n` +
          `Banco: **${(userData.bank || 0).toLocaleString()} 🪙**\n` +
          `Total: **${totalWealth.toLocaleString()} 🪙**\n` +
          `Préstamo: **${(userData.loan || 0).toLocaleString()} 🪙**`,
          inline: true
        },
        { name: '🎮 Juegos', value:
          `Jugados: **${totalGames}**\n` +
          `Ganados: **${wins}**\n` +
          `Perdidos: **${losses}**\n` +
          `Win Rate: **${winRate}%**`,
          inline: true
        },
        { name: '💼 Trabajo', value:
          `Nivel: **${userData.workLevel || 1}**\n` +
          `XP: **${userData.workXP || 0}**\n` +
          `Racha: **${userData.workStreak || 0} días**`,
          inline: true
        },
        { name: '🎯 BattlePass', value:
          `Nivel: **${userData.battlePassLevel || 1}**\n` +
          `XP: **${userData.battlePassXP || 0}**`,
          inline: true
        },
        { name: '🔥 Rachas', value:
          `Daily: **${userData.dailyStreak || 0} días**\n` +
          `Work: **${userData.workStreak || 0} días**`,
          inline: true
        },
        { name: '📈 Balance Neto', value:
          `Ganado: **+${totalWinnings.toLocaleString()} 🪙**\n` +
          `Perdido: **-${totalLosses.toLocaleString()} 🪙**\n` +
          `Neto: **${netProfit >= 0 ? '+' : ''}${netProfit.toLocaleString()} 🪙**`,
          inline: true
        }
      );

    if (userData.clan) {
      embed.addFields({ name: '🛡️ Clan', value: userData.clan, inline: true });
    }

    if (userData.marriedTo) {
      const partner = await interaction.client.users.fetch(userData.marriedTo).catch(() => null);
      embed.addFields({ 
        name: '💕 Pareja', 
        value: partner ? partner.username : 'Desconocido', 
        inline: true 
      });
    }

    if (userData.titles && userData.titles.length > 0) {
      embed.addFields({ 
        name: '👑 Títulos', 
        value: userData.titles.join(', '), 
        inline: false 
      });
    }

    await interaction.reply({ embeds: [embed] });
  }
};
