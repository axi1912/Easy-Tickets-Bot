const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getUser, updateUser } = require('../../utils/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('duel')
    .setDescription('⚔️ Desafiar a otro usuario a un duelo')
    .addUserOption(option =>
      option.setName('oponente')
        .setDescription('Usuario a desafiar')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('apuesta')
        .setDescription('Cantidad a apostar')
        .setRequired(true)
        .setMinValue(100)),
  
  async execute(interaction) {
    const opponent = interaction.options.getUser('oponente');
    const bet = interaction.options.getInteger('apuesta');
    const userData = getUser(interaction.user.id);
    const opponentData = getUser(opponent.id);

    if (opponent.id === interaction.user.id) {
      return interaction.reply({ content: '❌ No puedes desafiarte a ti mismo.', flags: 64 });
    }

    if (opponent.bot) {
      return interaction.reply({ content: '❌ No puedes desafiar a un bot.', flags: 64 });
    }

    if (userData.coins < bet) {
      return interaction.reply({ 
        content: `❌ No tienes suficientes monedas. Tienes: **${userData.coins.toLocaleString()} 🪙`, 
        flags: 64 
      });
    }

    if (opponentData.coins < bet) {
      return interaction.reply({ 
        content: `❌ ${opponent.username} no tiene suficientes monedas para este duelo.`, 
        flags: 64 
      });
    }

    // Crear propuesta de duelo
    if (!interaction.client.duelProposals) {
      interaction.client.duelProposals = new Map();
    }

    const duelKey = `${interaction.user.id}_${opponent.id}`;
    
    if (interaction.client.duelProposals.has(duelKey)) {
      return interaction.reply({ content: '❌ Ya tienes un duelo pendiente con este usuario.', flags: 64 });
    }

    // Crear botones de aceptar/rechazar
    const acceptButton = new ButtonBuilder()
      .setCustomId(`duel_accept_${interaction.user.id}_${opponent.id}_${bet}`)
      .setLabel('⚔️ Aceptar Duelo')
      .setStyle(ButtonStyle.Success);

    const declineButton = new ButtonBuilder()
      .setCustomId(`duel_decline_${interaction.user.id}_${opponent.id}`)
      .setLabel('❌ Rechazar')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(acceptButton, declineButton);

    interaction.client.duelProposals.set(duelKey, {
      challenger: interaction.user.id,
      opponent: opponent.id,
      bet: bet,
      createdAt: Date.now()
    });

    // Auto-expirar en 60 segundos
    setTimeout(() => {
      interaction.client.duelProposals.delete(duelKey);
    }, 60000);

    const embed = new EmbedBuilder()
      .setColor('#e74c3c')
      .setTitle('⚔️ Desafío de Duelo')
      .setDescription(
        `${interaction.user} ha desafiado a ${opponent} a un duelo!\n\n` +
        `💰 **Apuesta:** ${bet.toLocaleString()} 🪙\n` +
        `🏆 **El ganador se lleva:** ${(bet * 2).toLocaleString()} 🪙\n\n` +
        `${opponent}, ¿aceptas el desafío?`
      )
      .setFooter({ text: 'El desafío expira en 60 segundos' });

    await interaction.reply({ content: `${opponent}`, embeds: [embed], components: [row] });
  }
};
