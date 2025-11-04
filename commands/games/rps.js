// ==========================================
// COMANDO: PIEDRA, PAPEL O TIJERA
// Juego clásico con animación
// ==========================================

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, updateUser } = require('../../utils/economy');
const { addBattlePassXP } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rps')
    .setDescription('🎮 Juega piedra, papel o tijera')
    .addIntegerOption(option =>
      option.setName('apuesta')
        .setDescription('Cantidad de monedas a apostar')
        .setRequired(true)
        .setMinValue(1))
    .addStringOption(option =>
      option.setName('eleccion')
        .setDescription('Tu elección')
        .setRequired(true)
        .addChoices(
          { name: '🪨 Piedra', value: 'piedra' },
          { name: '📄 Papel', value: 'papel' },
          { name: '✂️ Tijera', value: 'tijera' }
        )),

  async execute(interaction) {
    const bet = interaction.options.getInteger('apuesta');
    const choice = interaction.options.getString('eleccion');
    const userData = getUser(interaction.user.id);

    if (userData.coins < bet) {
      return interaction.reply({ 
        content: `❌ No tienes suficientes monedas. Tienes: **${userData.coins.toLocaleString()}** 🪙`, 
        ephemeral: true 
      });
    }

    const emojis = {
      piedra: '🪨',
      papel: '📄',
      tijera: '✂️'
    };

    // Embed inicial
    const loadingEmbed = new EmbedBuilder()
      .setColor('#3498db')
      .setTitle('✊✋✌️ Piedra, Papel o Tijera')
      .setDescription('╔════════════════════╗\n║                                        ║\n║      ⚔️ **PREPARANDO** ⚔️     ║\n║                                        ║\n╚════════════════════╝')
      .addFields(
        { name: '🎯 Tu elección', value: `${emojis[choice]} **${choice.toUpperCase()}**`, inline: true },
        { name: '💰 Apuesta', value: `**${bet.toLocaleString()}** 🪙`, inline: true }
      );

    await interaction.reply({ embeds: [loadingEmbed] });

    // Animación de cuenta regresiva
    const countFrames = [
      { text: '**3...**', color: '#e74c3c' },
      { text: '**2...**', color: '#f39c12' },
      { text: '**1...**', color: '#f1c40f' },
      { text: '**¡YA!**', color: '#2ecc71' }
    ];

    for (let i = 0; i < countFrames.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      loadingEmbed.setColor(countFrames[i].color);
      loadingEmbed.setDescription(`╔════════════════════╗\n║                                        ║\n║       ${countFrames[i].text}       ║\n║                                        ║\n╚════════════════════╝`);
      await interaction.editReply({ embeds: [loadingEmbed] });
    }

    const options = ['piedra', 'papel', 'tijera'];
    const botChoice = options[Math.floor(Math.random() * 3)];

    let result = '';
    let color = '#95a5a6';
    let resultBox = '';

    if (choice === botChoice) {
      // Empate
      result = '🤝 **EMPATE**';
      color = '#f39c12';
      resultBox = `╔═══════════════════╗\n║    🤝 **EMPATE** 🤝     ║\n║  Apuesta devuelta   ║\n╚═══════════════════╝`;
    } else if (
      (choice === 'piedra' && botChoice === 'tijera') ||
      (choice === 'papel' && botChoice === 'piedra') ||
      (choice === 'tijera' && botChoice === 'papel')
    ) {
      // Victoria
      const baseXP = 30;
      const winnings = bet;
      userData.coins += bet;
      const xpResult = addBattlePassXP(userData, baseXP);
      const finalXP = xpResult.finalXP;
      const hasBoost = xpResult.hasBoost;
      userData.stats.gamesWon++;
      userData.stats.totalWinnings += bet;
      result = `🎉 **¡VICTORIA!**`;
      color = '#2ecc71';
      resultBox = `╔═══════════════════╗\n║  🎉 **¡GANASTE!** 🎉   ║\n║   **+${bet.toLocaleString()} 🪙** (2x)   ║\n║   **+${finalXP} ⭐ XP${hasBoost ? ' 🔥' : ''}**   ║\n╚═══════════════════╝`;
    } else {
      // Derrota
      userData.coins -= bet;
      userData.stats.gamesLost++;
      userData.stats.totalLosses += bet;
      result = `❌ **DERROTA**`;
      color = '#e74c3c';
      resultBox = `╔═══════════════════╗\n║   ❌ **PERDISTE** ❌   ║\n║    **-${bet.toLocaleString()} 🪙**    ║\n╚═══════════════════╝`;
    }

    userData.stats.gamesPlayed++;
    updateUser(interaction.user.id, userData);

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle('✊✋✌️ Piedra, Papel o Tijera - Resultado')
      .setDescription(resultBox)
      .addFields(
        { name: '🎯 Tú', value: `${emojis[choice]} **${choice.toUpperCase()}**`, inline: true },
        { name: '⚡ VS', value: '💥', inline: true },
        { name: '🤖 Bot', value: `${emojis[botChoice]} **${botChoice.toUpperCase()}**`, inline: true }
      )
      .setFooter({ text: `💰 Nuevo balance: ${userData.coins.toLocaleString()} 🪙` });

    await interaction.editReply({ embeds: [embed] });
  }
};
