// ==========================================
// COMANDO: PANEL DE RECLUTAMIENTO
// Crea panel con botón para abrir tickets de reclutamiento
// ==========================================

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel-reclutamiento')
    .setDescription('📋 Crear panel de reclutamiento')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor('#3498db')
      .setTitle('🎮 RECLUTAMIENTO EASY ESPORTS')
      .setDescription('╔════════════════════════════╗\n║                                                  ║\n║  **¿Quieres unirte al equipo?**  ║\n║                                                  ║\n╚════════════════════════════╝\n\n📝 **Requisitos:**\n• Ser mayor de 16 años\n• Tener Discord activo\n• Compromiso con el equipo\n• Actitud positiva\n\n🎯 **Proceso:**\n1. Haz clic en el botón de abajo\n2. Completa el formulario\n3. Espera la respuesta del staff\n\n🏆 **Buscamos:**\n• Jugadores competitivos\n• Content creators\n• Diseñadores gráficos\n• Community managers')
      .setFooter({ text: '🌟 ¡Buena suerte con tu postulación!' })
      .setThumbnail('https://i.imgur.com/7lGJGvD.png');

    const button = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('crear_reclutamiento')
        .setLabel('📝 Postularme')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✨')
    );

    await interaction.reply({ 
      content: '✅ Panel de reclutamiento creado', 
      ephemeral: true 
    });
    
    await interaction.channel.send({ 
      embeds: [embed], 
      components: [button] 
    });
  }
};
