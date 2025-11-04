const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, updateUser } = require('../../utils/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('poker')
    .setDescription('🃏 Jugar poker de 5 cartas')
    .addIntegerOption(option =>
      option.setName('apuesta')
        .setDescription('Cantidad a apostar')
        .setRequired(true)
        .setMinValue(200)),
  
  async execute(interaction) {
    const bet = interaction.options.getInteger('apuesta');
    const userData = getUser(interaction.user.id);

    if (userData.coins < bet) {
      return interaction.reply({ 
        content: `❌ No tienes suficientes monedas. Tienes: **${userData.coins.toLocaleString()} 🪙`, 
        flags: 64 
      });
    }

    const suits = ['♠️', '♥️', '♣️', '♦️'];
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    
    function createDeck() {
      const deck = [];
      for (let suit of suits) {
        for (let value of values) {
          deck.push({ suit, value, numValue: values.indexOf(value) + 2 });
        }
      }
      return deck.sort(() => Math.random() - 0.5);
    }

    function displayCard(card) {
      return `${card.value}${card.suit}`;
    }

    function evaluateHand(hand) {
      const valueCounts = {};
      const suitCounts = {};
      
      hand.forEach(card => {
        valueCounts[card.value] = (valueCounts[card.value] || 0) + 1;
        suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
      });

      const counts = Object.values(valueCounts).sort((a, b) => b - a);
      const isFlush = Object.values(suitCounts).some(count => count === 5);
      const sorted = hand.map(c => c.numValue).sort((a, b) => a - b);
      const isStraight = sorted.every((val, i) => i === 0 || val === sorted[i - 1] + 1);

      if (isStraight && isFlush) return { rank: 8, name: 'Escalera de Color', payout: 50 };
      if (counts[0] === 4) return { rank: 7, name: 'Poker', payout: 25 };
      if (counts[0] === 3 && counts[1] === 2) return { rank: 6, name: 'Full House', payout: 9 };
      if (isFlush) return { rank: 5, name: 'Color', payout: 6 };
      if (isStraight) return { rank: 4, name: 'Escalera', payout: 4 };
      if (counts[0] === 3) return { rank: 3, name: 'Trío', payout: 3 };
      if (counts[0] === 2 && counts[1] === 2) return { rank: 2, name: 'Dos Pares', payout: 2 };
      if (counts[0] === 2) return { rank: 1, name: 'Par', payout: 1 };
      return { rank: 0, name: 'Carta Alta', payout: 0 };
    }

    const deck = createDeck();
    const playerHand = [deck.pop(), deck.pop(), deck.pop(), deck.pop(), deck.pop()];
    const dealerHand = [deck.pop(), deck.pop(), deck.pop(), deck.pop(), deck.pop()];

    const playerResult = evaluateHand(playerHand);
    const dealerResult = evaluateHand(dealerHand);

    let outcome = '';
    let winnings = 0;
    let color = '';

    if (playerResult.rank > dealerResult.rank) {
      winnings = Math.floor(bet * playerResult.payout);
      userData.coins += winnings;
      outcome = '🎉 **¡GANASTE!**';
      color = '#2ecc71';
      
      if (!userData.stats) userData.stats = {};
      userData.stats.gamesPlayed = (userData.stats.gamesPlayed || 0) + 1;
      userData.stats.gamesWon = (userData.stats.gamesWon || 0) + 1;
      userData.stats.totalWinnings = (userData.stats.totalWinnings || 0) + winnings;
    } else if (playerResult.rank < dealerResult.rank) {
      userData.coins -= bet;
      winnings = -bet;
      outcome = '😔 **Perdiste**';
      color = '#e74c3c';
      
      if (!userData.stats) userData.stats = {};
      userData.stats.gamesPlayed = (userData.stats.gamesPlayed || 0) + 1;
      userData.stats.totalLosses = (userData.stats.totalLosses || 0) + bet;
    } else {
      outcome = '🤝 **Empate**';
      color = '#95a5a6';
      
      if (!userData.stats) userData.stats = {};
      userData.stats.gamesPlayed = (userData.stats.gamesPlayed || 0) + 1;
    }

    const { addBattlePassXP } = require('../../utils/helpers');
    const bpXP = winnings > 0 ? Math.floor(winnings / 10) : 5;
    const xpResult = addBattlePassXP(userData, bpXP);
    
    updateUser(interaction.user.id, userData);

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle('🃏 Poker de 5 Cartas')
      .setDescription(outcome)
      .addFields(
        { 
          name: '👤 Tu Mano', 
          value: `${playerHand.map(displayCard).join(' ')}\n**${playerResult.name}** (${playerResult.payout}x)`, 
          inline: false 
        },
        { 
          name: '🤖 Mano de la Casa', 
          value: `${dealerHand.map(displayCard).join(' ')}\n**${dealerResult.name}** (${dealerResult.payout}x)`, 
          inline: false 
        },
        { 
          name: '💰 Resultado', 
          value: winnings >= 0 ? `+${winnings.toLocaleString()} 🪙` : `${winnings.toLocaleString()} 🪙`, 
          inline: true 
        },
        { 
          name: '💰 Nuevo Balance', 
          value: `${userData.coins.toLocaleString()} 🪙`, 
          inline: true 
        },
        { 
          name: '⭐ XP Ganado', 
          value: `+${xpResult.finalXP} XP`, 
          inline: true 
        }
      );

    await interaction.reply({ embeds: [embed] });
  }
};
