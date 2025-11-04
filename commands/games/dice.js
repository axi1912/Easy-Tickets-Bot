const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, updateUser } = require('../../utils/economy');
const { addBattlePassXP } = require('../../utils/helpers');

let activeGames = new Map();

const setActiveGames = (gamesMap) => {
  activeGames = gamesMap;
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dice')
    .setDescription('🎲 Tira los dados y gana según el total')
    .addIntegerOption(option =>
      option.setName('apuesta')
        .setDescription('Cantidad a apostar')
        .setRequired(true)
        .setMinValue(1)),
  
  setActiveGames,
  
  async execute(interaction) {
    const bet = interaction.options.getInteger('apuesta');
    const userData = getUser(interaction.user.id);

    if (bet <= 0) {
      return interaction.reply({ content: '❌ La apuesta debe ser mayor a 0.', flags: 64 });
    }

    if (userData.coins < bet) {
      return interaction.reply({ content: `❌ No tienes suficientes monedas. Tienes: **${userData.coins.toLocaleString()}** 🪙`, flags: 64 });
    }

    const gameId = `dice_${interaction.user.id}_${Date.now()}`;
    for (const g of activeGames.values()) {
      if (g.userId === interaction.user.id && g.game === 'dice') {
        return interaction.reply({ content: '❌ Ya tienes un juego de dados en curso. Espera a que termine.', flags: 64 });
      }
    }

    activeGames.set(gameId, { userId: interaction.user.id, game: 'dice', bet });

    const loadingEmbed = new EmbedBuilder()
      .setColor('#e74c3c')
      .setTitle('🎲 Dados')
      .setDescription('╔══════════════════╗\n║                                      ║\n║      🎲 **LANZANDO** 🎲     ║\n║                                      ║\n╚══════════════════╝')
      .addFields(
        { name: '💰 Apuesta', value: `**${bet.toLocaleString()}** 🪙`, inline: true },
        { name: '🎯 Objetivo', value: '**12** = 3x 💎\n**10-11** = 2x ⭐\n**7-9** = Empate 🤝', inline: true }
      );

    try {
      await interaction.reply({ embeds: [loadingEmbed] });

      const diceFrames = [
        { dice: '⚀ ⚀', text: '**GIRANDO**', color: '#e74c3c' },
        { dice: '⚁ ⚂', text: '**GIRANDO**', color: '#c0392b' },
        { dice: '⚃ ⚄', text: '**GIRANDO**', color: '#e74c3c' },
        { dice: '⚅ ⚀', text: '**GIRANDO**', color: '#c0392b' },
        { dice: '⚁ ⚃', text: '**RODANDO**', color: '#e67e22' },
        { dice: '⚄ ⚅', text: '**RODANDO**', color: '#d35400' },
        { dice: '⚂ ⚁', text: '**RODANDO**', color: '#e67e22' },
        { dice: '⚅ ⚃', text: '**CAYENDO**', color: '#f39c12' }
      ];

      for (let i = 0; i < diceFrames.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 250));
        loadingEmbed.setColor(diceFrames[i].color);
        loadingEmbed.setDescription(`╔══════════════════╗\n║                                      ║\n║   ${diceFrames[i].dice} ${diceFrames[i].text}   ║\n║                                      ║\n╚══════════════════╝`);
        try {
          await interaction.editReply({ embeds: [loadingEmbed] });
        } catch (err) {
          console.error('Error editReply during dice animation:', err);
        }
      }

      const dice1 = Math.floor(Math.random() * 6) + 1;
      const dice2 = Math.floor(Math.random() * 6) + 1;
      const total = dice1 + dice2;

      const diceEmojis = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

      let winnings = 0;
      let resultBox = '';
      let color = '#e74c3c';

      if (total === 12) {
        winnings = bet * 3;
        color = '#f1c40f';
        resultBox = `╔═══════════════════╗\n║  🎊 **¡DOBLE 6!** 🎊   ║\n║   **+${winnings.toLocaleString()} 🪙** (3x)   ║\n╚═══════════════════╝`;
      } else if (total >= 10) {
        winnings = bet * 2;
        color = '#2ecc71';
        resultBox = `╔═══════════════════╗\n║  ✨ **¡GANASTE!** ✨    ║\n║   **+${winnings.toLocaleString()} 🪙** (2x)   ║\n╚═══════════════════╝`;
      } else if (total >= 7) {
        winnings = bet;
        color = '#95a5a6';
        resultBox = `╔═══════════════════╗\n║    🤝 **EMPATE** 🤝     ║\n║  Apuesta devuelta   ║\n╚═══════════════════╝`;
      } else {
        winnings = -bet;
        color = '#e74c3c';
        resultBox = `╔═══════════════════╗\n║   ❌ **PERDISTE** ❌   ║\n║   **-${bet.toLocaleString()} 🪙**   ║\n╚═══════════════════╝`;
      }

      const baseXP = total === 12 ? 50 : total >= 10 ? 30 : 0;
      let finalXP = 0;
      let hasBoost = false;

      userData.coins += winnings;
      userData.stats.gamesPlayed++;
      
      if (winnings > 0) {
        const xpResult = addBattlePassXP(userData, baseXP);
        finalXP = xpResult.finalXP;
        hasBoost = xpResult.hasBoost;
        userData.stats.gamesWon++;
        userData.stats.totalWinnings += winnings;
      } else if (winnings < 0) {
        userData.stats.gamesLost++;
        userData.stats.totalLosses += Math.abs(winnings);
      }

      updateUser(interaction.user.id, userData);

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle('🎲 Dados - Resultado')
        .setDescription(resultBox)
        .addFields(
          { name: '🎲 Dados', value: `${diceEmojis[dice1-1]} ${diceEmojis[dice2-1]}`, inline: true },
          { name: '📊 Total', value: `**${total}** puntos`, inline: true },
          { name: '💰 Apuesta', value: `**${bet.toLocaleString()}** 🪙`, inline: true },
          ...(finalXP > 0 ? [{ name: '⭐ XP Ganado', value: `+${finalXP} XP${hasBoost ? ' 🔥' : ''}`, inline: true }] : [])
        )
        .setFooter({ text: `💰 Nuevo balance: ${userData.coins.toLocaleString()} 🪙` });

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('Dice error:', err);
      try { await interaction.followUp({ content: '❌ Ocurrió un error ejecutando los dados. Intenta de nuevo.', flags: 64 }); } catch(e){}
    } finally {
      activeGames.delete(gameId);
    }
  }
};
