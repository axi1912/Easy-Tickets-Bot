// ==========================================
// COMANDO: /daily
// Descripción: Reclama tu bonus diario de monedas
// ==========================================

const { EmbedBuilder } = require('discord.js');
const { getUser, updateUser } = require('../../utils/economy');
const config = require('../../config/constants');

module.exports = {
  name: 'daily',
  description: 'Reclamar tu bonus diario',
  category: 'economy',
  
  async execute(interaction) {
    const userData = getUser(interaction.user.id);
    const now = Date.now();
    const cooldown = config.ECONOMY.DAILY_COOLDOWN;

    // Verificar cooldown
    if (userData.lastDaily && (now - userData.lastDaily) < cooldown) {
      const timeLeft = cooldown - (now - userData.lastDaily);
      const hours = Math.floor(timeLeft / (60 * 60 * 1000));
      const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));

      return interaction.reply({ 
        content: `⏰ Ya reclamaste tu bonus diario. Vuelve en **${hours}h ${minutes}m**`,
        flags: 64 
      });
    }

    // Dar recompensa
    const reward = config.ECONOMY.DAILY_REWARD;
    userData.coins += reward;
    userData.lastDaily = now;
    
    // Actualizar racha
    const lastStreakDate = userData.lastStreak || 0;
    const daysSinceLastStreak = Math.floor((now - lastStreakDate) / (24 * 60 * 60 * 1000));
    
    if (daysSinceLastStreak === 1) {
      // Continuar racha
      userData.streak = (userData.streak || 0) + 1;
    } else if (daysSinceLastStreak > 1) {
      // Reiniciar racha
      userData.streak = 1;
    }
    
    userData.lastStreak = now;
    updateUser(interaction.user.id, userData);

    const embed = new EmbedBuilder()
      .setColor('#2ecc71')
      .setTitle('🎁 Bonus Diario Reclamado')
      .setDescription(`Has recibido **${reward}** 🪙\n\n💰 Nuevo balance: **${userData.coins.toLocaleString()}** 🪙\n🔥 Racha: **${userData.streak}** días`)
      .setFooter({ text: 'Vuelve mañana por más!' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
