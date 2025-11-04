const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, updateUser } = require('../../utils/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('beg')
    .setDescription('🙏 Pedir limosna (gana pequeñas cantidades)'),
  
  async execute(interaction) {
    const userData = getUser(interaction.user.id);
    const now = Date.now();
    const cooldown = 60000; // 1 minuto

    if (userData.lastBeg && (now - userData.lastBeg) < cooldown) {
      const timeLeft = Math.ceil((cooldown - (now - userData.lastBeg)) / 1000);
      return interaction.reply({ 
        content: `⏰ Espera **${timeLeft}** segundos antes de mendigar otra vez.`, 
        flags: 64 
      });
    }

    const chance = Math.random();
    let amount = 0;
    let message = '';

    if (chance < 0.05) {
      // 5% - Nada
      message = '😔 Nadie te dio nada... inténtalo de nuevo.';
    } else if (chance < 0.30) {
      // 25% - Poco
      amount = Math.floor(Math.random() * 10) + 1;
      message = `🪙 Alguien te dio **${amount}** monedas.`;
    } else if (chance < 0.70) {
      // 40% - Normal
      amount = Math.floor(Math.random() * 30) + 10;
      message = `💰 Un usuario generoso te dio **${amount}** monedas.`;
    } else if (chance < 0.95) {
      // 25% - Bueno
      amount = Math.floor(Math.random() * 60) + 40;
      message = `💵 ¡Alguien rico te dio **${amount}** monedas!`;
    } else {
      // 5% - Excelente
      amount = Math.floor(Math.random() * 150) + 100;
      message = `🌟 ¡Un millonario te dio **${amount}** monedas!`;
    }

    userData.coins += amount;
    userData.lastBeg = now;
    updateUser(interaction.user.id, userData);

    const embed = new EmbedBuilder()
      .setColor(amount > 50 ? '#2ecc71' : '#95a5a6')
      .setTitle('🙏 Mendigar')
      .setDescription(message)
      .addFields({ name: '💰 Nuevo Balance', value: `${userData.coins.toLocaleString()} 🪙` });

    await interaction.reply({ embeds: [embed] });
  }
};
