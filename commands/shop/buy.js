const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, updateUser } = require('../../utils/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('buy')
    .setDescription('💳 Comprar un item de la tienda')
    .addStringOption(option =>
      option.setName('item')
        .setDescription('ID del item a comprar')
        .setRequired(true)
        .addChoices(
          { name: '🍀 Amuleto de la Suerte (5000🪙)', value: 'lucky_charm' },
          { name: '🛡️ Escudo Protector (3000🪙)', value: 'shield' },
          { name: '💎 Multiplicador x2 (10000🪙)', value: 'multiplier' },
          { name: '⚡ Boost Diario (2000🪙)', value: 'daily_boost' },
          { name: '👑 Título VIP (15000🪙)', value: 'vip_title' }
        )),
  
  async execute(interaction) {
    const itemId = interaction.options.getString('item');
    const userData = getUser(interaction.user.id);

    const shopItems = {
      'lucky_charm': { name: '🍀 Amuleto de la Suerte', price: 5000, duration: 86400000 },
      'shield': { name: '🛡️ Escudo Protector', price: 3000, duration: 43200000 },
      'multiplier': { name: '💎 Multiplicador x2', price: 10000, duration: 3600000 },
      'daily_boost': { name: '⚡ Boost Diario', price: 2000, duration: 604800000 },
      'vip_title': { name: '👑 Título VIP', price: 15000, duration: null }
    };

    const item = shopItems[itemId];
    if (!item) {
      return interaction.reply({ content: '❌ Item no encontrado. Usa `/shop` para ver items disponibles.', flags: 64 });
    }

    if (userData.coins < item.price) {
      return interaction.reply({ 
        content: `❌ No tienes suficientes monedas.\n💰 Precio: **${item.price.toLocaleString()}** 🪙\n💰 Tienes: **${userData.coins.toLocaleString()}** 🪙`, 
        flags: 64 
      });
    }

    // Verificar si ya tiene el item
    const existingItem = userData.inventory.find(i => i.id === itemId && i.expires > Date.now());
    if (existingItem) {
      return interaction.reply({ content: `❌ Ya tienes **${item.name}** activo.`, flags: 64 });
    }

    userData.coins -= item.price;
    
    if (itemId === 'vip_title') {
      if (!userData.titles) userData.titles = [];
      if (!userData.titles.includes('👑 VIP')) {
        userData.titles.push('👑 VIP');
      }
    } else {
      if (!userData.inventory) userData.inventory = [];
      userData.inventory.push({
        id: itemId,
        name: item.name,
        purchasedAt: Date.now(),
        expires: Date.now() + item.duration
      });
    }

    updateUser(interaction.user.id, userData);

    const embed = new EmbedBuilder()
      .setColor('#2ecc71')
      .setTitle('✅ Compra Exitosa')
      .setDescription(`Has comprado **${item.name}**`)
      .addFields(
        { name: '💰 Precio', value: `${item.price.toLocaleString()} 🪙`, inline: true },
        { name: '💵 Nuevo balance', value: `${userData.coins.toLocaleString()} 🪙`, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
