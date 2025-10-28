const { REST, Routes } = require('discord.js');
require('dotenv').config();

const commands = [
  {
    name: 'panel-reclutamiento',
    description: 'Crea el panel de reclutamiento'
  },
  {
    name: 'panel-soporte',
    description: 'Crea el panel de soporte'
  },
  // Economía
  {
    name: 'balance',
    description: 'Ver el balance de monedas',
    options: [
      {
        name: 'usuario',
        description: 'Usuario del cual ver el balance',
        type: 6, // USER
        required: false
      }
    ]
  },
  {
    name: 'daily',
    description: 'Reclamar tu bonus diario de 100 monedas'
  },
  {
    name: 'leaderboard',
    description: 'Ver el top 10 de usuarios más ricos'
  },
  {
    name: 'give',
    description: 'Regalar monedas a otro usuario',
    options: [
      {
        name: 'usuario',
        description: 'Usuario al que enviar monedas',
        type: 6, // USER
        required: true
      },
      {
        name: 'cantidad',
        description: 'Cantidad de monedas a enviar',
        type: 4, // INTEGER
        required: true,
        min_value: 1
      }
    ]
  },
  // Comandos de Staff
  {
    name: 'add-coins',
    description: '💰 [STAFF] Agregar monedas a un usuario',
    options: [
      {
        name: 'usuario',
        description: 'Usuario al que agregar monedas',
        type: 6,
        required: true
      },
      {
        name: 'cantidad',
        description: 'Cantidad de monedas a agregar',
        type: 4,
        required: true,
        min_value: 1
      }
    ]
  },
  {
    name: 'remove-coins',
    description: '💸 [STAFF] Quitar monedas a un usuario',
    options: [
      {
        name: 'usuario',
        description: 'Usuario al que quitar monedas',
        type: 6,
        required: true
      },
      {
        name: 'cantidad',
        description: 'Cantidad de monedas a quitar',
        type: 4,
        required: true,
        min_value: 1
      }
    ]
  },
  // Juegos
  {
    name: 'blackjack',
    description: '🃏 Juega Blackjack - Llega a 21 sin pasarte',
    options: [
      {
        name: 'apuesta',
        description: 'Cantidad de monedas a apostar',
        type: 4,
        required: true,
        min_value: 1
      }
    ]
  },
  {
    name: 'coinflip',
    description: '🪙 Lanza una moneda - Cara o Cruz',
    options: [
      {
        name: 'apuesta',
        description: 'Cantidad de monedas a apostar',
        type: 4,
        required: true,
        min_value: 1
      },
      {
        name: 'eleccion',
        description: 'Elige cara o cruz',
        type: 3, // STRING
        required: true,
        choices: [
          { name: '🌟 Cara', value: 'cara' },
          { name: '❌ Cruz', value: 'cruz' }
        ]
      }
    ]
  },
  {
    name: 'dice',
    description: '🎲 Lanza dos dados - 12=3x | 10-11=2x | 7-9=Empate',
    options: [
      {
        name: 'apuesta',
        description: 'Cantidad de monedas a apostar',
        type: 4,
        required: true,
        min_value: 1
      }
    ]
  },
  {
    name: 'roulette',
    description: '🎰 Ruleta - Apuesta a un color o número',
    options: [
      {
        name: 'apuesta',
        description: 'Cantidad de monedas a apostar',
        type: 4,
        required: true,
        min_value: 1
      },
      {
        name: 'eleccion',
        description: 'Elige rojo, negro, o un número (0-36)',
        type: 3,
        required: true,
        choices: [
          { name: '🔴 Rojo (2x)', value: 'rojo' },
          { name: '⚫ Negro (2x)', value: 'negro' },
          { name: '0️⃣ 0 (36x)', value: '0' },
          { name: '1️⃣ 1 (36x)', value: '1' },
          { name: '2️⃣ 2 (36x)', value: '2' },
          { name: '3️⃣ 3 (36x)', value: '3' },
          { name: '4️⃣ 4 (36x)', value: '4' },
          { name: '5️⃣ 5 (36x)', value: '5' },
          { name: '6️⃣ 6 (36x)', value: '6' },
          { name: '7️⃣ 7 (36x)', value: '7' },
          { name: '8️⃣ 8 (36x)', value: '8' },
          { name: '9️⃣ 9 (36x)', value: '9' },
          { name: '🔟 10 (36x)', value: '10' }
        ]
      }
    ]
  },
  {
    name: 'rps',
    description: '✊✋✌️ Piedra, Papel o Tijera',
    options: [
      {
        name: 'apuesta',
        description: 'Cantidad de monedas a apostar',
        type: 4,
        required: true,
        min_value: 1
      },
      {
        name: 'eleccion',
        description: 'Elige tu jugada',
        type: 3,
        required: true,
        choices: [
          { name: '🪨 Piedra', value: 'piedra' },
          { name: '📄 Papel', value: 'papel' },
          { name: '✂️ Tijera', value: 'tijera' }
        ]
      }
    ]
  },
  {
    name: 'guess',
    description: '🔢 Adivina el número del 1 al 100 en 5 intentos',
    options: [
      {
        name: 'apuesta',
        description: 'Cantidad de monedas a apostar',
        type: 4,
        required: true,
        min_value: 1
      }
    ]
  },
  {
    name: 'highlow',
    description: '📊 Higher or Lower - Racha 5: 10x | Racha 3: 5x',
    options: [
      {
        name: 'apuesta',
        description: 'Cantidad de monedas a apostar',
        type: 4,
        required: true,
        min_value: 1
      }
    ]
  }
];

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Registrando comandos...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('✅ Comandos registrados');
  } catch (error) {
    console.error(error);
  }
})();
