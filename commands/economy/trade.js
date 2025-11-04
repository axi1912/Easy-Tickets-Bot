const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, updateUser } = require('../../utils/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trade')
    .setDescription('🔄 Intercambiar items con otro usuario')
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('Usuario con quien comerciar')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('tu-item')
        .setDescription('Item que ofreces')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('su-item')
        .setDescription('Item que solicitas')
        .setRequired(true)),
  
  async execute(interaction) {
    const target = interaction.options.getUser('usuario');
    const userItem = interaction.options.getString('tu-item');
    const targetItem = interaction.options.getString('su-item');

    if (target.id === interaction.user.id) {
      return interaction.reply({ content: '❌ No puedes comerciar contigo mismo.', flags: 64 });
    }

    if (target.bot) {
      return interaction.reply({ content: '❌ No puedes comerciar con bots.', flags: 64 });
    }

    const userData = getUser(interaction.user.id);
    const targetData = getUser(target.id);

    // Verificar que el usuario tiene el item
    if (!userData.inventory || !userData.inventory.some(i => i.id === userItem)) {
      return interaction.reply({ content: `❌ No tienes el item "${userItem}" en tu inventario.`, flags: 64 });
    }

    // Verificar que el target tiene el item
    if (!targetData.inventory || !targetData.inventory.some(i => i.id === targetItem)) {
      return interaction.reply({ content: `❌ ${target.username} no tiene el item "${targetItem}" en su inventario.`, flags: 64 });
    }

    // Crear propuesta de trade
    if (!interaction.client.tradeProposals) {
      interaction.client.tradeProposals = new Map();
    }

    const proposalKey = `${interaction.user.id}_${target.id}`;
    
    if (interaction.client.tradeProposals.has(proposalKey)) {
      return interaction.reply({ content: '❌ Ya tienes un trade pendiente con este usuario.', flags: 64 });
    }

    // Verificar si hay propuesta inversa (auto-aceptar)
    const reverseKey = `${target.id}_${interaction.user.id}`;
    const reverseTrade = interaction.client.tradeProposals.get(reverseKey);
    
    if (reverseTrade && reverseTrade.userItem === targetItem && reverseTrade.targetItem === userItem) {
      // Trade aceptado - realizar intercambio
      interaction.client.tradeProposals.delete(reverseKey);
      
      // Remover items de inventarios
      userData.inventory = userData.inventory.filter(i => i.id !== userItem);
      targetData.inventory = targetData.inventory.filter(i => i.id !== targetItem);
      
      // Añadir items intercambiados
      const userNewItem = targetData.inventory.find(i => i.id === targetItem) || {
        id: targetItem,
        name: targetItem.replace('_', ' '),
        purchasedAt: Date.now(),
        expires: Date.now() + 604800000
      };
      
      const targetNewItem = userData.inventory.find(i => i.id === userItem) || {
        id: userItem,
        name: userItem.replace('_', ' '),
        purchasedAt: Date.now(),
        expires: Date.now() + 604800000
      };
      
      userData.inventory.push({ ...userNewItem, id: targetItem });
      targetData.inventory.push({ ...targetNewItem, id: userItem });
      
      updateUser(interaction.user.id, userData);
      updateUser(target.id, targetData);

      const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('🔄 Trade Completado')
        .setDescription(`✅ ${interaction.user} y ${target} han intercambiado items exitosamente!`)
        .addFields(
          { name: `${interaction.user.username} recibió`, value: `🎁 ${targetItem.replace('_', ' ')}`, inline: true },
          { name: `${target.username} recibió`, value: `🎁 ${userItem.replace('_', ' ')}`, inline: true }
        );

      return interaction.reply({ embeds: [embed] });
    }

    // Crear nueva propuesta
    interaction.client.tradeProposals.set(proposalKey, {
      from: interaction.user.id,
      to: target.id,
      userItem,
      targetItem,
      createdAt: Date.now()
    });

    setTimeout(() => {
      interaction.client.tradeProposals.delete(proposalKey);
    }, 300000); // 5 minutos

    const embed = new EmbedBuilder()
      .setColor('#3498db')
      .setTitle('🔄 Propuesta de Trade')
      .setDescription(`${interaction.user} quiere comerciar con ${target}!`)
      .addFields(
        { name: 'Ofrece', value: `🎁 ${userItem.replace('_', ' ')}`, inline: true },
        { name: 'Por', value: `🎁 ${targetItem.replace('_', ' ')}`, inline: true }
      )
      .setFooter({ text: `${target.username}, usa /trade para aceptar | Expira en 5 minutos` });

    await interaction.reply({ embeds: [embed] });
  }
};
