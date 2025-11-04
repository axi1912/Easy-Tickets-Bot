const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../../utils/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('🛒 Ver la tienda de items especiales'),
  
  async execute(interaction) {
    const shopItems = [
      { id: 'lucky_charm', name: '🍀 Amuleto de la Suerte', price: 5000, description: '+10% de probabilidad de ganar por 24h' },
      { id: 'shield', name: '🛡️ Escudo Protector', price: 3000, description: 'Protege el 50% de pérdidas por 12h' },
      { id: 'multiplier', name: '💎 Multiplicador x2', price: 10000, description: 'Duplica ganancias por 1 hora' },
      { id: 'daily_boost', name: '⚡ Boost Diario', price: 2000, description: 'Daily da 500 monedas extra por 7 días' },
      { id: 'vip_title', name: '👑 Título VIP', price: 15000, description: 'Título permanente "VIP" en tu perfil' }
    ];

    const userData = getUser(interaction.user.id);
    
    const embed = new EmbedBuilder()
      .setColor('#f1c40f')
      .setTitle('🛒 Tienda de Items')
      .setDescription('Compra items especiales con tus monedas. Usa `/buy <nombre>` para comprar.\n━━━━━━━━━━━━━━━━━━━━')
      .setFooter({ text: `💰 Tu balance: ${userData.coins.toLocaleString()} 🪙` });

    shopItems.forEach(item => {
      embed.addFields({
        name: `${item.name} - ${item.price.toLocaleString()} 🪙`,
        value: `${item.description}\n\`/buy ${item.id}\``,
        inline: false
      });
    });

    await interaction.reply({ embeds: [embed] });
  }
};
