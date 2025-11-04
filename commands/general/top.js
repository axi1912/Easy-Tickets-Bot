const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { loadEconomy } = require('../../utils/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('top')
    .setDescription('🏆 Ver rankings del servidor')
    .addStringOption(option =>
      option.setName('categoria')
        .setDescription('Categoría del ranking')
        .setRequired(false)
        .addChoices(
          { name: '💰 Más Ricos', value: 'rich' },
          { name: '🏦 Mayor Banco', value: 'bank' },
          { name: '🎮 Más Juegos Jugados', value: 'games' },
          { name: '🏆 Más Victorias', value: 'wins' },
          { name: '💼 Mayor Nivel de Trabajo', value: 'work' },
          { name: '🎯 Mayor Nivel BP', value: 'battlepass' }
        )),
  
  async execute(interaction) {
    const category = interaction.options.getString('categoria') || 'rich';
    const economy = loadEconomy();
    
    let sorted = [];
    let title = '';
    let emoji = '';
    let field = '';

    switch (category) {
      case 'rich':
        sorted = Object.entries(economy)
          .sort((a, b) => ((b[1].coins || 0) + (b[1].bank || 0)) - ((a[1].coins || 0) + (a[1].bank || 0)))
          .slice(0, 10);
        title = '💰 Top 10 Más Ricos';
        emoji = '💰';
        field = 'Riqueza Total';
        break;
      
      case 'bank':
        sorted = Object.entries(economy)
          .sort((a, b) => (b[1].bank || 0) - (a[1].bank || 0))
          .slice(0, 10);
        title = '🏦 Top 10 Mayor Banco';
        emoji = '🏦';
        field = 'En Banco';
        break;
      
      case 'games':
        sorted = Object.entries(economy)
          .sort((a, b) => (b[1].stats?.gamesPlayed || 0) - (a[1].stats?.gamesPlayed || 0))
          .slice(0, 10);
        title = '🎮 Top 10 Más Juegos Jugados';
        emoji = '🎮';
        field = 'Juegos';
        break;
      
      case 'wins':
        sorted = Object.entries(economy)
          .sort((a, b) => (b[1].stats?.gamesWon || 0) - (a[1].stats?.gamesWon || 0))
          .slice(0, 10);
        title = '🏆 Top 10 Más Victorias';
        emoji = '🏆';
        field = 'Victorias';
        break;
      
      case 'work':
        sorted = Object.entries(economy)
          .sort((a, b) => (b[1].workLevel || 1) - (a[1].workLevel || 1))
          .slice(0, 10);
        title = '💼 Top 10 Mayor Nivel de Trabajo';
        emoji = '💼';
        field = 'Nivel';
        break;
      
      case 'battlepass':
        sorted = Object.entries(economy)
          .sort((a, b) => (b[1].battlePassLevel || 1) - (a[1].battlePassLevel || 1))
          .slice(0, 10);
        title = '🎯 Top 10 Mayor Nivel BattlePass';
        emoji = '🎯';
        field = 'Nivel BP';
        break;
    }

    let description = '';
    for (let i = 0; i < sorted.length; i++) {
      const [userId, data] = sorted[i];
      const medals = ['🥇', '🥈', '🥉'];
      const medal = i < 3 ? medals[i] : `${i + 1}.`;
      
      let value = 0;
      switch (category) {
        case 'rich':
          value = (data.coins || 0) + (data.bank || 0);
          description += `${medal} <@${userId}> - **${value.toLocaleString()} 🪙**\n`;
          break;
        case 'bank':
          value = data.bank || 0;
          description += `${medal} <@${userId}> - **${value.toLocaleString()} 🪙**\n`;
          break;
        case 'games':
          value = data.stats?.gamesPlayed || 0;
          description += `${medal} <@${userId}> - **${value} juegos**\n`;
          break;
        case 'wins':
          value = data.stats?.gamesWon || 0;
          description += `${medal} <@${userId}> - **${value} victorias**\n`;
          break;
        case 'work':
          value = data.workLevel || 1;
          description += `${medal} <@${userId}> - **Nivel ${value}**\n`;
          break;
        case 'battlepass':
          value = data.battlePassLevel || 1;
          description += `${medal} <@${userId}> - **Nivel ${value}**\n`;
          break;
      }
    }

    const embed = new EmbedBuilder()
      .setColor('#f39c12')
      .setTitle(title)
      .setDescription(description || 'No hay datos suficientes')
      .setFooter({ text: 'Rankings actualizados en tiempo real' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
