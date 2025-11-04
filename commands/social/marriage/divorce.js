const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, updateUser } = require('../../../utils/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('divorce')
    .setDescription('💔 Divorciarte de tu pareja'),
  
  async execute(interaction) {
    const userData = getUser(interaction.user.id);

    if (!userData.marriedTo) {
      return interaction.reply({ content: '❌ No estás casado.', flags: 64 });
    }

    const partnerId = userData.marriedTo;
    const partnerData = getUser(partnerId);
    const partner = await interaction.client.users.fetch(partnerId).catch(() => null);

    const cost = 5000;
    if (userData.coins < cost) {
      return interaction.reply({ 
        content: `❌ Necesitas **${cost.toLocaleString()} 🪙** para divorciarte. Tienes: **${userData.coins.toLocaleString()} 🪙**`, 
        flags: 64 
      });
    }

    userData.coins -= cost;
    userData.marriedTo = null;
    userData.divorcedAt = Date.now();
    
    partnerData.marriedTo = null;
    partnerData.divorcedAt = Date.now();
    
    updateUser(interaction.user.id, userData);
    updateUser(partnerId, partnerData);

    const embed = new EmbedBuilder()
      .setColor('#e74c3c')
      .setTitle('💔 Divorcio')
      .setDescription(`${interaction.user} y ${partner ? partner.username : 'su pareja'} se han divorciado.`)
      .addFields({ name: '💰 Costo', value: `${cost.toLocaleString()} 🪙` })
      .setFooter({ text: 'F por la relación' });

    await interaction.reply({ embeds: [embed] });
  }
};
