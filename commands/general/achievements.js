const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../../utils/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('achievements')
    .setDescription('🏅 Ver tus logros desbloqueados')
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('Ver logros de otro usuario')
        .setRequired(false)),
  
  async execute(interaction) {
    const target = interaction.options.getUser('usuario') || interaction.user;
    const userData = getUser(target.id);

    const achievements = [
      {
        id: 'first_win',
        name: '🎮 Primera Victoria',
        description: 'Gana tu primer juego',
        unlocked: (userData.stats?.gamesWon || 0) >= 1
      },
      {
        id: 'ten_wins',
        name: '🏆 Ganador Serial',
        description: 'Gana 10 juegos',
        unlocked: (userData.stats?.gamesWon || 0) >= 10
      },
      {
        id: 'rich',
        name: '💰 Rico',
        description: 'Acumula 50,000 monedas',
        unlocked: (userData.coins + (userData.bank || 0)) >= 50000
      },
      {
        id: 'millionaire',
        name: '💎 Millonario',
        description: 'Acumula 1,000,000 monedas',
        unlocked: (userData.coins + (userData.bank || 0)) >= 1000000
      },
      {
        id: 'worker',
        name: '💼 Trabajador',
        description: 'Alcanza nivel 5 de trabajo',
        unlocked: (userData.workLevel || 1) >= 5
      },
      {
        id: 'expert',
        name: '⭐ Experto',
        description: 'Alcanza nivel 10 de trabajo',
        unlocked: (userData.workLevel || 1) >= 10
      },
      {
        id: 'married',
        name: '💍 Casado',
        description: 'Cásate con alguien',
        unlocked: !!userData.marriedTo
      },
      {
        id: 'clan_leader',
        name: '👑 Líder de Clan',
        description: 'Crea tu propio clan',
        unlocked: false // TODO: verificar si es líder
      },
      {
        id: 'battlepass_10',
        name: '🎯 Nivel 10 BP',
        description: 'Alcanza nivel 10 de BattlePass',
        unlocked: (userData.battlePassLevel || 1) >= 10
      },
      {
        id: 'battlepass_25',
        name: '⭐ Nivel 25 BP',
        description: 'Alcanza nivel 25 de BattlePass',
        unlocked: (userData.battlePassLevel || 1) >= 25
      },
      {
        id: 'lucky',
        name: '🍀 Afortunado',
        description: 'Gana el jackpot de slots',
        unlocked: userData.achievements?.includes('lucky') || false
      },
      {
        id: 'gambler',
        name: '🎰 Apostador',
        description: 'Juega 100 veces',
        unlocked: (userData.stats?.gamesPlayed || 0) >= 100
      },
      {
        id: 'streak_7',
        name: '🔥 Racha de 7',
        description: 'Mantén una racha de daily de 7 días',
        unlocked: (userData.dailyStreak || 0) >= 7
      },
      {
        id: 'robber',
        name: '🥷 Ladrón Exitoso',
        description: 'Roba exitosamente 5 veces',
        unlocked: userData.achievements?.includes('robber') || false
      },
      {
        id: 'generous',
        name: '❤️ Generoso',
        description: 'Da 100,000 monedas a otros',
        unlocked: userData.achievements?.includes('generous') || false
      }
    ];

    const unlocked = achievements.filter(a => a.unlocked);
    const locked = achievements.filter(a => !a.unlocked);
    const progress = Math.floor((unlocked.length / achievements.length) * 100);

    let description = `**Progreso:** ${unlocked.length}/${achievements.length} (${progress}%)\n\n`;
    description += '**🏅 Desbloqueados:**\n';
    
    if (unlocked.length > 0) {
      unlocked.forEach(a => {
        description += `✅ **${a.name}**\n${a.description}\n\n`;
      });
    } else {
      description += '*Ninguno aún*\n\n';
    }

    description += '**🔒 Bloqueados:**\n';
    locked.slice(0, 5).forEach(a => {
      description += `🔒 **${a.name}**\n${a.description}\n\n`;
    });

    if (locked.length > 5) {
      description += `*... y ${locked.length - 5} más*`;
    }

    const embed = new EmbedBuilder()
      .setColor(progress >= 50 ? '#f39c12' : '#95a5a6')
      .setTitle(`🏅 Logros de ${target.username}`)
      .setDescription(description)
      .setFooter({ text: '¡Sigue jugando para desbloquear más!' });

    await interaction.reply({ embeds: [embed] });
  }
};
