const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    // ========== SLASH COMMANDS ==========
    if (interaction.isChatInputCommand()) {
      const command = client.commandHandler.getCommand(interaction.commandName);

      if (!command) {
        console.log(`⚠️ Comando no encontrado: ${interaction.commandName}`);
        return interaction.reply({ 
          content: '❌ Este comando no existe.', 
          flags: 64 
        });
      }

      try {
        // Ejecutar el comando
        await client.commandHandler.executeCommand(interaction.commandName, interaction, client);
      } catch (error) {
        console.error(`❌ Error ejecutando comando ${interaction.commandName}:`, error);
        
        const errorEmbed = new EmbedBuilder()
          .setColor('#e74c3c')
          .setTitle('❌ Error')
          .setDescription('Ocurrió un error al ejecutar este comando.')
          .setFooter({ text: 'Si el problema persiste, contacta al administrador' });

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ embeds: [errorEmbed], flags: 64 });
        } else {
          await interaction.reply({ embeds: [errorEmbed], flags: 64 });
        }
      }
    }

    // ========== BUTTONS ==========
    if (interaction.isButton()) {
      const customId = interaction.customId;
      
      // Blackjack buttons
      if (customId.startsWith('blackjack_')) {
        const action = customId.split('_')[1];
        const userId = customId.split('_')[2];
        
        if (interaction.user.id !== userId) {
          return interaction.reply({ content: '❌ Este no es tu juego.', flags: 64 });
        }

        const gameKey = `blackjack_${userId}`;
        const gameState = client.activeGames.get(gameKey);
        
        if (!gameState) {
          return interaction.reply({ content: '❌ Este juego ya expiró.', flags: 64 });
        }

        const { getUser, updateUser } = require('../utils/economy');
        
        function cardValue(card) {
          if (card.value === 'A') return 11;
          if (['J', 'Q', 'K'].includes(card.value)) return 10;
          return parseInt(card.value);
        }

        function handValue(hand) {
          let value = 0;
          let aces = 0;
          for (let card of hand) {
            value += cardValue(card);
            if (card.value === 'A') aces++;
          }
          while (value > 21 && aces > 0) {
            value -= 10;
            aces--;
          }
          return value;
        }

        function displayCard(card) {
          return `${card.value}${card.suit}`;
        }

        if (action === 'hit') {
          // Pedir carta
          gameState.playerHand.push(gameState.deck.pop());
          const playerValue = handValue(gameState.playerHand);

          if (playerValue > 21) {
            // Busted
            const userData = getUser(userId);
            userData.coins -= gameState.bet;
            updateUser(userId, userData);
            client.activeGames.delete(gameKey);

            const embed = new EmbedBuilder()
              .setColor('#e74c3c')
              .setTitle('🃏 ¡Te Pasaste!')
              .setDescription(`💥 **Perdiste ${gameState.bet.toLocaleString()} 🪙**\n\n` +
                `Tu mano: ${gameState.playerHand.map(displayCard).join(' ')} (${playerValue})`)
              .addFields({ name: '💰 Nuevo Balance', value: `${userData.coins.toLocaleString()} 🪙` });

            return interaction.update({ embeds: [embed], components: [] });
          }

          // Actualizar mensaje
          const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle('🃏 Blackjack')
            .setDescription(`**Tu mano:** ${gameState.playerHand.map(displayCard).join(' ')} (${playerValue})\n` +
              `**Casa:** ${displayCard(gameState.dealerHand[0])} ❓\n\n` +
              `**Apuesta:** ${gameState.bet.toLocaleString()} 🪙`)
            .setFooter({ text: '¿Pedir carta o plantarse?' });

          client.activeGames.set(gameKey, gameState);
          return interaction.update({ embeds: [embed] });

        } else if (action === 'stand') {
          // Plantarse - turno de la casa
          let dealerValue = handValue(gameState.dealerHand);
          
          while (dealerValue < 17) {
            gameState.dealerHand.push(gameState.deck.pop());
            dealerValue = handValue(gameState.dealerHand);
          }

          const playerValue = handValue(gameState.playerHand);
          const userData = getUser(userId);
          let result = '';
          let color = '';

          if (dealerValue > 21 || playerValue > dealerValue) {
            // Ganaste
            userData.coins += gameState.bet;
            result = `🎉 **¡Ganaste ${gameState.bet.toLocaleString()} 🪙!**`;
            color = '#2ecc71';
          } else if (playerValue < dealerValue) {
            // Perdiste
            userData.coins -= gameState.bet;
            result = `� **Perdiste ${gameState.bet.toLocaleString()} 🪙**`;
            color = '#e74c3c';
          } else {
            // Empate
            result = `🤝 **Empate - Recuperas tu apuesta**`;
            color = '#95a5a6';
          }

          updateUser(userId, userData);
          client.activeGames.delete(gameKey);

          const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle('🃏 Resultado Final')
            .setDescription(`${result}\n\n` +
              `**Tu mano:** ${gameState.playerHand.map(displayCard).join(' ')} (${playerValue})\n` +
              `**Casa:** ${gameState.dealerHand.map(displayCard).join(' ')} (${dealerValue})`)
            .addFields({ name: '💰 Nuevo Balance', value: `${userData.coins.toLocaleString()} 🪙` });

          return interaction.update({ embeds: [embed], components: [] });
        }
      }

      // Reset economy confirmation
      if (customId.startsWith('reset_economy_')) {
        const action = customId.split('_')[2];
        const userId = customId.split('_')[3];

        if (interaction.user.id !== userId) {
          return interaction.reply({ content: '❌ Solo el administrador que inició esto puede confirmar.', flags: 64 });
        }

        if (action === 'cancel') {
          const embed = new EmbedBuilder()
            .setColor('#95a5a6')
            .setTitle('❌ Reseteo Cancelado')
            .setDescription('No se realizaron cambios en la economía.');
          
          return interaction.update({ embeds: [embed], components: [] });
        }

        if (action === 'confirm') {
          const { saveEconomy } = require('../utils/economy');
          saveEconomy({});

          const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('✅ Economía Reseteada')
            .setDescription('Todos los datos de economía han sido eliminados.');
          
          return interaction.update({ embeds: [embed], components: [] });
        }
      }
    }

    // ========== STRING SELECT MENUS ==========
    if (interaction.isStringSelectMenu()) {
      const customId = interaction.customId;
      
      // Work job selection
      if (customId.startsWith('work_select_')) {
        const userId = customId.split('_')[2];
        
        if (interaction.user.id !== userId) {
          return interaction.reply({ content: '❌ Esta no es tu selección de trabajo.', flags: 64 });
        }

        const { getUser, updateUser } = require('../utils/economy');
        const { getJobsData, calculatePay } = require('../utils/workSystem');
        const { addBattlePassXP } = require('../utils/helpers');
        
        const userData = getUser(userId);
        const selectedJobId = interaction.values[0];
        const availableJobs = getJobsData(userData.workLevel);
        const selectedJob = availableJobs.find(j => j.id === selectedJobId);

        if (!selectedJob) {
          return interaction.reply({ content: '❌ Trabajo no encontrado.', flags: 64 });
        }

        if (userData.workLevel < selectedJob.unlockLevel) {
          return interaction.reply({ 
            content: `❌ Necesitas nivel ${selectedJob.unlockLevel} para este trabajo. Tu nivel: ${userData.workLevel}`, 
            flags: 64 
          });
        }

        // Calcular pago
        const { pay, xpGained } = calculatePay(selectedJob, userData.workLevel, userData.workStreak);
        
        // Aplicar multipliers de inventario
        let finalPay = pay;
        if (userData.inventory && userData.inventory.some(item => 
          item.id === 'multiplier' && item.expires > Date.now())) {
          finalPay = Math.floor(pay * 1.5);
        }

        // Actualizar datos
        userData.coins += finalPay;
        userData.workXP += xpGained;
        userData.lastWork = Date.now();
        userData.lastWorkDate = Date.now();

        // Verificar subida de nivel
        const { getXPForLevel } = require('../utils/workSystem');
        const xpNeeded = getXPForLevel(userData.workLevel);
        
        let leveledUp = false;
        if (userData.workXP >= xpNeeded) {
          userData.workLevel += 1;
          userData.workXP = 0;
          leveledUp = true;
        }

        // Agregar BattlePass XP
        const bpXP = Math.floor(finalPay / 10);
        const xpResult = addBattlePassXP(userData, bpXP);
        
        updateUser(userId, userData);

        const embed = new EmbedBuilder()
          .setColor('#2ecc71')
          .setTitle(`${selectedJob.emoji} ${selectedJob.name}`)
          .setDescription(`${selectedJob.description}\n\n💰 **+${finalPay.toLocaleString()} 🪙**\n⭐ **+${xpGained} XP de Trabajo**\n🎯 **+${xpResult.finalXP} XP de BattlePass**${xpResult.hasBoost ? ' 🔥' : ''}`)
          .addFields(
            { name: '💰 Balance', value: `${userData.coins.toLocaleString()} 🪙`, inline: true },
            { name: '💼 Nivel de Trabajo', value: `${userData.workLevel}${leveledUp ? ' 🆙' : ''}`, inline: true },
            { name: '🔥 Racha', value: `${userData.workStreak} días`, inline: true }
          );

        if (leveledUp) {
          embed.setFooter({ text: '🎉 ¡Subiste de nivel de trabajo! Nuevos trabajos desbloqueados' });
        }

        await interaction.update({ embeds: [embed], components: [] });
      }
    }

    // ========== MODALS ==========
    if (interaction.isModalSubmit()) {
      // Los handlers de modales se cargarán aquí
      console.log(`📝 Modal enviado: ${interaction.customId}`);
    }
  }
};
