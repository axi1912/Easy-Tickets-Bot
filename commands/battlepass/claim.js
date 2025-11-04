const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, updateUser } = require('../../utils/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('claim')
    .setDescription('🎁 Reclamar recompensas del Battle Pass'),
  
  async execute(interaction) {
    const userData = getUser(interaction.user.id);
    
    const level = userData.battlePassLevel || 1;
    const claimed = userData.battlePassClaimed || [];

    const rewards = {
      5: { coins: 5000, type: 'coins' },
      10: { item: 'lucky_charm', type: 'item' },
      15: { coins: 10000, type: 'coins' },
      20: { item: 'shield', type: 'item' },
      25: { coins: 25000, type: 'coins' },
      30: { item: 'multiplier', type: 'item' },
      35: { coins: 50000, type: 'coins' },
      40: { title: 'Battle Master', type: 'title' },
      50: { coins: 100000, title: 'Legendary Warrior', type: 'both' }
    };

    let claimedRewards = [];
    let totalCoins = 0;

    for (let [lvl, reward] of Object.entries(rewards)) {
      const rewardLevel = parseInt(lvl);
      if (level >= rewardLevel && !claimed.includes(rewardLevel)) {
        claimed.push(rewardLevel);
        
        if (reward.type === 'coins' || reward.type === 'both') {
          userData.coins += reward.coins;
          totalCoins += reward.coins;
          claimedRewards.push(`💰 ${reward.coins.toLocaleString()} monedas (Nivel ${rewardLevel})`);
        }
        
        if (reward.type === 'item' || reward.type === 'both') {
          if (!userData.inventory) userData.inventory = [];
          userData.inventory.push({
            id: reward.item,
            name: reward.item.replace('_', ' '),
            purchasedAt: Date.now(),
            expires: Date.now() + 604800000 // 7 días
          });
          claimedRewards.push(`🎁 ${reward.item.replace('_', ' ')} (Nivel ${rewardLevel})`);
        }
        
        if (reward.type === 'title' || reward.type === 'both') {
          if (!userData.titles) userData.titles = [];
          if (!userData.titles.includes(reward.title)) {
            userData.titles.push(reward.title);
          }
          claimedRewards.push(`👑 Título "${reward.title}" (Nivel ${rewardLevel})`);
        }
      }
    }

    if (claimedRewards.length === 0) {
      return interaction.reply({ 
        content: '❌ No tienes recompensas por reclamar. Sube de nivel para desbloquear más.', 
        flags: 64 
      });
    }

    userData.battlePassClaimed = claimed;
    updateUser(interaction.user.id, userData);

    const embed = new EmbedBuilder()
      .setColor('#2ecc71')
      .setTitle('🎁 ¡Recompensas Reclamadas!')
      .setDescription(claimedRewards.join('\n'))
      .addFields({ name: '💰 Nuevo Balance', value: `${userData.coins.toLocaleString()} 🪙` })
      .setFooter({ text: '¡Sigue subiendo de nivel para más recompensas!' });

    await interaction.reply({ embeds: [embed] });
  }
};
