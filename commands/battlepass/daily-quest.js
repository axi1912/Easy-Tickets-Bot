const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, updateUser } = require('../../utils/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily-quest')
    .setDescription('📜 Completar misión diaria para XP de Battle Pass'),
  
  async execute(interaction) {
    const userData = getUser(interaction.user.id);
    const now = Date.now();
    const cooldown = 86400000; // 24 horas

    if (userData.lastDailyQuest && (now - userData.lastDailyQuest) < cooldown) {
      const timeLeft = cooldown - (now - userData.lastDailyQuest);
      const hours = Math.floor(timeLeft / 3600000);
      return interaction.reply({ 
        content: `⏰ Ya completaste la misión diaria. Vuelve en **${hours}** horas.`, 
        flags: 64 
      });
    }

    const quests = [
      { name: 'Jugar 3 juegos', xp: 150, coins: 500, desc: '🎮 Has jugado suficientes juegos hoy' },
      { name: 'Ganar 5,000 monedas', xp: 200, coins: 1000, desc: '💰 Has ganado suficiente dinero hoy' },
      { name: 'Trabajar 2 veces', xp: 180, coins: 750, desc: '💼 Has trabajado duro hoy' },
      { name: 'Ayudar a la comunidad', xp: 120, coins: 400, desc: '❤️ Has ayudado a otros usuarios' },
      { name: 'Completar desafío diario', xp: 250, coins: 1500, desc: '⭐ Has completado el desafío' }
    ];

    const quest = quests[Math.floor(Math.random() * quests.length)];
    
    // Dar recompensas
    userData.coins += quest.coins;
    
    const { addBattlePassXP } = require('../../utils/helpers');
    const xpResult = addBattlePassXP(userData, quest.xp);
    
    userData.lastDailyQuest = now;
    updateUser(interaction.user.id, userData);

    const embed = new EmbedBuilder()
      .setColor('#f39c12')
      .setTitle('📜 Misión Diaria Completada')
      .setDescription(`**${quest.name}**\n${quest.desc}`)
      .addFields(
        { name: '💰 Recompensa', value: `${quest.coins.toLocaleString()} 🪙`, inline: true },
        { name: '⭐ XP Ganado', value: `+${xpResult.finalXP} XP${xpResult.hasBoost ? ' 🔥' : ''}`, inline: true },
        { name: '🎯 Nivel BP', value: `${userData.battlePassLevel || 1}`, inline: true }
      )
      .setFooter({ text: '¡Vuelve mañana para otra misión!' });

    if (xpResult.leveledUp) {
      embed.addFields({ name: '🎉 ¡SUBISTE DE NIVEL!', value: `Ahora eres nivel ${userData.battlePassLevel}` });
    }

    await interaction.reply({ embeds: [embed] });
  }
};
