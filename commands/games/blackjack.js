const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('🃏 Juega blackjack contra la casa')
    .addIntegerOption(option =>
      option.setName('apuesta')
        .setDescription('Cantidad a apostar')
        .setRequired(true)
        .setMinValue(50)),
  
  async execute(interaction) {
    const { getUser, updateUser } = require('../../utils/economy');
    const bet = interaction.options.getInteger('apuesta');
    const userData = getUser(interaction.user.id);

    if (userData.coins < bet) {
      return interaction.reply({ 
        content: `❌ No tienes suficientes monedas. Tienes: **${userData.coins.toLocaleString()}** 🪙`, 
        flags: 64 
      });
    }

    // Verificar juego activo
    const gameKey = `blackjack_${interaction.user.id}`;
    if (interaction.client.activeGames && interaction.client.activeGames.has(gameKey)) {
      return interaction.reply({ 
        content: '❌ Ya tienes un juego de Blackjack activo. Termínalo primero.', 
        flags: 64 
      });
    }

    const suits = ['♠️', '♥️', '♣️', '♦️'];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    
    function createDeck() {
      const deck = [];
      for (let suit of suits) {
        for (let value of values) {
          deck.push({ suit, value });
        }
      }
      return deck.sort(() => Math.random() - 0.5);
    }

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

    const deck = createDeck();
    const playerHand = [deck.pop(), deck.pop()];
    const dealerHand = [deck.pop(), deck.pop()];
    
    const gameState = {
      deck,
      playerHand,
      dealerHand,
      bet,
      userId: interaction.user.id
    };

    if (interaction.client.activeGames) {
      interaction.client.activeGames.set(gameKey, gameState);
    }

    const playerValue = handValue(playerHand);
    const dealerFirstCard = dealerHand[0];

    // Blackjack natural
    if (playerValue === 21) {
      userData.coins += Math.floor(bet * 1.5);
      updateUser(interaction.user.id, userData);
      if (interaction.client.activeGames) {
        interaction.client.activeGames.delete(gameKey);
      }

      const embed = new EmbedBuilder()
        .setColor('#f39c12')
        .setTitle('🃏 ¡BLACKJACK NATURAL!')
        .setDescription(`🎉 **¡Ganaste ${Math.floor(bet * 1.5).toLocaleString()} 🪙!**\n\n` +
          `Tu mano: ${playerHand.map(displayCard).join(' ')} (${playerValue})\n` +
          `Casa: ${dealerHand.map(displayCard).join(' ')} (${handValue(dealerHand)})`)
        .addFields({ name: '💰 Nuevo Balance', value: `${userData.coins.toLocaleString()} 🪙` });

      return interaction.reply({ embeds: [embed] });
    }

    const hitButton = new ButtonBuilder()
      .setCustomId(`blackjack_hit_${interaction.user.id}`)
      .setLabel('🃏 Pedir Carta')
      .setStyle(ButtonStyle.Primary);

    const standButton = new ButtonBuilder()
      .setCustomId(`blackjack_stand_${interaction.user.id}`)
      .setLabel('✋ Plantarse')
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(hitButton, standButton);

    const embed = new EmbedBuilder()
      .setColor('#3498db')
      .setTitle('🃏 Blackjack')
      .setDescription(`**Tu mano:** ${playerHand.map(displayCard).join(' ')} (${playerValue})\n` +
        `**Casa:** ${displayCard(dealerFirstCard)} ❓\n\n` +
        `**Apuesta:** ${bet.toLocaleString()} 🪙`)
      .setFooter({ text: '¿Pedir carta o plantarse?' });

    await interaction.reply({ embeds: [embed], components: [row] });
  }
};

// Este comando requiere un handler de botones en events/interactionCreate.js
