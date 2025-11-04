// ==========================================
// COMANDO: HIGHER OR LOWER
// Juego de predecir si el siguiente número es mayor o menor
// ==========================================

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getUser, updateUser } = require('../../utils/economy');
const { addBattlePassXP } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('highlow')
    .setDescription('📊 Adivina si el siguiente número será mayor o menor')
    .addIntegerOption(option =>
      option.setName('apuesta')
        .setDescription('Cantidad de monedas a apostar')
        .setRequired(true)
        .setMinValue(1)),

  async execute(interaction) {
    const bet = interaction.options.getInteger('apuesta');
    const userData = getUser(interaction.user.id);

    if (userData.coins < bet) {
      return interaction.reply({ 
        content: `❌ No tienes suficientes monedas. Tienes: **${userData.coins.toLocaleString()}** 🪙`, 
        ephemeral: true 
      });
    }

    const currentNumber = Math.floor(Math.random() * 100) + 1;
    const gameId = `${interaction.user.id}_${Date.now()}`;
    
    // Guardar juego en el mapa global de juegos activos
    if (!interaction.client.activeGames) {
      interaction.client.activeGames = new Map();
    }
    
    interaction.client.activeGames.set(gameId, {
      currentNumber,
      streak: 0,
      bet,
      userId: interaction.user.id,
      processing: false
    });

    const embed = new EmbedBuilder()
      .setColor('#9b59b6')
      .setTitle('📊 Higher or Lower')
      .setDescription(`🎲 **Número actual: ${currentNumber}**\n\n❓ **¿El siguiente será mayor o menor?**\n\n🔥 Construye rachas para ganar más!\n💰 Puedes cobrar en cualquier momento`)
      .addFields(
        { name: '💰 Apuesta', value: `${bet.toLocaleString()} 🪙`, inline: true },
        { name: '🔥 Racha', value: '**0**', inline: true },
        { name: '💎 Multiplicador', value: '**1x**', inline: true },
        { name: '🏆 Premios', value: '**Racha 5:** 10x 💎\n**Racha 3:** 5x ⭐\n**Racha 1:** 2x ✨', inline: false }
      )
      .setFooter({ text: '🎮 ¡Elige sabiamente!' });

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`hl_higher_${gameId}`)
        .setLabel('⬆️ Mayor')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`hl_lower_${gameId}`)
        .setLabel('⬇️ Menor')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`hl_cashout_${gameId}`)
        .setLabel('💰 Cobrar')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true)
    );

    await interaction.reply({ embeds: [embed], components: [buttons] });
  }
};
