const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, updateUser } = require('../../utils/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('crash')
    .setDescription('📈 Juego de multiplicador - Retírate antes del crash')
    .addIntegerOption(option =>
      option.setName('apuesta')
        .setDescription('Cantidad a apostar')
        .setRequired(true)
        .setMinValue(100)),
  
  async execute(interaction) {
    const bet = interaction.options.getInteger('apuesta');
    const userData = getUser(interaction.user.id);

    if (userData.coins < bet) {
      return interaction.reply({ 
        content: `❌ No tienes suficientes monedas. Tienes: **${userData.coins.toLocaleString()} 🪙`, 
        flags: 64 
      });
    }

    // Verificar juego activo
    const gameKey = `crash_${interaction.user.id}`;
    if (interaction.client.activeGames && interaction.client.activeGames.has(gameKey)) {
      return interaction.reply({ 
        content: '❌ Ya tienes un juego de Crash activo.', 
        flags: 64 
      });
    }

    // Generar punto de crash (1.0x a 10.0x con probabilidades ponderadas)
    const rand = Math.random();
    let crashPoint;
    
    if (rand < 0.40) {
      crashPoint = 1.0 + Math.random() * 0.5; // 40%: 1.0x-1.5x
    } else if (rand < 0.70) {
      crashPoint = 1.5 + Math.random() * 1.0; // 30%: 1.5x-2.5x
    } else if (rand < 0.90) {
      crashPoint = 2.5 + Math.random() * 2.5; // 20%: 2.5x-5.0x
    } else {
      crashPoint = 5.0 + Math.random() * 5.0; // 10%: 5.0x-10.0x
    }

    // Simular animación del multiplicador
    const multipliers = [];
    let current = 1.0;
    while (current < crashPoint) {
      multipliers.push(current);
      current += 0.1;
      if (current >= 5.0) {
        current += 0.5; // Acelerar después de 5x
      }
    }

    // Mostrar juego
    const embed = new EmbedBuilder()
      .setColor('#f39c12')
      .setTitle('📈 Crash Game')
      .setDescription(`**Multiplicador:** 1.00x\n**Apuesta:** ${bet.toLocaleString()} 🪙\n\n🚀 El cohete está despegando...`)
      .setFooter({ text: 'El crash puede ocurrir en cualquier momento!' });

    await interaction.reply({ embeds: [embed] });

    // Simular el juego con delays
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Elegir punto de cashout automático (70% de la distancia al crash)
    const autoCashout = 1.0 + (crashPoint - 1.0) * 0.7;
    
    if (Math.random() < 0.6) {
      // 60% - Cashout exitoso
      const finalMultiplier = Math.min(autoCashout, crashPoint - 0.1);
      const winnings = Math.floor(bet * finalMultiplier);
      
      userData.coins += winnings - bet;
      if (!userData.stats) userData.stats = {};
      userData.stats.gamesPlayed = (userData.stats.gamesPlayed || 0) + 1;
      userData.stats.gamesWon = (userData.stats.gamesWon || 0) + 1;
      userData.stats.totalWinnings = (userData.stats.totalWinnings || 0) + (winnings - bet);
      updateUser(interaction.user.id, userData);

      const { addBattlePassXP } = require('../../utils/helpers');
      const xpResult = addBattlePassXP(userData, Math.floor((winnings - bet) / 10));
      updateUser(interaction.user.id, userData);

      const winEmbed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('📈 ¡Cashout Exitoso!')
        .setDescription(
          `💰 **Retiraste en ${finalMultiplier.toFixed(2)}x**\n\n` +
          `Apuesta: ${bet.toLocaleString()} 🪙\n` +
          `Ganancia: **+${(winnings - bet).toLocaleString()} 🪙**\n` +
          `Total recibido: ${winnings.toLocaleString()} 🪙\n\n` +
          `⚠️ El crash ocurrió en **${crashPoint.toFixed(2)}x**`
        )
        .addFields(
          { name: '💰 Nuevo Balance', value: `${userData.coins.toLocaleString()} 🪙`, inline: true },
          { name: '⭐ XP Ganado', value: `+${xpResult.finalXP} XP`, inline: true }
        );

      await interaction.editReply({ embeds: [winEmbed] });
    } else {
      // 40% - Crash antes de cashout
      userData.coins -= bet;
      if (!userData.stats) userData.stats = {};
      userData.stats.gamesPlayed = (userData.stats.gamesPlayed || 0) + 1;
      userData.stats.totalLosses = (userData.stats.totalLosses || 0) + bet;
      updateUser(interaction.user.id, userData);

      const loseEmbed = new EmbedBuilder()
        .setColor('#e74c3c')
        .setTitle('💥 ¡CRASH!')
        .setDescription(
          `💔 **El cohete explotó en ${crashPoint.toFixed(2)}x**\n\n` +
          `Apuesta perdida: **-${bet.toLocaleString()} 🪙**`
        )
        .addFields({ name: '💰 Nuevo Balance', value: `${userData.coins.toLocaleString()} 🪙` })
        .setFooter({ text: '¡Mejor suerte la próxima vez!' });

      await interaction.editReply({ embeds: [loseEmbed] });
    }

    if (interaction.client.activeGames) {
      interaction.client.activeGames.delete(gameKey);
    }
  }
};
