const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, updateUser } = require('../../utils/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('👤 Ver perfil de un usuario')
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('Usuario a ver')
        .setRequired(false)),
  
  async execute(interaction) {
    const targetUser = interaction.options.getUser('usuario') || interaction.user;
    const userData = getUser(targetUser.id);

    const totalGames = userData.stats?.gamesPlayed || 0;
    const winRate = totalGames > 0 ? Math.floor((userData.stats.gamesWon / totalGames) * 100) : 0;
    const totalWealth = userData.coins + (userData.bank || 0);

    const embed = new EmbedBuilder()
      .setColor('#3498db')
      .setTitle(`👤 Perfil de ${targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL())
      .addFields(
        { name: '💰 Monedas en Mano', value: `${userData.coins.toLocaleString()} 🪙`, inline: true },
        { name: '🏦 En Banco', value: `${(userData.bank || 0).toLocaleString()} 🪙`, inline: true },
        { name: '💎 Riqueza Total', value: `${totalWealth.toLocaleString()} 🪙`, inline: true },
        { name: '🎮 Juegos Jugados', value: `${totalGames}`, inline: true },
        { name: '🏆 Victorias', value: `${userData.stats?.gamesWon || 0}`, inline: true },
        { name: '📊 Win Rate', value: `${winRate}%`, inline: true },
        { name: '💰 Ganado Total', value: `${(userData.stats?.totalWinnings || 0).toLocaleString()} 🪙`, inline: true },
        { name: '💸 Perdido Total', value: `${(userData.stats?.totalLosses || 0).toLocaleString()} 🪙`, inline: true },
        { name: '💼 Nivel de Trabajo', value: `Nivel ${userData.workLevel || 1}`, inline: true }
      )
      .setFooter({ text: `ID: ${targetUser.id}` })
      .setTimestamp();

    // Agregar títulos si tiene
    if (userData.titles && userData.titles.length > 0) {
      embed.addFields({ name: '🏆 Títulos', value: userData.titles.join(', '), inline: false });
    }

    // Agregar información de clan si tiene
    if (userData.clan) {
      embed.addFields({ name: '🛡️ Clan', value: userData.clan, inline: true });
    }

    await interaction.reply({ embeds: [embed] });
  }
};
