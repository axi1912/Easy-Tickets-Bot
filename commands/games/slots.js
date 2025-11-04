const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, updateUser } = require('../../utils/economy');
const { addBattlePassXP } = require('../../utils/helpers');

let activeGames = new Map();

const setActiveGames = (gamesMap) => {
  activeGames = gamesMap;
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slots')
    .setDescription('🎰 Juega a la máquina tragamonedas')
    .addIntegerOption(option =>
      option.setName('apuesta')
        .setDescription('Cantidad a apostar')
        .setRequired(true)
        .setMinValue(1)),
  
  setActiveGames,
  
  async execute(interaction) {
    const apuesta = interaction.options.getInteger('apuesta');
    const userData = getUser(interaction.user.id);

    if (userData.coins < apuesta) {
      return interaction.reply({ 
        content: `❌ No tienes suficientes monedas. Tienes: **${userData.coins.toLocaleString()}** 🪙`, 
        flags: 64 
      });
    }

    const gameId = `slots_${interaction.user.id}_${Date.now()}`;
    if (activeGames.has(gameId)) {
      return interaction.reply({ content: '❌ Ya tienes un juego activo.', flags: 64 });
    }

    activeGames.set(gameId, { userId: interaction.user.id, bet: apuesta });

    try {
      userData.coins -= apuesta;
      updateUser(interaction.user.id, userData);

      const slots = ['🍒', '🍋', '🍊', '🍇', '💎', '7️⃣', '⭐'];
      
      const embed1 = new EmbedBuilder()
        .setColor('#f39c12')
        .setTitle('🎰 Máquina Tragamonedas')
        .setDescription(`**${interaction.user.username}** apostó **${apuesta.toLocaleString()}** 🪙\n\n🎰 [ ? | ? | ? ]\n\n*Girando...*`)
        .setFooter({ text: 'Ea$y Esports Casino' });

      await interaction.reply({ embeds: [embed1] });
      await new Promise(resolve => setTimeout(resolve, 1500));

      const reel1 = slots[Math.floor(Math.random() * slots.length)];
      const reel2 = slots[Math.floor(Math.random() * slots.length)];
      const reel3 = slots[Math.floor(Math.random() * slots.length)];

      let winnings = 0;
      let resultText = '';

      if (reel1 === reel2 && reel2 === reel3) {
        if (reel1 === '💎') {
          winnings = apuesta * 50;
          resultText = '💎 **¡MEGA JACKPOT!** 💎';
        } else if (reel1 === '7️⃣') {
          winnings = apuesta * 25;
          resultText = '🎉 **¡JACKPOT 777!** 🎉';
        } else if (reel1 === '⭐') {
          winnings = apuesta * 15;
          resultText = '⭐ **¡SUPER PREMIO!** ⭐';
        } else {
          winnings = apuesta * 10;
          resultText = '🎊 **¡TRES IGUALES!** 🎊';
        }
      } else if (reel1 === reel2 || reel2 === reel3 || reel1 === reel3) {
        winnings = Math.floor(apuesta * 2);
        resultText = '✨ **¡Dos iguales!**';
      } else {
        resultText = '💥 **Sin suerte esta vez...**';
      }

      let baseXP = 0;
      if (reel1 === reel2 && reel2 === reel3) {
        baseXP = reel1 === '💎' ? 150 : reel1 === '7️⃣' ? 100 : 50;
      } else if (winnings > 0) {
        baseXP = 25;
      }

      let finalXP = 0;
      let hasBoost = false;

      userData.coins += winnings;
      userData.stats.gamesPlayed += 1;
      if (winnings > 0) {
        const xpResult = addBattlePassXP(userData, baseXP);
        finalXP = xpResult.finalXP;
        hasBoost = xpResult.hasBoost;
        userData.stats.gamesWon += 1;
        userData.stats.totalWinnings += winnings;
      } else {
        userData.stats.gamesLost += 1;
        userData.stats.totalLosses += apuesta;
      }
      updateUser(interaction.user.id, userData);

      const embed2 = new EmbedBuilder()
        .setColor(winnings > 0 ? '#2ecc71' : '#e74c3c')
        .setTitle('🎰 Máquina Tragamonedas')
        .setDescription(`**${interaction.user.username}** apostó **${apuesta.toLocaleString()}** 🪙\n\n🎰 [ ${reel1} | ${reel2} | ${reel3} ]\n\n${resultText}`)
        .addFields(
          { name: winnings > 0 ? '💰 Ganaste' : '💸 Perdiste', value: `${winnings > 0 ? '+' : ''}${(winnings - apuesta).toLocaleString()} 🪙`, inline: true },
          { name: '💼 Nuevo Balance', value: `${userData.coins.toLocaleString()} 🪙`, inline: true },
          ...(finalXP > 0 ? [{ name: '⭐ XP Ganado', value: `+${finalXP} XP${hasBoost ? ' 🔥' : ''}`, inline: true }] : [])
        )
        .setFooter({ text: 'Ea$y Esports Casino' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed2] });

    } catch (error) {
      console.error('Error en slots:', error);
      userData.coins += apuesta;
      updateUser(interaction.user.id, userData);
      await interaction.editReply({ content: '❌ Error en el juego. Apuesta devuelta.' });
    } finally {
      activeGames.delete(gameId);
    }
  }
};
