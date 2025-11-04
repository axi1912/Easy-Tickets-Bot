const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, updateUser } = require('../../utils/economy');
const { addBattlePassXP } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roulette')
    .setDescription('🎰 Juega a la ruleta de la fortuna')
    .addIntegerOption(option =>
      option.setName('apuesta')
        .setDescription('Cantidad a apostar')
        .setRequired(true)
        .setMinValue(1))
    .addStringOption(option =>
      option.setName('eleccion')
        .setDescription('Elige color o número (0-36)')
        .setRequired(true)
        .addChoices(
          { name: '🔴 Rojo (2x)', value: 'rojo' },
          { name: '⚫ Negro (2x)', value: 'negro' },
          { name: '0️⃣ Cero (36x)', value: '0' },
          { name: '1️⃣ Uno (36x)', value: '1' },
          { name: '7️⃣ Siete (36x)', value: '7' },
          { name: '🔢 Otro número', value: 'otro' }
        )),
  
  async execute(interaction) {
    let bet = interaction.options.getInteger('apuesta');
    let choice = interaction.options.getString('eleccion');
    const userData = getUser(interaction.user.id);

    // Si elige "otro", pedir que escriba el número
    if (choice === 'otro') {
      return interaction.reply({
        content: '🔢 Escribe el número (2-36) usando el comando de nuevo con la opción "Otro número".\n💡 Usa /roulette con números específicos para jugar.',
        flags: 64
      });
    }

    if (bet <= 0) {
      return interaction.reply({ content: '❌ La apuesta debe ser mayor a 0.', flags: 64 });
    }

    if (userData.coins < bet) {
      return interaction.reply({ content: `❌ No tienes suficientes monedas. Tienes: **${userData.coins.toLocaleString()}** 🪙`, flags: 64 });
    }

    const loadingEmbed = new EmbedBuilder()
      .setColor('#9b59b6')
      .setTitle('🎰 RULETA DE LA FORTUNA')
      .setDescription('┏━━━━━━━━━━━━━━━━━━━━┓\n┃                                            ┃\n┃    🎰 **GIRANDO RULETA** 🎰   ┃\n┃                                            ┃\n┗━━━━━━━━━━━━━━━━━━━━┛')
      .addFields(
        { name: '🎯 Tu apuesta', value: choice === 'rojo' ? '🔴 **ROJO**' : choice === 'negro' ? '⚫ **NEGRO**' : `🎯 **Número ${choice}**`, inline: true },
        { name: '💰 Cantidad', value: `**${bet.toLocaleString()}** 🪙`, inline: true }
      );

    await interaction.reply({ embeds: [loadingEmbed] });

    const spinFrames = [
      { num: '36', color: '🔴', bgcolor: '#e74c3c' },
      { num: '13', color: '⚫', bgcolor: '#2c3e50' },
      { num: '27', color: '🔴', bgcolor: '#e74c3c' },
      { num: '6', color: '⚫', bgcolor: '#2c3e50' },
      { num: '34', color: '🔴', bgcolor: '#e74c3c' },
      { num: '17', color: '⚫', bgcolor: '#2c3e50' },
      { num: '25', color: '🔴', bgcolor: '#e74c3c' },
      { num: '2', color: '⚫', bgcolor: '#2c3e50' },
      { num: '21', color: '🔴', bgcolor: '#e74c3c' },
      { num: '4', color: '⚫', bgcolor: '#2c3e50' }
    ];

    for (let i = 0; i < spinFrames.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 200 + (i * 30)));
      loadingEmbed.setColor(spinFrames[i].bgcolor);
      loadingEmbed.setDescription(`┏━━━━━━━━━━━━━━━━━━━━┓\n┃                                            ┃\n┃       ${spinFrames[i].color} **${spinFrames[i].num}** 🎰       ┃\n┃                                            ┃\n┗━━━━━━━━━━━━━━━━━━━━┛`);
      await interaction.editReply({ embeds: [loadingEmbed] });
    }

    const number = Math.floor(Math.random() * 37); // 0-36
    const isRed = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(number);
    const color = number === 0 ? 'verde' : isRed ? 'rojo' : 'negro';

    let winnings = 0;
    let won = false;

    if (choice === number.toString()) {
      winnings = bet * 36;
      won = true;
    } else if (choice === 'rojo' && color === 'rojo') {
      winnings = bet * 2;
      won = true;
    } else if (choice === 'negro' && color === 'negro') {
      winnings = bet * 2;
      won = true;
    } else {
      winnings = -bet;
    }

    let resultBox = '';
    let finalColor = '#e74c3c';

    if (choice === number.toString() && won) {
      resultBox = `╔═══════════════════════╗\n║  🎊 **¡NÚMERO EXACTO!** 🎊  ║\n║    💎 **MEGA PREMIO** 💎    ║\n║     **+${winnings.toLocaleString()} 🪙** (36x)     ║\n╚═══════════════════════╝`;
      finalColor = '#f1c40f';
    } else if (won) {
      resultBox = `╔═══════════════════╗\n║   🎉 **¡GANASTE!** 🎉   ║\n║   **+${winnings.toLocaleString()} 🪙** (2x)   ║\n╚═══════════════════╝`;
      finalColor = '#2ecc71';
    } else {
      resultBox = `╔═══════════════════╗\n║   ❌ **PERDISTE** ❌   ║\n║    **-${bet.toLocaleString()} 🪙**    ║\n╚═══════════════════╝`;
      finalColor = '#e74c3c';
    }

    const baseXP = choice === number.toString() && won ? 100 : won ? 35 : 0;
    let finalXP = 0;
    let hasBoost = false;

    if (won) {
      userData.coins += winnings;
      const xpResult = addBattlePassXP(userData, baseXP);
      finalXP = xpResult.finalXP;
      hasBoost = xpResult.hasBoost;
      userData.stats.gamesWon++;
      userData.stats.totalWinnings += winnings;
    } else {
      userData.coins += winnings;
      userData.stats.gamesLost++;
      userData.stats.totalLosses += Math.abs(winnings);
    }

    userData.stats.gamesPlayed++;
    updateUser(interaction.user.id, userData);

    const embed = new EmbedBuilder()
      .setColor(finalColor)
      .setTitle('🎰 Ruleta - Resultado')
      .setDescription(resultBox)
      .addFields(
        { name: '🎯 Tu apuesta', value: choice === 'rojo' ? '🔴 **ROJO**' : choice === 'negro' ? '⚫ **NEGRO**' : `🎯 **#${choice}**`, inline: true },
        { name: '🎲 Cayó en', value: `${color === 'rojo' ? '🔴' : color === 'negro' ? '⚫' : '🟢'} **${number}** (${color.toUpperCase()})`, inline: true },
        { name: '💰 Apuesta', value: `**${bet.toLocaleString()}** 🪙`, inline: false },
        ...(finalXP > 0 ? [{ name: '⭐ XP Ganado', value: `+${finalXP} XP${hasBoost ? ' 🔥' : ''}`, inline: true }] : [])
      )
      .setFooter({ text: `💰 Nuevo balance: ${userData.coins.toLocaleString()} 🪙 | Color: 2x | Número exacto: 36x` });

    await interaction.editReply({ embeds: [embed] });
  }
};
