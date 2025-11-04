const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('📊 Ver información del servidor'),
  
  async execute(interaction) {
    const guild = interaction.guild;
    
    const owner = await guild.fetchOwner();
    const createdAt = Math.floor(guild.createdTimestamp / 1000);
    
    const textChannels = guild.channels.cache.filter(c => c.type === 0).size;
    const voiceChannels = guild.channels.cache.filter(c => c.type === 2).size;
    const categories = guild.channels.cache.filter(c => c.type === 4).size;
    
    const totalMembers = guild.memberCount;
    const bots = guild.members.cache.filter(m => m.user.bot).size;
    const humans = totalMembers - bots;

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(`📊 ${guild.name}`)
      .setThumbnail(guild.iconURL({ size: 1024 }))
      .addFields(
        { name: '👑 Dueño', value: owner.user.username, inline: true },
        { name: '📅 Creado', value: `<t:${createdAt}:R>`, inline: true },
        { name: '🆔 ID', value: guild.id, inline: true },
        { name: '👥 Miembros', value: `${totalMembers.toLocaleString()}`, inline: true },
        { name: '👤 Humanos', value: `${humans.toLocaleString()}`, inline: true },
        { name: '🤖 Bots', value: `${bots.toLocaleString()}`, inline: true },
        { name: '💬 Canales de Texto', value: `${textChannels}`, inline: true },
        { name: '🔊 Canales de Voz', value: `${voiceChannels}`, inline: true },
        { name: '📁 Categorías', value: `${categories}`, inline: true },
        { name: '🎭 Roles', value: `${guild.roles.cache.size}`, inline: true },
        { name: '😀 Emojis', value: `${guild.emojis.cache.size}`, inline: true },
        { name: '🚀 Boosts', value: `${guild.premiumSubscriptionCount || 0} (Nivel ${guild.premiumTier})`, inline: true }
      );

    if (guild.description) {
      embed.setDescription(guild.description);
    }

    await interaction.reply({ embeds: [embed] });
  }
};
