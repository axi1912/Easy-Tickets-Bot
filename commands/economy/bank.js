const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, updateUser } = require('../../utils/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bank')
    .setDescription('🏦 Administra tu banco personal')
    .addStringOption(option =>
      option.setName('accion')
        .setDescription('Acción a realizar')
        .setRequired(true)
        .addChoices(
          { name: 'Ver Balance', value: 'balance' },
          { name: 'Depositar', value: 'deposit' },
          { name: 'Retirar', value: 'withdraw' }
        ))
    .addIntegerOption(option =>
      option.setName('cantidad')
        .setDescription('Cantidad de monedas')
        .setRequired(false)
        .setMinValue(1)),
  
  async execute(interaction) {
    const action = interaction.options.getString('accion');
    const amount = interaction.options.getInteger('cantidad');
    const userData = getUser(interaction.user.id);

    if (action === 'balance') {
      const totalWealth = userData.coins + userData.bank;
      const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('🏦 Tu Banco Personal')
        .addFields(
          { name: '💰 En mano', value: `${userData.coins.toLocaleString()} 🪙`, inline: true },
          { name: '🏦 En banco', value: `${userData.bank.toLocaleString()} 🪙`, inline: true },
          { name: '💎 Total', value: `${totalWealth.toLocaleString()} 🪙`, inline: true }
        )
        .setFooter({ text: '💡 Las monedas en el banco generan 1% de interés diario' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    if (!amount || amount <= 0) {
      return interaction.reply({ content: '❌ Debes especificar una cantidad válida.', flags: 64 });
    }

    if (action === 'deposit') {
      if (userData.coins < amount) {
        return interaction.reply({ 
          content: `❌ No tienes suficientes monedas. Tienes: **${userData.coins.toLocaleString()}** 🪙`, 
          flags: 64 
        });
      }

      userData.coins -= amount;
      userData.bank += amount;
      updateUser(interaction.user.id, userData);

      const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('🏦 Depósito Exitoso')
        .setDescription(`Has depositado **${amount.toLocaleString()}** 🪙 en tu banco`)
        .addFields(
          { name: '💰 En mano', value: `${userData.coins.toLocaleString()} 🪙`, inline: true },
          { name: '🏦 En banco', value: `${userData.bank.toLocaleString()} 🪙`, inline: true }
        )
        .setFooter({ text: '💡 Tu dinero en el banco está seguro y genera intereses' });

      await interaction.reply({ embeds: [embed] });

    } else if (action === 'withdraw') {
      if (userData.bank < amount) {
        return interaction.reply({ 
          content: `❌ No tienes suficientes monedas en el banco. Tienes: **${userData.bank.toLocaleString()}** 🪙`, 
          flags: 64 
        });
      }

      userData.bank -= amount;
      userData.coins += amount;
      updateUser(interaction.user.id, userData);

      const embed = new EmbedBuilder()
        .setColor('#e74c3c')
        .setTitle('🏦 Retiro Exitoso')
        .setDescription(`Has retirado **${amount.toLocaleString()}** 🪙 de tu banco`)
        .addFields(
          { name: '💰 En mano', value: `${userData.coins.toLocaleString()} 🪙`, inline: true },
          { name: '🏦 En banco', value: `${userData.bank.toLocaleString()} 🪙`, inline: true }
        );

      await interaction.reply({ embeds: [embed] });
    }
  }
};
