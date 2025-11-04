const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('👤 Ver información de un usuario')
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('Usuario del que ver información')
        .setRequired(false)),
  
  async execute(interaction) {
    const target = interaction.options.getUser('usuario') || interaction.user;
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);

    const createdAt = Math.floor(target.createdTimestamp / 1000);
    const joinedAt = member ? Math.floor(member.joinedTimestamp / 1000) : null;
    
    const roles = member ? member.roles.cache
      .filter(r => r.id !== interaction.guild.id)
      .sort((a, b) => b.position - a.position)
      .map(r => r.toString())
      .slice(0, 10)
      .join(', ') : 'N/A';

    const embed = new EmbedBuilder()
      .setColor(member?.displayHexColor || '#3498db')
      .setTitle(`👤 ${target.username}`)
      .setThumbnail(target.displayAvatarURL({ size: 512 }))
      .addFields(
        { name: '🆔 ID', value: target.id, inline: false },
        { name: '📅 Cuenta Creada', value: `<t:${createdAt}:R>`, inline: true },
        { name: '📥 Se Unió', value: joinedAt ? `<t:${joinedAt}:R>` : 'N/A', inline: true },
        { name: '🤖 Bot', value: target.bot ? 'Sí' : 'No', inline: true }
      );

    if (roles !== 'N/A' && roles.length > 0) {
      embed.addFields({ name: `🎭 Roles [${member.roles.cache.size - 1}]`, value: roles || 'Ninguno' });
    }

    if (member?.premiumSince) {
      const boostedSince = Math.floor(member.premiumSinceTimestamp / 1000);
      embed.addFields({ name: '💎 Boosteando desde', value: `<t:${boostedSince}:R>`, inline: true });
    }

    await interaction.reply({ embeds: [embed] });
  }
};
