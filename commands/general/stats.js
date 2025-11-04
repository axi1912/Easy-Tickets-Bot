const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('📊 Ver estadísticas del bot y del servidor')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  
  async execute(interaction) {
    const { loadEconomy } = require('../../utils/economy');
    const economy = loadEconomy();
    
    const totalUsers = Object.keys(economy).length;
    const totalCoins = Object.values(economy).reduce((sum, user) => sum + user.coins + (user.bank || 0), 0);
    const averageCoins = totalUsers > 0 ? Math.floor(totalCoins / totalUsers) : 0;
    
    const richest = Object.entries(economy)
      .sort((a, b) => (b[1].coins + (b[1].bank || 0)) - (a[1].coins + (a[1].bank || 0)))
      .slice(0, 1)[0];
    
    const totalGames = Object.values(economy).reduce((sum, user) => 
      sum + (user.stats?.gamesPlayed || 0), 0);

    const uptime = process.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);

    const embed = new EmbedBuilder()
      .setColor('#9b59b6')
      .setTitle('📊 Estadísticas del Bot')
      .addFields(
        { name: '👥 Usuarios Registrados', value: `${totalUsers}`, inline: true },
        { name: '💰 Monedas en Circulación', value: `${totalCoins.toLocaleString()} 🪙`, inline: true },
        { name: '📊 Promedio por Usuario', value: `${averageCoins.toLocaleString()} 🪙`, inline: true },
        { name: '👑 Usuario Más Rico', value: richest ? `<@${richest[0]}>` : 'N/A', inline: true },
        { name: '🎮 Juegos Jugados', value: `${totalGames.toLocaleString()}`, inline: true },
        { name: '⏱️ Tiempo Activo', value: `${days}d ${hours}h ${minutes}m`, inline: true },
        { name: '📡 Servidores', value: `${interaction.client.guilds.cache.size}`, inline: true },
        { name: '💻 Memoria Usada', value: `${Math.floor(process.memoryUsage().heapUsed / 1024 / 1024)}MB`, inline: true },
        { name: '🔢 Comandos Cargados', value: `${interaction.client.commands?.size || 0}`, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
