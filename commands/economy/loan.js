const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, updateUser } = require('../../utils/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loan')
    .setDescription('💳 Sistema de préstamos')
    .addStringOption(option =>
      option.setName('accion')
        .setDescription('Acción a realizar')
        .setRequired(true)
        .addChoices(
          { name: 'Ver Estado', value: 'status' },
          { name: 'Solicitar Préstamo', value: 'request' },
          { name: 'Pagar Préstamo', value: 'pay' }
        ))
    .addIntegerOption(option =>
      option.setName('cantidad')
        .setDescription('Cantidad de monedas')
        .setRequired(false)
        .setMinValue(100)),
  
  async execute(interaction) {
    const action = interaction.options.getString('accion');
    const amount = interaction.options.getInteger('cantidad');
    const userData = getUser(interaction.user.id);

    if (action === 'status') {
      if (!userData.loan) {
        return interaction.reply({ content: '✅ No tienes ningún préstamo activo.', flags: 64 });
      }

      const timeLeft = userData.loan.deadline - Date.now();
      const daysLeft = Math.ceil(timeLeft / 86400000);
      
      const embed = new EmbedBuilder()
        .setColor('#e67e22')
        .setTitle('💳 Estado de tu Préstamo')
        .addFields(
          { name: '💰 Cantidad prestada', value: `${userData.loan.amount.toLocaleString()} 🪙`, inline: true },
          { name: '📊 Interés (10%)', value: `${Math.floor(userData.loan.amount * 0.1).toLocaleString()} 🪙`, inline: true },
          { name: '💵 Total a pagar', value: `${Math.floor(userData.loan.amount * 1.1).toLocaleString()} 🪙`, inline: true },
          { name: '⏰ Tiempo restante', value: `${daysLeft} días`, inline: true },
          { name: '📋 Estado', value: userData.loan.paid ? '✅ Pagado' : '⚠️ Pendiente', inline: true }
        )
        .setFooter({ text: '💡 Usa /loan accion:Pagar para pagar tu préstamo' });

      return interaction.reply({ embeds: [embed] });
    }

    if (action === 'request') {
      if (!amount || amount < 100) {
        return interaction.reply({ content: '❌ El préstamo mínimo es de 100 monedas.', flags: 64 });
      }

      if (userData.loan && !userData.loan.paid) {
        return interaction.reply({ content: '❌ Ya tienes un préstamo activo. Págalo antes de pedir otro.', flags: 64 });
      }

      const maxLoan = 5000;
      if (amount > maxLoan) {
        return interaction.reply({ 
          content: `❌ El préstamo máximo es de **${maxLoan.toLocaleString()}** 🪙`, 
          flags: 64 
        });
      }

      const deadline = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 días
      userData.loan = {
        amount,
        deadline,
        paid: false
      };
      userData.coins += amount;
      updateUser(interaction.user.id, userData);

      const interest = Math.floor(amount * 0.1);
      const totalPayback = Math.floor(amount * 1.1);

      const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('💳 Préstamo Aprobado')
        .setDescription(`Has recibido un préstamo de **${amount.toLocaleString()}** 🪙`)
        .addFields(
          { name: '💰 Cantidad recibida', value: `${amount.toLocaleString()} 🪙`, inline: true },
          { name: '📊 Interés (10%)', value: `${interest.toLocaleString()} 🪙`, inline: true },
          { name: '💵 Total a pagar', value: `${totalPayback.toLocaleString()} 🪙`, inline: true },
          { name: '⏰ Plazo', value: '7 días', inline: true },
          { name: '💰 Nuevo balance', value: `${userData.coins.toLocaleString()} 🪙`, inline: true }
        )
        .setFooter({ text: '⚠️ Si no pagas a tiempo, perderás acceso a futuros préstamos' });

      await interaction.reply({ embeds: [embed] });

    } else if (action === 'pay') {
      if (!userData.loan) {
        return interaction.reply({ content: '❌ No tienes ningún préstamo que pagar.', flags: 64 });
      }

      if (userData.loan.paid) {
        return interaction.reply({ content: '✅ Ya has pagado este préstamo.', flags: 64 });
      }

      const payAmount = amount || Math.floor(userData.loan.amount * 1.1);
      const totalDebt = Math.floor(userData.loan.amount * 1.1);

      if (amount && amount < totalDebt) {
        return interaction.reply({ 
          content: `❌ Debes pagar el total: **${totalDebt.toLocaleString()}** 🪙 (o no especifiques cantidad para pagar todo)`, 
          flags: 64 
        });
      }

      if (userData.coins < totalDebt) {
        return interaction.reply({ 
          content: `❌ No tienes suficientes monedas. Necesitas: **${totalDebt.toLocaleString()}** 🪙`, 
          flags: 64 
        });
      }

      userData.coins -= totalDebt;
      userData.loan.paid = true;
      updateUser(interaction.user.id, userData);

      const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('💳 Préstamo Pagado')
        .setDescription(`¡Has pagado tu préstamo exitosamente!`)
        .addFields(
          { name: '💵 Cantidad pagada', value: `${totalDebt.toLocaleString()} 🪙`, inline: true },
          { name: '💰 Nuevo balance', value: `${userData.coins.toLocaleString()} 🪙`, inline: true }
        )
        .setFooter({ text: '✅ Ahora puedes solicitar un nuevo préstamo cuando lo necesites' });

      await interaction.reply({ embeds: [embed] });
    }
  }
};
