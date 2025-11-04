const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('🖼️ Ver avatar de un usuario')
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('Usuario del que ver el avatar')
        .setRequired(false)),
  
  async execute(interaction) {
    const target = interaction.options.getUser('usuario') || interaction.user;
    
    const embed = new EmbedBuilder()
      .setColor('#3498db')
      .setTitle(`🖼️ Avatar de ${target.username}`)
      .setImage(target.displayAvatarURL({ size: 4096, dynamic: true }))
      .addFields({ 
        name: '🔗 Enlaces', 
        value: `[PNG](${target.displayAvatarURL({ extension: 'png', size: 4096 })}) | [JPG](${target.displayAvatarURL({ extension: 'jpg', size: 4096 })}) | [WEBP](${target.displayAvatarURL({ extension: 'webp', size: 4096 })})` 
      });

    await interaction.reply({ embeds: [embed] });
  }
};
