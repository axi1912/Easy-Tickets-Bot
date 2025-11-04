const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('announcement')
    .setDescription('📢 Enviar un anuncio al canal actual')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('titulo')
        .setDescription('Título del anuncio')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('mensaje')
        .setDescription('Contenido del anuncio')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('color')
        .setDescription('Color del embed')
        .setRequired(false)
        .addChoices(
          { name: 'Rojo', value: '#e74c3c' },
          { name: 'Verde', value: '#2ecc71' },
          { name: 'Azul', value: '#3498db' },
          { name: 'Amarillo', value: '#f39c12' },
          { name: 'Morado', value: '#9b59b6' },
          { name: 'Blanco', value: '#ffffff' }
        ))
    .addStringOption(option =>
      option.setName('imagen')
        .setDescription('URL de la imagen (opcional)')
        .setRequired(false))
    .addBooleanOption(option =>
      option.setName('everyone')
        .setDescription('Mencionar @everyone')
        .setRequired(false)),
  
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Necesitas permisos de administrador.', flags: 64 });
    }

    const title = interaction.options.getString('titulo');
    const message = interaction.options.getString('mensaje');
    const color = interaction.options.getString('color') || '#3498db';
    const image = interaction.options.getString('imagen');
    const mentionEveryone = interaction.options.getBoolean('everyone') || false;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(message)
      .setFooter({ text: `Anuncio de ${interaction.user.username}` })
      .setTimestamp();

    if (image) {
      embed.setImage(image);
    }

    const content = mentionEveryone ? '@everyone' : null;

    await interaction.reply({ content: '✅ Anuncio enviado.', flags: 64 });
    await interaction.channel.send({ content, embeds: [embed] });
  }
};
