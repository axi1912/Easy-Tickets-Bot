// ==========================================
// COMANDO: PANEL DE SOPORTE
// Crea panel con botón para abrir tickets de soporte
// ==========================================

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel-soporte')
    .setDescription('🎫 Crear panel de soporte')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor('#2ecc71')
      .setTitle('🎫 SISTEMA DE SOPORTE')
      .setDescription('╔════════════════════════════╗\n║                                                  ║\n║    **¿Necesitas ayuda?**    ║\n║                                                  ║\n╚════════════════════════════╝\n\n💡 **Antes de abrir un ticket:**\n• Revisa las preguntas frecuentes\n• Asegúrate de que tu consulta no esté resuelta\n• Ten paciencia, te responderemos pronto\n\n📋 **Tipos de soporte:**\n• Problemas técnicos\n• Dudas sobre el servidor\n• Reportes de usuarios\n• Sugerencias\n• Otros temas\n\n⏱️ **Tiempo de respuesta:**\n• Normal: 1-24 horas\n• Urgente: 1-6 horas')
      .setFooter({ text: '🌟 El staff te atenderá lo antes posible' })
      .setThumbnail('https://i.imgur.com/7lGJGvD.png');

    const button = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('crear_soporte')
        .setLabel('🎫 Abrir Ticket')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📨')
    );

    await interaction.reply({ 
      content: '✅ Panel de soporte creado', 
      ephemeral: true 
    });
    
    await interaction.channel.send({ 
      embeds: [embed], 
      components: [button] 
    });
  }
};
