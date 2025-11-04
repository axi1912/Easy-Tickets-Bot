const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../../utils/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cooldowns')
    .setDescription('⏰ Ver tus cooldowns activos'),
  
  async execute(interaction) {
    const userData = getUser(interaction.user.id);
    const now = Date.now();

    const cooldowns = [
      { name: '💰 Daily', time: userData.lastDaily, duration: 86400000 },
      { name: '💼 Work', time: userData.lastWork, duration: 3600000 },
      { name: '🎰 Spin', time: userData.lastSpin, duration: 86400000 },
      { name: '🙏 Beg', time: userData.lastBeg, duration: 60000 },
      { name: '🔫 Crime', time: userData.lastCrime, duration: 300000 },
      { name: '💰 Rob', time: userData.lastRob, duration: 600000 },
      { name: '💋 Slut', time: userData.lastSlut, duration: 120000 }
    ];

    let description = '';
    let hasActiveCooldowns = false;

    for (let cd of cooldowns) {
      if (!cd.time) {
        description += `${cd.name}: ✅ Disponible\n`;
      } else {
        const timeLeft = cd.duration - (now - cd.time);
        if (timeLeft > 0) {
          hasActiveCooldowns = true;
          const hours = Math.floor(timeLeft / 3600000);
          const minutes = Math.floor((timeLeft % 3600000) / 60000);
          const seconds = Math.floor((timeLeft % 60000) / 1000);
          
          if (hours > 0) {
            description += `${cd.name}: ⏰ ${hours}h ${minutes}m\n`;
          } else if (minutes > 0) {
            description += `${cd.name}: ⏰ ${minutes}m ${seconds}s\n`;
          } else {
            description += `${cd.name}: ⏰ ${seconds}s\n`;
          }
        } else {
          description += `${cd.name}: ✅ Disponible\n`;
        }
      }
    }

    const embed = new EmbedBuilder()
      .setColor(hasActiveCooldowns ? '#e67e22' : '#2ecc71')
      .setTitle('⏰ Tus Cooldowns')
      .setDescription(description || 'Todos los comandos están disponibles')
      .setFooter({ text: 'Los cooldowns se actualizan en tiempo real' });

    await interaction.reply({ embeds: [embed] });
  }
};
