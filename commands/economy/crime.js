const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, updateUser } = require('../../utils/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('crime')
    .setDescription('🔫 Cometer un crimen (alto riesgo, alta recompensa)'),
  
  async execute(interaction) {
    const userData = getUser(interaction.user.id);
    const now = Date.now();
    const cooldown = 300000; // 5 minutos

    if (userData.lastCrime && (now - userData.lastCrime) < cooldown) {
      const timeLeft = Math.ceil((cooldown - (now - userData.lastCrime)) / 60000);
      return interaction.reply({ 
        content: `⏰ Espera **${timeLeft}** minutos antes de cometer otro crimen.`, 
        flags: 64 
      });
    }

    const crimes = [
      { name: 'robar un banco', success: 0.30, reward: [500, 1500], fine: [300, 800] },
      { name: 'atracar una tienda', success: 0.50, reward: [200, 600], fine: [150, 400] },
      { name: 'hackear una cuenta', success: 0.40, reward: [300, 900], fine: [200, 500] },
      { name: 'falsificar dinero', success: 0.35, reward: [400, 1000], fine: [250, 600] },
      { name: 'robar un auto', success: 0.45, reward: [250, 700], fine: [180, 450] }
    ];

    const crime = crimes[Math.floor(Math.random() * crimes.length)];
    const success = Math.random() < crime.success;

    let embed;
    userData.lastCrime = now;

    if (success) {
      const amount = Math.floor(Math.random() * (crime.reward[1] - crime.reward[0])) + crime.reward[0];
      userData.coins += amount;

      embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('🔫 ¡Crimen Exitoso!')
        .setDescription(`✅ Lograste **${crime.name}** y ganaste **${amount.toLocaleString()}** 🪙`)
        .addFields({ name: '💰 Nuevo Balance', value: `${userData.coins.toLocaleString()} 🪙` });
    } else {
      const fine = Math.floor(Math.random() * (crime.fine[1] - crime.fine[0])) + crime.fine[0];
      const actualFine = Math.min(fine, userData.coins);
      userData.coins -= actualFine;

      embed = new EmbedBuilder()
        .setColor('#e74c3c')
        .setTitle('🚔 ¡Te Atraparon!')
        .setDescription(`❌ Intentaste **${crime.name}** pero te atrapó la policía.\n\nMulta: **-${actualFine.toLocaleString()}** 🪙`)
        .addFields({ name: '💰 Nuevo Balance', value: `${userData.coins.toLocaleString()} 🪙` });
    }

    updateUser(interaction.user.id, userData);
    await interaction.reply({ embeds: [embed] });
  }
};
