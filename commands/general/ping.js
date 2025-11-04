const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('🏓 Ver latencia del bot'),
  
  async execute(interaction) {
    const sent = await interaction.reply({ content: '🏓 Pong!', fetchReply: true });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    const apiLatency = Math.round(interaction.client.ws.ping);

    const embed = new EmbedBuilder()
      .setColor(latency < 200 ? '#2ecc71' : latency < 500 ? '#f39c12' : '#e74c3c')
      .setTitle('🏓 Pong!')
      .addFields(
        { name: '📡 Latencia', value: `${latency}ms`, inline: true },
        { name: '💓 API', value: `${apiLatency}ms`, inline: true }
      )
      .setFooter({ text: latency < 200 ? '¡Excelente conexión!' : latency < 500 ? 'Conexión normal' : 'Conexión lenta' });

    await interaction.editReply({ content: null, embeds: [embed] });
  }
};
