const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, updateUser } = require('../../utils/economy');
const { addBattlePassXP } = require('../../utils/helpers');

// Map global para juegos activos (se importará desde index)
let activeGames = new Map();

const setActiveGames = (gamesMap) => {
  activeGames = gamesMap;
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('coinflip')
    .setDescription('🪙 Lanza una moneda y duplica tu apuesta')
    .addIntegerOption(option =>
      option.setName('apuesta')
        .setDescription('Cantidad a apostar')
        .setRequired(true)
        .setMinValue(1))
    .addStringOption(option =>
      option.setName('eleccion')
        .setDescription('Elige cara o cruz')
        .setRequired(true)
        .addChoices(
          { name: '✨ Cara', value: 'cara' },
          { name: '💀 Cruz', value: 'cruz' }
        )),
  
  setActiveGames,
  
  async execute(interaction) {
    const bet = interaction.options.getInteger('apuesta');
    const choice = interaction.options.getString('eleccion');
    const userData = getUser(interaction.user.id);

    if (bet <= 0) {
      return interaction.reply({ content: '❌ La apuesta debe ser mayor a 0.', flags: 64 });
    }

    if (userData.coins < bet) {
      return interaction.reply({ content: `❌ No tienes suficientes monedas. Tienes: **${userData.coins.toLocaleString()}** 🪙`, flags: 64 });
    }

    // Evitar que el usuario abra múltiples coinflips simultáneos
    const gameId = `coinflip_${interaction.user.id}_${Date.now()}`;
    for (const g of activeGames.values()) {
      if (g.userId === interaction.user.id && g.game === 'coinflip') {
        return interaction.reply({ content: '❌ Ya tienes un coinflip en curso. Espera a que termine.', flags: 64 });
      }
    }

    activeGames.set(gameId, { userId: interaction.user.id, game: 'coinflip', bet });

    // Animación mejorada de moneda girando
    const loadingEmbed = new EmbedBuilder()
      .setColor('#f39c12')
      .setTitle('🪙 Coinflip')
      .setDescription('┏━━━━━━━━━━━━━━━━━━┓\n┃                                        ┃\n┃          🪙 **LANZANDO**      ┃\n┃                                        ┃\n┗━━━━━━━━━━━━━━━━━━┛')
      .addFields(
        { name: '🎯 Tu elección', value: choice === 'cara' ? '✨ **CARA**' : '💀 **CRUZ**', inline: true },
        { name: '💰 Apuesta', value: `**${bet.toLocaleString()}** 🪙`, inline: true }
      );

    try {
      await interaction.reply({ embeds: [loadingEmbed] });

      // Animación
      const frames = [
        { emoji: '🪙', text: '**GIRANDO**', color: '#f39c12' },
        { emoji: '💫', text: '**GIRANDO**', color: '#e67e22' },
        { emoji: '✨', text: '**GIRANDO**', color: '#d35400' },
        { emoji: '🌟', text: '**GIRANDO**', color: '#f39c12' },
        { emoji: '💫', text: '**GIRANDO**', color: '#e67e22' },
        { emoji: '⭐', text: '**CAYENDO**', color: '#f1c40f' },
        { emoji: '🪙', text: '**CAYENDO**', color: '#f39c12' }
      ];

      for (let i = 0; i < frames.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 300));
        loadingEmbed.setColor(frames[i].color);
        loadingEmbed.setDescription(`┏━━━━━━━━━━━━━━━━━━┓\n┃                                        ┃\n┃        ${frames[i].emoji} ${frames[i].text}      ┃\n┃                                        ┃\n┗━━━━━━━━━━━━━━━━━━┛`);
        try {
          await interaction.editReply({ embeds: [loadingEmbed] });
        } catch (err) {
          console.error('Error editReply during coinflip animation:', err);
        }
      }

      const result = Math.random() < 0.5 ? 'cara' : 'cruz';
      const won = result === choice;

      const embed = new EmbedBuilder()
        .setTitle('🪙 Coinflip - Resultado')
        .addFields(
          { name: '🎯 Tu elección', value: choice === 'cara' ? '✨ **CARA**' : '💀 **CRUZ**', inline: true },
          { name: '🎲 Cayó en', value: result === 'cara' ? '✨ **CARA**' : '💀 **CRUZ**', inline: true },
          { name: '💰 Apuesta', value: `**${bet.toLocaleString()}** 🪙`, inline: false }
        );

      if (won) {
        const baseXP = 20;
        const { finalXP, hasBoost } = addBattlePassXP(userData, baseXP);
        userData.coins += bet;
        userData.stats.gamesWon++;
        userData.stats.totalWinnings += bet;
        embed.setColor('#2ecc71')
          .setDescription(`╔═══════════════════╗\n║   🎉 **¡GANASTE!** 🎉    ║\n║  **+${bet.toLocaleString()} 🪙**  ║\n║  **+${finalXP} ⭐ XP**${hasBoost ? ' 🔥' : ''}  ║\n╚═══════════════════╝`);
      } else {
        userData.coins -= bet;
        userData.stats.gamesLost++;
        userData.stats.totalLosses += bet;
        embed.setColor('#e74c3c')
          .setDescription(`╔═══════════════════╗\n║   ❌ **PERDISTE** ❌     ║\n║  **-${bet.toLocaleString()} 🪙**  ║\n╚═══════════════════╝`);
      }

      userData.stats.gamesPlayed++;
      updateUser(interaction.user.id, userData);

      embed.setFooter({ text: `💰 Nuevo balance: ${userData.coins.toLocaleString()} 🪙` });
      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('Coinflip error:', err);
      try { await interaction.followUp({ content: '❌ Ocurrió un error ejecutando el coinflip. Intenta de nuevo.', flags: 64 }); } catch(e){}
    } finally {
      activeGames.delete(gameId);
    }
  }
};
