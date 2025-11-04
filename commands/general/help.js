const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const commands = require('../../config/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('📚 Muestra todos los comandos disponibles')
    .addStringOption(option =>
      option.setName('categoria')
        .setDescription('Ver comandos de una categoría específica')
        .setRequired(false)
        .addChoices(
          { name: '💰 Economía', value: 'economy' },
          { name: '🎮 Juegos', value: 'games' },
          { name: '🛒 Tienda', value: 'shop' },
          { name: '👥 Social', value: 'social' },
          { name: '🔧 Admin', value: 'admin' }
        )),
  
  async execute(interaction) {
    const category = interaction.options.getString('categoria');
    
    const commandsByCategory = {
      economy: [
        { name: '/balance', desc: 'Ver tu dinero y estadísticas' },
        { name: '/daily', desc: 'Reclamar recompensa diaria' },
        { name: '/work', desc: 'Trabajar para ganar dinero' },
        { name: '/give', desc: 'Dar dinero a otro usuario' },
        { name: '/leaderboard', desc: 'Ver los más ricos' },
        { name: '/bank', desc: 'Sistema bancario completo' },
        { name: '/loan', desc: 'Préstamos del banco' },
        { name: '/spin', desc: 'Ruleta de premios diaria' },
        { name: '/dep', desc: 'Depositar en banco (alias)' },
        { name: '/withdraw', desc: 'Retirar del banco' }
      ],
      games: [
        { name: '/coinflip', desc: 'Cara o cruz (2x)' },
        { name: '/dice', desc: 'Dados con premios variados' },
        { name: '/roulette', desc: 'Ruleta de casino' },
        { name: '/slots', desc: 'Máquina tragamonedas' }
      ],
      shop: [
        { name: '/shop', desc: 'Ver tienda de items' },
        { name: '/buy', desc: 'Comprar items' },
        { name: '/inventory', desc: 'Ver tu inventario' }
      ],
      social: [
        { name: '/profile', desc: 'Ver perfil de usuario' }
      ],
      admin: [
        { name: '/add-coins', desc: 'Añadir monedas a usuario' },
        { name: '/remove-coins', desc: 'Quitar monedas a usuario' },
        { name: '/reset-economy', desc: 'Resetear economía completa' }
      ]
    };

    const embed = new EmbedBuilder()
      .setColor('#3498db')
      .setTitle('📚 Sistema de Comandos')
      .setTimestamp();

    if (category) {
      const cmds = commandsByCategory[category];
      if (!cmds) {
        return interaction.reply({ content: '❌ Categoría no válida.', flags: 64 });
      }
      
      let description = '';
      cmds.forEach(cmd => {
        description += `**${cmd.name}**\n${cmd.desc}\n\n`;
      });

      const categoryNames = {
        economy: '💰 Comandos de Economía',
        games: '🎮 Comandos de Juegos',
        shop: '🛒 Comandos de Tienda',
        social: '👥 Comandos Sociales',
        admin: '🔧 Comandos de Admin'
      };

      embed.setTitle(categoryNames[category])
        .setDescription(description);
    } else {
      embed.setDescription('Usa `/help <categoría>` para ver comandos específicos\n\n' +
        '**Categorías Disponibles:**\n\n' +
        '💰 **Economía** - Dinero, trabajo, banco\n' +
        '🎮 **Juegos** - Casino y apuestas\n' +
        '🛒 **Tienda** - Comprar items y potenciadores\n' +
        '👥 **Social** - Perfiles, clanes, matrimonio\n' +
        '🔧 **Admin** - Comandos administrativos')
        .addFields(
          { name: '💡 Consejo', value: 'Comienza con `/daily` y `/work` para ganar tus primeras monedas' }
        );
    }

    await interaction.reply({ embeds: [embed] });
  }
};
