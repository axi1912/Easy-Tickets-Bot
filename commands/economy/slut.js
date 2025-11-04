const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, updateUser } = require('../../utils/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slut')
    .setDescription('💋 Trabajo arriesgado con recompensas variables'),
  
  async execute(interaction) {
    const userData = getUser(interaction.user.id);
    const now = Date.now();
    const cooldown = 120000; // 2 minutos

    if (userData.lastSlut && (now - userData.lastSlut) < cooldown) {
      const timeLeft = Math.ceil((cooldown - (now - userData.lastSlut)) / 1000);
      return interaction.reply({ 
        content: `⏰ Espera **${timeLeft}** segundos antes de trabajar otra vez.`, 
        flags: 64 
      });
    }

    const scenarios = [
      { text: 'trabajaste en un bar elegante', success: 0.70, reward: [100, 300], fine: [50, 100] },
      { text: 'atendiste una fiesta privada', success: 0.60, reward: [150, 400], fine: [80, 150] },
      { text: 'hiciste un show especial', success: 0.50, reward: [200, 500], fine: [100, 200] },
      { text: 'trabajaste para un cliente VIP', success: 0.40, reward: [300, 700], fine: [150, 300] }
    ];

    const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
    const success = Math.random() < scenario.success;

    let embed;
    userData.lastSlut = now;

    if (success) {
      const amount = Math.floor(Math.random() * (scenario.reward[1] - scenario.reward[0])) + scenario.reward[0];
      userData.coins += amount;

      embed = new EmbedBuilder()
        .setColor('#e91e63')
        .setTitle('💋 ¡Trabajo Exitoso!')
        .setDescription(`✅ ${scenario.text} y ganaste **${amount.toLocaleString()}** 🪙`)
        .addFields({ name: '💰 Nuevo Balance', value: `${userData.coins.toLocaleString()} 🪙` });
    } else {
      const fine = Math.floor(Math.random() * (scenario.fine[1] - scenario.fine[0])) + scenario.fine[0];
      const actualFine = Math.min(fine, userData.coins);
      userData.coins -= actualFine;

      embed = new EmbedBuilder()
        .setColor('#e74c3c')
        .setTitle('❌ ¡Algo Salió Mal!')
        .setDescription(`Intentaste trabajar pero tuviste problemas.\n\nPérdida: **-${actualFine.toLocaleString()}** 🪙`)
        .addFields({ name: '💰 Nuevo Balance', value: `${userData.coins.toLocaleString()} 🪙` });
    }

    updateUser(interaction.user.id, userData);
    await interaction.reply({ embeds: [embed] });
  }
};
