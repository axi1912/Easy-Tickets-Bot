// ==========================================
// COMANDO: STREAK
// Ver racha de daily rewards
// ==========================================

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../../utils/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('streak')
    .setDescription('🔥 Ver tu racha de recompensas diarias'),

  async execute(interaction) {
    const userData = getUser(interaction.user.id);
    const streak = userData.streak || 0;

    // Calcular próxima recompensa
    const baseReward = 100;
    const streakBonus = streak * 50;
    const nextReward = baseReward + streakBonus;

    // Determinar emblema de racha
    let streakEmoji = '🔥';
    let streakTitle = 'Racha en construcción';
    let streakColor = '#95a5a6';

    if (streak >= 30) {
      streakEmoji = '💎';
      streakTitle = '¡RACHA LEGENDARIA!';
      streakColor = '#9b59b6';
    } else if (streak >= 14) {
      streakEmoji = '🏆';
      streakTitle = '¡RACHA ÉPICA!';
      streakColor = '#f1c40f';
    } else if (streak >= 7) {
      streakEmoji = '⭐';
      streakTitle = '¡Gran racha!';
      streakColor = '#3498db';
    } else if (streak >= 3) {
      streakEmoji = '🔥';
      streakTitle = 'Racha activa';
      streakColor = '#e67e22';
    }

    const embed = new EmbedBuilder()
      .setColor(streakColor)
      .setTitle(`${streakEmoji} ${streakTitle}`)
      .setDescription(`╔════════════════════════╗\n║                                            ║\n║   📅 **Días consecutivos**   ║\n║           **${streak}** días           ║\n║                                            ║\n╚════════════════════════╝`)
      .addFields(
        { name: '💰 Recompensa actual', value: `**${nextReward.toLocaleString()}** 🪙`, inline: true },
        { name: '📈 Bonus por racha', value: `**+${streakBonus}** 🪙`, inline: true },
        { name: '🎯 Último daily', value: userData.lastDaily ? `<t:${Math.floor(userData.lastDaily / 1000)}:R>` : 'Nunca', inline: false },
        { name: '📊 Hitos de racha', value: '**3 días:** 🔥 Racha activa\n**7 días:** ⭐ Gran racha\n**14 días:** 🏆 Racha épica\n**30 días:** 💎 Racha legendaria', inline: false }
      )
      .setFooter({ text: '💡 Usa /daily cada 24h para mantener tu racha' });

    // Si tiene racha alta, agregar campo de felicitaciones
    if (streak >= 7) {
      embed.addFields({
        name: '🎉 ¡Felicitaciones!',
        value: `Has mantenido tu racha por **${streak} días**. ¡Sigue así!`,
        inline: false
      });
    }

    await interaction.reply({ embeds: [embed] });
  }
};
