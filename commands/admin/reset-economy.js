const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { loadEconomy, saveEconomy } = require('../../utils/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reset-economy')
    .setDescription('⚠️ [ADMIN] Resetear economía de TODOS los usuarios')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Necesitas permisos de administrador.', flags: 64 });
    }

    const confirmButton = new ButtonBuilder()
      .setCustomId(`reset_economy_confirm_${interaction.user.id}`)
      .setLabel('✅ SÍ, RESETEAR TODO')
      .setStyle(ButtonStyle.Danger);

    const cancelButton = new ButtonBuilder()
      .setCustomId(`reset_economy_cancel_${interaction.user.id}`)
      .setLabel('❌ Cancelar')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(cancelButton, confirmButton);

    const economy = loadEconomy();
    const userCount = Object.keys(economy).length;

    const embed = new EmbedBuilder()
      .setColor('#e74c3c')
      .setTitle('⚠️ ADVERTENCIA: Reseteo de Economía')
      .setDescription(`Estás a punto de **BORRAR TODA LA ECONOMÍA** del servidor.\n\n**Esto eliminará:**\n• Monedas de **${userCount}** usuarios\n• Todos los inventarios\n• Todas las estadísticas\n• Todo el progreso\n\n**Esta acción NO se puede deshacer.**\n\n¿Estás seguro?`)
      .setFooter({ text: 'Esta confirmación expira en 30 segundos' });

    await interaction.reply({ embeds: [embed], components: [row] });
  }
};
