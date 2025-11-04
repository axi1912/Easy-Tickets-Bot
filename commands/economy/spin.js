const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, updateUser } = require('../../utils/economy');
const { addBattlePassXP } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('spin')
    .setDescription('🎰 Gira la ruleta de premios diaria (gratis)'),
  
  async execute(interaction) {
    const userData = getUser(interaction.user.id);
    const now = Date.now();
    const cooldown = 86400000; // 24 horas

    if (userData.lastSpin && (now - userData.lastSpin) < cooldown) {
      const timeLeft = cooldown - (now - userData.lastSpin);
      const hours = Math.floor(timeLeft / 3600000);
      return interaction.reply({ 
        content: `⏰ Ya has usado la ruleta hoy. Vuelve en **${hours}** horas.`, 
        flags: 64 
      });
    }

    const loadingEmbed = new EmbedBuilder()
      .setColor('#f39c12')
      .setTitle('🎰 Ruleta de Premios')
      .setDescription('🎲 **Girando la ruleta...**');

    await interaction.reply({ embeds: [loadingEmbed] });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const prizes = [
      { name: '💰 50 Monedas', value: 50, emoji: '💰', chance: 30 },
      { name: '💵 100 Monedas', value: 100, emoji: '💵', chance: 25 },
      { name: '💎 250 Monedas', value: 250, emoji: '💎', chance: 20 },
      { name: '🌟 500 Monedas', value: 500, emoji: '🌟', chance: 15 },
      { name: '👑 1000 Monedas', value: 1000, emoji: '👑', chance: 7 },
      { name: '🎁 Item Aleatorio', value: 'item', emoji: '🎁', chance: 3 }
    ];

    let roll = Math.random() * 100;
    let selectedPrize = null;
    
    for (let prize of prizes) {
      if (roll <= prize.chance) {
        selectedPrize = prize;
        break;
      }
      roll -= prize.chance;
    }

    if (!selectedPrize) selectedPrize = prizes[0];

    const bpXPRewards = { 50: 10, 100: 15, 250: 25, 500: 40, 1000: 80, item: 30 };
    const bpXP = bpXPRewards[selectedPrize.value] || 10;

    if (selectedPrize.value === 'item') {
      const items = ['lucky_charm', 'shield', 'multiplier', 'daily_boost'];
      const randomItem = items[Math.floor(Math.random() * items.length)];
      if (!userData.inventory) userData.inventory = [];
      userData.inventory.push({
        id: randomItem,
        name: randomItem.replace('_', ' '),
        purchasedAt: Date.now(),
        expires: Date.now() + 86400000
      });
      selectedPrize.name = `🎁 ${randomItem.replace('_', ' ')}`;
    } else {
      userData.coins += selectedPrize.value;
    }

    const xpResult = addBattlePassXP(userData, bpXP);
    userData.lastSpin = now;
    updateUser(interaction.user.id, userData);

    const resultEmbed = new EmbedBuilder()
      .setColor('#2ecc71')
      .setTitle('🎰 ¡Resultado de la Ruleta!')
      .setDescription(`${selectedPrize.emoji} **${selectedPrize.name}**`)
      .addFields(
        { name: '💰 Nuevo Balance', value: `${userData.coins.toLocaleString()} 🪙`, inline: true },
        { name: '⭐ XP Ganado', value: `+${xpResult.finalXP} XP${xpResult.hasBoost ? ' 🔥' : ''}`, inline: true },
        { name: '⏰ Próximo Spin', value: 'En 24 horas', inline: true }
      )
      .setFooter({ text: '🎰 ¡Vuelve mañana para otro spin gratis!' })
      .setTimestamp();

    await interaction.editReply({ embeds: [resultEmbed] });
  }
};
