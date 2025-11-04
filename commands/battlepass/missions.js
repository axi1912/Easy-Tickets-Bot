const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../../utils/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('missions')
    .setDescription('📋 Ver tus misiones activas'),
  
  async execute(interaction) {
    const userData = getUser(interaction.user.id);
    
    const dailyQuestAvailable = !userData.lastDailyQuest || 
      (Date.now() - userData.lastDailyQuest) >= 86400000;

    const missions = [
      {
        name: '📜 Misión Diaria',
        status: dailyQuestAvailable ? '✅ Disponible' : '⏰ Completada',
        reward: '+150-250 XP + Monedas',
        command: '/daily-quest'
      },
      {
        name: '💼 Trabajar 5 veces',
        status: (userData.workCount || 0) >= 5 ? '✅ Completada' : `⏳ ${userData.workCount || 0}/5`,
        reward: '+500 XP',
        command: '/work'
      },
      {
        name: '🎮 Ganar 10 juegos',
        status: (userData.stats?.gamesWon || 0) >= 10 ? '✅ Completada' : `⏳ ${userData.stats?.gamesWon || 0}/10`,
        reward: '+800 XP',
        command: 'Juega cualquier juego'
      },
      {
        name: '💰 Acumular 50,000 monedas',
        status: (userData.coins + userData.bank || 0) >= 50000 ? '✅ Completada' : '⏳ En progreso',
        reward: '+1000 XP',
        command: 'Gana dinero'
      },
      {
        name: '🛡️ Unirse a un clan',
        status: userData.clan ? '✅ Completada' : '⏳ Pendiente',
        reward: '+300 XP',
        command: '/clan join'
      }
    ];

    let description = '';
    missions.forEach(mission => {
      description += `**${mission.name}**\n${mission.status}\n💎 ${mission.reward}\n\`${mission.command}\`\n\n`;
    });

    const embed = new EmbedBuilder()
      .setColor('#9b59b6')
      .setTitle('📋 Misiones Activas')
      .setDescription(description)
      .addFields(
        { name: '🎯 Nivel BP', value: `${userData.battlePassLevel || 1}`, inline: true },
        { name: '⭐ XP Total', value: `${userData.battlePassXP || 0}`, inline: true }
      )
      .setFooter({ text: 'Completa misiones para subir de nivel rápidamente' });

    await interaction.reply({ embeds: [embed] });
  }
};
