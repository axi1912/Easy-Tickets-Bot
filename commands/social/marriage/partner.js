const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../../../utils/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('partner')
    .setDescription('💕 Ver información de tu pareja')
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('Ver pareja de otro usuario')
        .setRequired(false)),
  
  async execute(interaction) {
    const target = interaction.options.getUser('usuario') || interaction.user;
    const userData = getUser(target.id);

    if (!userData.marriedTo) {
      const message = target.id === interaction.user.id 
        ? '❌ No estás casado.' 
        : `❌ ${target.username} no está casado.`;
      return interaction.reply({ content: message, flags: 64 });
    }

    const partner = await interaction.client.users.fetch(userData.marriedTo).catch(() => null);
    if (!partner) {
      return interaction.reply({ content: '❌ No se pudo encontrar a la pareja.', flags: 64 });
    }

    const partnerData = getUser(userData.marriedTo);
    const marriedSince = userData.marriedAt ? `<t:${Math.floor(userData.marriedAt / 1000)}:R>` : 'Fecha desconocida';
    const daysMarried = userData.marriedAt ? Math.floor((Date.now() - userData.marriedAt) / 86400000) : 0;

    const embed = new EmbedBuilder()
      .setColor('#e91e63')
      .setTitle('💕 Información de Pareja')
      .setDescription(`**${target.username}** está casado con **${partner.username}**`)
      .setThumbnail(partner.displayAvatarURL())
      .addFields(
        { name: '💍 Casados desde', value: marriedSince, inline: true },
        { name: '📅 Días juntos', value: `${daysMarried} días`, inline: true },
        { name: '💰 Riqueza de la pareja', value: `${((userData.coins + userData.bank || 0) + (partnerData.coins + partnerData.bank || 0)).toLocaleString()} 🪙`, inline: true }
      )
      .setFooter({ text: '💕 ¡Feliz matrimonio!' });

    await interaction.reply({ embeds: [embed] });
  }
};
