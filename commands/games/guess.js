// ==========================================
// COMANDO: ADIVINA EL NÚMERO
// Juego de adivinanza 1-100 con intentos
// ==========================================

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, updateUser } = require('../../utils/economy');
const { addBattlePassXP } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('guess')
    .setDescription('🔢 Adivina el número del 1 al 100')
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

    // Verificar si ya tiene una partida activa
    const gameKey = `guess_${interaction.user.id}`;
    if (interaction.client.activeGames && interaction.client.activeGames.has(gameKey)) {
      return interaction.reply({ 
        content: '❌ Ya tienes una partida de adivinanza en curso. Termínala antes de empezar otra.', 
        ephemeral: true 
      });
    }

    const targetNumber = Math.floor(Math.random() * 100) + 1;
    
    // Guardar el juego activo
    if (!interaction.client.activeGames) {
      interaction.client.activeGames = new Map();
    }
    
    interaction.client.activeGames.set(gameKey, {
      targetNumber,
      attempts: 0,
      maxAttempts: 5,
      bet,
      userId: interaction.user.id,
      channelId: interaction.channel.id
    });

    const embed = new EmbedBuilder()
      .setColor('#3498db')
      .setTitle('🔢 Adivina el Número')
      .setDescription('╔════════════════════════╗\n║                                            ║\n║  🎯 **PENSANDO UN NÚMERO** 🎯  ║\n║      **Del 1 al 100**      ║\n║                                            ║\n╚════════════════════════╝\n\n🎮 Tienes **5 intentos** para adivinarlo.\n💡 Cuantos menos intentos uses, **¡MÁS GANAS!**\n\n✍️ **Escribe un número en el chat**')
      .addFields(
        { name: '💰 Apuesta', value: `**${bet.toLocaleString()}** 🪙`, inline: true },
        { name: '🎯 Intentos', value: '**5** restantes', inline: true },
        { name: '🏆 Multiplicadores', value: '🥇 **1 intento:** 5x\n🥈 **2 intentos:** 4x\n🥉 **3 intentos:** 3x\n🎖️ **4 intentos:** 2x\n⭐ **5 intentos:** 1x', inline: false }
      )
      .setFooter({ text: '💭 Piensa bien... cada intento cuenta!' });

    await interaction.reply({ embeds: [embed] });

    // Collector para las respuestas
    const filter = m => m.author.id === interaction.user.id;
    const collector = interaction.channel.createMessageCollector({ filter, time: 120000, max: 5 });

    collector.on('collect', async (message) => {
      const gameData = interaction.client.activeGames.get(gameKey);
      if (!gameData) return;

      const guess = parseInt(message.content);
      if (isNaN(guess) || guess < 1 || guess > 100) {
        return message.reply('❌ Debes escribir un número válido entre 1 y 100.');
      }

      gameData.attempts++;
      const remaining = gameData.maxAttempts - gameData.attempts;

      if (guess === gameData.targetNumber) {
        // ¡Ganó!
        collector.stop('won');
        const multipliers = [5, 4, 3, 2, 1];
        const multiplier = multipliers[gameData.attempts - 1];
        const winnings = bet * multiplier;
        const baseXP = 40 + (10 * (6 - gameData.attempts));
        
        userData.coins += winnings - bet;
        const xpResult = addBattlePassXP(userData, baseXP);
        userData.stats.gamesWon++;
        userData.stats.totalWinnings += winnings - bet;
        userData.stats.gamesPlayed++;
        updateUser(interaction.user.id, userData);

        const winEmbed = new EmbedBuilder()
          .setColor('#2ecc71')
          .setTitle('🎉 ¡ACERTASTE!')
          .setDescription(`╔═══════════════════╗\n║  🎯 **NÚMERO: ${gameData.targetNumber}** 🎯  ║\n║  🏆 **GANASTE** 🏆   ║\n╚═══════════════════╝`)
          .addFields(
            { name: '🎮 Intentos usados', value: `**${gameData.attempts}**/5`, inline: true },
            { name: '💰 Ganancia', value: `**+${(winnings - bet).toLocaleString()} 🪙** (${multiplier}x)`, inline: true },
            { name: '⭐ XP', value: `**+${xpResult.finalXP} XP${xpResult.hasBoost ? ' 🔥' : ''}**`, inline: true }
          )
          .setFooter({ text: `💰 Nuevo balance: ${userData.coins.toLocaleString()} 🪙` });

        interaction.client.activeGames.delete(gameKey);
        return message.reply({ embeds: [winEmbed] });
      } else {
        // No acertó
        const hint = guess < gameData.targetNumber ? '⬆️ **MÁS ALTO**' : '⬇️ **MÁS BAJO**';
        
        if (remaining === 0) {
          // Perdió
          collector.stop('lost');
          userData.coins -= bet;
          userData.stats.gamesLost++;
          userData.stats.totalLosses += bet;
          userData.stats.gamesPlayed++;
          updateUser(interaction.user.id, userData);

          const loseEmbed = new EmbedBuilder()
            .setColor('#e74c3c')
            .setTitle('❌ ¡SE ACABARON LOS INTENTOS!')
            .setDescription(`╔═══════════════════╗\n║  🎯 Era el **${gameData.targetNumber}** 🎯  ║\n║  💔 **PERDISTE** 💔   ║\n║    **-${bet.toLocaleString()} 🪙**    ║\n╚═══════════════════╝`)
            .setFooter({ text: `💰 Nuevo balance: ${userData.coins.toLocaleString()} 🪙` });

          interaction.client.activeGames.delete(gameKey);
          return message.reply({ embeds: [loseEmbed] });
        } else {
          const hintEmbed = new EmbedBuilder()
            .setColor('#f39c12')
            .setTitle('🔍 Pista')
            .setDescription(`**${guess}** → ${hint}\n\n🎯 Intentos restantes: **${remaining}**`)
            .setFooter({ text: '¡Sigue intentando!' });

          return message.reply({ embeds: [hintEmbed] });
        }
      }
    });

    collector.on('end', (collected, reason) => {
      if (reason === 'time') {
        interaction.client.activeGames.delete(gameKey);
        interaction.followUp('⏱️ Se acabó el tiempo. El juego ha terminado.');
      }
    });
  }
};
