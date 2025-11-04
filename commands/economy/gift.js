const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, updateUser } = require('../../utils/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gift')
    .setDescription('🎁 Regalar un item a otro usuario')
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('Usuario a quien regalar')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('item')
        .setDescription('Item que deseas regalar')
        .setRequired(true)),
  
  async execute(interaction) {
    const target = interaction.options.getUser('usuario');
    const itemId = interaction.options.getString('item');

    if (target.id === interaction.user.id) {
      return interaction.reply({ content: '❌ No puedes regalarte items a ti mismo.', flags: 64 });
    }

    if (target.bot) {
      return interaction.reply({ content: '❌ No puedes regalar items a bots.', flags: 64 });
    }

    const userData = getUser(interaction.user.id);
    const targetData = getUser(target.id);

    if (!userData.inventory || !userData.inventory.some(i => i.id === itemId)) {
      return interaction.reply({ 
        content: `❌ No tienes el item "${itemId}" en tu inventario.`, 
        flags: 64 
      });
    }

    // Encontrar y remover el item del usuario
    const itemIndex = userData.inventory.findIndex(i => i.id === itemId);
    const item = userData.inventory[itemIndex];
    userData.inventory.splice(itemIndex, 1);

    // Añadir item al objetivo
    if (!targetData.inventory) targetData.inventory = [];
    targetData.inventory.push({
      ...item,
      purchasedAt: Date.now(),
      gifted: true,
      giftedBy: interaction.user.id
    });

    updateUser(interaction.user.id, userData);
    updateUser(target.id, targetData);

    const embed = new EmbedBuilder()
      .setColor('#e91e63')
      .setTitle('🎁 Regalo Enviado')
      .setDescription(`${interaction.user} le ha regalado un item a ${target}!`)
      .addFields({ name: 'Item', value: `🎁 ${item.name || itemId.replace('_', ' ')}` })
      .setFooter({ text: '¡Qué generoso!' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    // Notificar al receptor (si está en el mismo servidor)
    try {
      await target.send({
        embeds: [
          new EmbedBuilder()
            .setColor('#e91e63')
            .setTitle('🎁 ¡Has Recibido un Regalo!')
            .setDescription(`${interaction.user.username} te ha regalado: **${item.name || itemId.replace('_', ' ')}**`)
            .setFooter({ text: 'Úsalo sabiamente' })
        ]
      });
    } catch (error) {
      // Usuario tiene DMs desactivados
    }
  }
};
