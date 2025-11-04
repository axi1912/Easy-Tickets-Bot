const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../../utils/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('battlepass')
    .setDescription('🎯 Ver tu progreso del Battle Pass'),
  
  async execute(interaction) {
    const userData = getUser(interaction.user.id);
    
    const level = userData.battlePassLevel || 1;
    const xp = userData.battlePassXP || 0;
    const xpNeeded = level * 1000;
    const progress = Math.floor((xp / xpNeeded) * 100);
    const progressBar = '█'.repeat(Math.floor(progress / 10)) + '░'.repeat(10 - Math.floor(progress / 10));

    // Recompensas por nivel
    const rewards = {
      5: '💰 5,000 monedas',
      10: '🎁 Lucky Charm',
      15: '💰 10,000 monedas',
      20: '🛡️ Shield Item',
      25: '💰 25,000 monedas',
      30: '⭐ Multiplier 2x',
      35: '💰 50,000 monedas',
      40: '👑 Título Especial',
      50: '💎 100,000 monedas + Título Legendario'
    };

    let rewardsList = '';
    for (let [lvl, reward] of Object.entries(rewards)) {
      const unlocked = level >= parseInt(lvl);
      rewardsList += `${unlocked ? '✅' : '🔒'} Nivel ${lvl}: ${reward}\n`;
    }

    const embed = new EmbedBuilder()
      .setColor('#f39c12')
      .setTitle('🎯 Battle Pass')
      .setDescription(`**Nivel:** ${level}\n**XP:** ${xp.toLocaleString()}/${xpNeeded.toLocaleString()}\n\n${progressBar} ${progress}%`)
      .addFields({ name: '🎁 Recompensas', value: rewardsList })
      .setFooter({ text: 'Gana XP jugando, trabajando y completando misiones' });

    await interaction.reply({ embeds: [embed] });
  }
};
