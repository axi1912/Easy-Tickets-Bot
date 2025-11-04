const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, updateUser } = require('../../utils/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rob')
    .setDescription('💰 Intentar robar a otro usuario')
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('Usuario a robar')
        .setRequired(true)),
  
  async execute(interaction) {
    const target = interaction.options.getUser('usuario');
    const userData = getUser(interaction.user.id);
    const targetData = getUser(target.id);
    const now = Date.now();
    const cooldown = 600000; // 10 minutos

    if (target.id === interaction.user.id) {
      return interaction.reply({ content: '❌ No puedes robarte a ti mismo.', flags: 64 });
    }

    if (target.bot) {
      return interaction.reply({ content: '❌ No puedes robar a un bot.', flags: 64 });
    }

    if (userData.lastRob && (now - userData.lastRob) < cooldown) {
      const timeLeft = Math.ceil((cooldown - (now - userData.lastRob)) / 60000);
      return interaction.reply({ 
        content: `⏰ Espera **${timeLeft}** minutos antes de robar otra vez.`, 
        flags: 64 
      });
    }

    if (targetData.coins < 100) {
      return interaction.reply({ 
        content: `❌ ${target.username} no tiene suficiente dinero para robar (mínimo 100 🪙).`, 
        flags: 64 
      });
    }

    if (userData.coins < 50) {
      return interaction.reply({ 
        content: '❌ Necesitas al menos **50** 🪙 para intentar robar (costo de multa si fallas).', 
        flags: 64 
      });
    }

    const successChance = 0.40; // 40% de éxito
    const success = Math.random() < successChance;
    
    userData.lastRob = now;

    let embed;

    if (success) {
      const percentage = Math.random() * 0.25 + 0.15; // 15-40% del dinero
      const stolen = Math.floor(targetData.coins * percentage);
      
      userData.coins += stolen;
      targetData.coins -= stolen;

      embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('💰 ¡Robo Exitoso!')
        .setDescription(`✅ Le robaste **${stolen.toLocaleString()}** 🪙 a ${target}`)
        .addFields({ name: '💰 Tu Nuevo Balance', value: `${userData.coins.toLocaleString()} 🪙` });

      updateUser(target.id, targetData);
    } else {
      const fine = Math.floor(Math.random() * 100) + 50;
      const actualFine = Math.min(fine, userData.coins);
      userData.coins -= actualFine;

      embed = new EmbedBuilder()
        .setColor('#e74c3c')
        .setTitle('🚔 ¡Te Atraparon!')
        .setDescription(`❌ Intentaste robar a ${target} pero fallaste.\n\nMulta: **-${actualFine.toLocaleString()}** 🪙`)
        .addFields({ name: '💰 Tu Nuevo Balance', value: `${userData.coins.toLocaleString()} 🪙` });
    }

    updateUser(interaction.user.id, userData);
    await interaction.reply({ embeds: [embed] });
  }
};
