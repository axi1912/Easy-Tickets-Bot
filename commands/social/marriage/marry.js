const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, updateUser } = require('../../../utils/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('marry')
    .setDescription('💍 Casarte con otro usuario')
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('Usuario con quien casarte')
        .setRequired(true)),
  
  async execute(interaction) {
    const target = interaction.options.getUser('usuario');
    const userData = getUser(interaction.user.id);
    const targetData = getUser(target.id);

    if (target.id === interaction.user.id) {
      return interaction.reply({ content: '❌ No puedes casarte contigo mismo.', flags: 64 });
    }

    if (target.bot) {
      return interaction.reply({ content: '❌ No puedes casarte con un bot.', flags: 64 });
    }

    if (userData.marriedTo) {
      const partner = await interaction.client.users.fetch(userData.marriedTo).catch(() => null);
      return interaction.reply({ 
        content: `❌ Ya estás casado con ${partner ? partner.username : 'alguien'}. Usa \`/divorce\` primero.`, 
        flags: 64 
      });
    }

    if (targetData.marriedTo) {
      return interaction.reply({ content: `❌ ${target.username} ya está casado con alguien.`, flags: 64 });
    }

    const cost = 10000;
    if (userData.coins < cost) {
      return interaction.reply({ 
        content: `❌ Necesitas **${cost.toLocaleString()} 🪙** para casarte. Tienes: **${userData.coins.toLocaleString()} 🪙**`, 
        flags: 64 
      });
    }

    // Crear propuesta temporal
    if (!interaction.client.marriageProposals) {
      interaction.client.marriageProposals = new Map();
    }

    const proposalKey = `${interaction.user.id}_${target.id}`;
    
    // Verificar si ya hay una propuesta pendiente
    if (interaction.client.marriageProposals.has(proposalKey)) {
      return interaction.reply({ 
        content: '❌ Ya tienes una propuesta pendiente con este usuario.', 
        flags: 64 
      });
    }

    // Verificar si el target ya propuso al user
    const reverseKey = `${target.id}_${interaction.user.id}`;
    if (interaction.client.marriageProposals.has(reverseKey)) {
      // Auto-aceptar
      interaction.client.marriageProposals.delete(reverseKey);
      
      userData.coins -= cost;
      userData.marriedTo = target.id;
      userData.marriedAt = Date.now();
      
      targetData.marriedTo = interaction.user.id;
      targetData.marriedAt = Date.now();
      
      updateUser(interaction.user.id, userData);
      updateUser(target.id, targetData);

      const embed = new EmbedBuilder()
        .setColor('#e91e63')
        .setTitle('💍 ¡Boda!')
        .setDescription(`${interaction.user} y ${target} se han casado! 🎉`)
        .addFields({ name: '💰 Costo', value: `${cost.toLocaleString()} 🪙` })
        .setFooter({ text: '¡Felicidades a la pareja!' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // Crear nueva propuesta
    interaction.client.marriageProposals.set(proposalKey, {
      from: interaction.user.id,
      to: target.id,
      createdAt: Date.now()
    });

    // Auto-expirar en 5 minutos
    setTimeout(() => {
      interaction.client.marriageProposals.delete(proposalKey);
    }, 300000);

    const embed = new EmbedBuilder()
      .setColor('#e91e63')
      .setTitle('💍 Propuesta de Matrimonio')
      .setDescription(`${interaction.user} le ha propuesto matrimonio a ${target}!\n\n` +
        `${target}, usa \`/marry @${interaction.user.username}\` para aceptar la propuesta.\n\n` +
        `💰 Costo: **${cost.toLocaleString()} 🪙**`)
      .setFooter({ text: 'La propuesta expira en 5 minutos' });

    await interaction.reply({ embeds: [embed] });
  }
};
