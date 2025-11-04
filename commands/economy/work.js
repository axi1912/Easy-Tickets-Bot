const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { getUser } = require('../../utils/economy');
const { getJobsData, getXPForLevel } = require('../../utils/workSystem');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('work')
    .setDescription('💼 Trabaja para ganar monedas y experiencia'),
  
  async execute(interaction) {
    const userData = getUser(interaction.user.id);
    const now = Date.now();

    // Verificar cooldown
    if (userData.lastWork && (now - userData.lastWork) < 7200000) { // 2 horas mínimo
      const timeLeft = Math.ceil((7200000 - (now - userData.lastWork)) / 60000);
      const hours = Math.floor(timeLeft / 60);
      const mins = timeLeft % 60;
      return interaction.reply({ 
        content: `⏰ Ya has trabajado recientemente. Próximo trabajo disponible en **${hours}h ${mins}m**`, 
        flags: 64 
      });
    }

    // Calcular racha de trabajo
    const lastDate = userData.lastWorkDate ? new Date(userData.lastWorkDate).toDateString() : null;
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    
    if (lastDate === yesterday) {
      userData.workStreak += 1;
    } else if (lastDate !== today) {
      userData.workStreak = 1;
    }

    // Obtener trabajos disponibles
    const availableJobs = getJobsData(userData.workLevel);
    const xpNeeded = getXPForLevel(userData.workLevel);
    const xpProgress = Math.floor((userData.workXP / xpNeeded) * 100);

    // Crear menú de selección de trabajo
    const jobOptions = availableJobs.map(job => ({
      label: `${job.emoji} ${job.name}${job.unlockLevel > 1 ? ` (Nivel ${job.unlockLevel})` : ''}`,
      description: `Nivel requerido: ${job.unlockLevel}`,
      value: job.id
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`work_select_${interaction.user.id}`)
      .setPlaceholder('Selecciona tu trabajo')
      .addOptions(jobOptions);

    const embed = new EmbedBuilder()
      .setColor('#3498db')
      .setTitle('💼 Sistema de Trabajo')
      .setDescription(`**${interaction.user.username}**, elige tu trabajo para hoy`)
      .addFields(
        { name: '📊 Tu Nivel', value: `Nivel ${userData.workLevel} (${userData.workXP}/${xpNeeded} XP - ${xpProgress}%)`, inline: true },
        { name: '🔥 Racha', value: `${userData.workStreak} días consecutivos`, inline: true },
        { name: '💰 Balance', value: `${userData.coins.toLocaleString()} 🪙`, inline: true },
        { name: '📝 Cómo funciona', value: '1. Elige trabajo\n2. Selecciona turno (2h/4h/8h)\n3. Completa mini-juego\n4. Elige calidad\n5. Recibe pago + XP', inline: false }
      )
      .setFooter({ text: '💡 Trabajos premium se desbloquean al subir de nivel' });

    await interaction.reply({ 
      embeds: [embed], 
      components: [new ActionRowBuilder().addComponents(selectMenu)]
    });
  }
};
