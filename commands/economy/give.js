// ==========================================
// COMANDO: /give
// Descripción: Transferir monedas a otro usuario
// ==========================================

const { EmbedBuilder } = require('discord.js');
const { getUser, updateUser, transferCoins } = require('../../utils/economy');
const config = require('../../config/constants');

module.exports = {
  name: 'give',
  description: 'Regalar monedas a otro usuario',
  category: 'economy',
  
  async execute(interaction) {
    const targetUser = interaction.options.getUser('usuario');
    const amount = interaction.options.getInteger('cantidad');

    // Validaciones
    if (targetUser.id === interaction.user.id) {
      return interaction.reply({ content: '❌ No puedes regalarte monedas a ti mismo.', flags: 64 });
    }

    if (targetUser.bot) {
      return interaction.reply({ content: '❌ No puedes regalar monedas a un bot.', flags: 64 });
    }

    if (amount <= 0) {
      return interaction.reply({ content: '❌ La cantidad debe ser mayor a 0.', flags: 64 });
    }

    const senderData = getUser(interaction.user.id);
    
    // Calcular comisión
    const commission = Math.floor(amount * config.ECONOMY.TRANSFER_COMMISSION);
    const totalCost = amount + commission;

    if (senderData.coins < totalCost) {
      return interaction.reply({ 
        content: `❌ No tienes suficientes monedas.\n💰 Necesitas: **${totalCost.toLocaleString()}** 🪙 (${amount.toLocaleString()} + ${commission.toLocaleString()} comisión)\n💰 Tienes: **${senderData.coins.toLocaleString()}** 🪙`, 
        flags: 64 
      });
    }

    // Realizar transferencia
    senderData.coins -= totalCost;
    updateUser(interaction.user.id, senderData);

    const receiverData = getUser(targetUser.id);
    receiverData.coins += amount;
    updateUser(targetUser.id, receiverData);

    const embed = new EmbedBuilder()
      .setColor('#3498db')
      .setTitle('💸 Transferencia Exitosa')
      .setDescription(`**${interaction.user.username}** ha enviado **${amount.toLocaleString()}** 🪙 a **${targetUser.username}**`)
      .addFields(
        { name: '💰 Monto enviado', value: `${amount.toLocaleString()} 🪙`, inline: true },
        { name: '📊 Comisión (5%)', value: `${commission.toLocaleString()} 🪙`, inline: true },
        { name: '💵 Total cobrado', value: `${totalCost.toLocaleString()} 🪙`, inline: true },
        { name: 'Tu nuevo balance', value: `${senderData.coins.toLocaleString()} 🪙`, inline: true },
        { name: 'Balance de ' + targetUser.username, value: `${receiverData.coins.toLocaleString()} 🪙`, inline: true }
      )
      .setFooter({ text: '💡 Tip: Las transferencias tienen una comisión del 5%' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
