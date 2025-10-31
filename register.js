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
    name: 'work',
    description: '💼 Sistema de trabajo completo con niveles, turnos y mini-juegos'
  },
  {
    name: 'bank',
    description: '🏦 Gestionar tu banco personal',
    options: [
      {
        name: 'accion',
        description: 'Acción a realizar',
        type: 3,
        required: true,
        choices: [
          { name: '💰 Depositar', value: 'deposit' },
          { name: '💸 Retirar', value: 'withdraw' },
          { name: '📊 Ver Balance', value: 'balance' }
        ]
      },
      {
        name: 'cantidad',
        description: 'Cantidad de monedas (solo para depositar/retirar)',
        type: 4,
        required: false,
        min_value: 1
      }
    ]
  },
  {
    name: 'loan',
    description: '💳 Sistema de préstamos',
    options: [
      {
        name: 'accion',
        description: 'Acción a realizar',
        type: 3,
        required: true,
        choices: [
          { name: '📝 Pedir préstamo', value: 'request' },
          { name: '💵 Pagar préstamo', value: 'pay' },
          { name: '📋 Ver estado', value: 'status' }
        ]
      },
      {
        name: 'cantidad',
        description: 'Cantidad a pedir/pagar',
        type: 4,
        required: false,
        min_value: 100
      }
    ]
  },
  {
    name: 'daily-quest',
    description: '📋 Ver y completar misiones diarias'
  },
  {
    name: 'spin',
    description: '🎰 Girar la ruleta de premios (1 vez al día gratis)'
  },
  {
    name: 'streak',
    description: '🔥 Ver tu racha de días consecutivos'
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
  },
  // Nuevos comandos
  {
    name: 'duel',
    description: '⚔️ Retar a otro usuario a un duelo de monedas',
    options: [
      {
        name: 'oponente',
        description: 'Usuario al que deseas retar',
        type: 6, // USER
        required: true
      },
      {
        name: 'apuesta',
        description: 'Cantidad de monedas a apostar',
        type: 4, // INTEGER
        required: true,
        min_value: 1
      },
      {
        name: 'juego',
        description: 'Tipo de juego para el duelo',
        type: 3, // STRING
        required: false,
        choices: [
          { name: '🪙 Coinflip (Por defecto)', value: 'coinflip' },
          { name: '🎲 Dados - Mayor suma gana', value: 'dice' },
          { name: '🃏 Blackjack - Más cerca de 21', value: 'blackjack' },
          { name: '✊ Piedra/Papel/Tijera', value: 'rps' },
          { name: '🔢 Adivinanza - Más cerca gana', value: 'guess' }
        ]
      }
    ]
  },
  {
    name: 'shop',
    description: '🛒 Ver la tienda de items especiales'
  },
  {
    name: 'buy',
    description: '💳 Comprar un item de la tienda',
    options: [
      {
        name: 'item',
        description: 'ID del item a comprar (lucky_charm, shield, multiplier, daily_boost, vip_title)',
        type: 3, // STRING
        required: true,
        choices: [
          { name: '🍀 Amuleto de la Suerte (5000)', value: 'lucky_charm' },
          { name: '🛡️ Escudo Protector (3000)', value: 'shield' },
          { name: '💎 Multiplicador x2 (10000)', value: 'multiplier' },
          { name: '⚡ Boost Diario (2000)', value: 'daily_boost' },
          { name: '👑 Título VIP (15000)', value: 'vip_title' }
        ]
      }
    ]
  },
  {
    name: 'inventory',
    description: '🎒 Ver tu inventario de items',
    options: [
      {
        name: 'usuario',
        description: 'Usuario del cual ver el inventario',
        type: 6, // USER
        required: false
      }
    ]
  },
  {
    name: 'guia-usuarios',
    description: '📖 Enviar guía completa de comandos para usuarios'
  },
  {
    name: 'guia-staff',
    description: '👨‍� [STAFF] Enviar guía completa de comandos para staff'
  },
  {
    name: 'respuesta',
    description: '📝 [STAFF] Enviar una respuesta rápida predefinida',
    options: [
      {
        name: 'template',
        description: 'Selecciona el template de respuesta',
        type: 3, // STRING
        required: true,
        choices: [
          { name: '👋 Bienvenida', value: 'bienvenida' },
          { name: '🔍 En revisión', value: 'en_revision' },
          { name: '📸 Necesita pruebas', value: 'necesita_pruebas' },
          { name: '✅ Resuelto', value: 'resuelto' },
          { name: '❌ Rechazado', value: 'rechazado' },
          { name: '⏱️ En espera', value: 'espera' },
          { name: '🔒 Cerrar ticket', value: 'cierre' }
        ]
      }
    ]
  },
  {
    name: 'slots',
    description: '🎰 Juega a la máquina tragamonedas',
    options: [
      {
        name: 'apuesta',
        description: 'Cantidad de monedas a apostar',
        type: 4,
        required: true,
        min_value: 10
      }
    ]
  },
  {
    name: 'race',
    description: '🏇 Apuesta en carreras de emojis',
    options: [
      {
        name: 'apuesta',
        description: 'Cantidad de monedas a apostar',
        type: 4,
        required: true,
        min_value: 10
      },
      {
        name: 'corredor',
        description: 'Elige tu corredor (1-4)',
        type: 4,
        required: true,
        min_value: 1,
        max_value: 4
      }
    ]
  },
  {
    name: 'bingo',
    description: '🎯 Juega al bingo (Se necesitan 3+ jugadores)',
    options: [
      {
        name: 'apuesta',
        description: 'Cantidad de monedas para entrar',
        type: 4,
        required: true,
        min_value: 50
      }
    ]
  },
  {
    name: 'russianroulette',
    description: '🎪 Ruleta rusa - Alto riesgo, alta recompensa',
    options: [
      {
        name: 'apuesta',
        description: 'Cantidad de monedas a apostar',
        type: 4,
        required: true,
        min_value: 100
      }
    ]
  },
  {
    name: 'trivia',
    description: '🎨 Responde preguntas de cultura general por premios',
    options: [
      {
        name: 'dificultad',
        description: 'Nivel de dificultad',
        type: 3,
        required: true,
        choices: [
          { name: '😊 Fácil (50 monedas)', value: 'facil' },
          { name: '🤔 Media (150 monedas)', value: 'media' },
          { name: '🔥 Difícil (300 monedas)', value: 'dificil' }
        ]
      }
    ]
  },
  {
    name: 'comprar-negocio',
    description: '🏢 Compra un negocio que genera ingresos pasivos',
    options: [
      {
        name: 'negocio',
        description: 'Negocio a comprar',
        type: 3,
        required: true,
        choices: [
          { name: '🍋 Puesto de Limonada (5,000 - 50/h)', value: 'lemonade' },
          { name: '🌮 Food Truck (25,000 - 300/2h)', value: 'food_truck' },
          { name: '☕ Café (75,000 - 1,000/3h)', value: 'cafe' },
          { name: '🍽️ Restaurante (200,000 - 3,000/4h)', value: 'restaurant' },
          { name: '🏋️ Gimnasio (500,000 - 8,000/6h)', value: 'gym' },
          { name: '🎪 Club Nocturno (1,500,000 - 25,000/8h)', value: 'nightclub' },
          { name: '🎰 Casino (5,000,000 - 100,000/12h)', value: 'casino' }
        ]
      }
    ]
  },
  {
    name: 'mis-negocios',
    description: '🏢 Ver tus negocios y ganancias pendientes'
  },
  {
    name: 'cobrar-negocios',
    description: '💰 Cobra las ganancias de tus negocios'
  },
  {
    name: 'comprar-acciones',
    description: '📈 Compra acciones de empresas',
    options: [
      {
        name: 'empresa',
        description: 'Empresa',
        type: 3,
        required: true,
        choices: [
          { name: '🎮 Ea$y Esports', value: 'ea$y' },
          { name: '💻 TechCorp', value: 'techcorp' },
          { name: '🍔 FoodChain', value: 'foodchain' },
          { name: '🚗 AutoMax', value: 'automax' }
        ]
      },
      {
        name: 'cantidad',
        description: 'Cantidad de acciones',
        type: 4,
        required: true,
        min_value: 1
      }
    ]
  },
  {
    name: 'vender-acciones',
    description: '📉 Vende tus acciones',
    options: [
      {
        name: 'empresa',
        description: 'Empresa',
        type: 3,
        required: true,
        choices: [
          { name: '🎮 Ea$y Esports', value: 'ea$y' },
          { name: '💻 TechCorp', value: 'techcorp' },
          { name: '🍔 FoodChain', value: 'foodchain' },
          { name: '🚗 AutoMax', value: 'automax' }
        ]
      },
      {
        name: 'cantidad',
        description: 'Cantidad de acciones',
        type: 4,
        required: true,
        min_value: 1
      }
    ]
  },
  {
    name: 'ver-acciones',
    description: '📊 Ver el mercado de acciones y tus inversiones'
  },
  {
    name: 'comprar-propiedad',
    description: '🏆 Compra propiedades de prestigio',
    options: [
      {
        name: 'propiedad',
        description: 'Propiedad a comprar',
        type: 3,
        required: true,
        choices: [
          { name: '🚲 Bicicleta (1,000)', value: 'bicycle' },
          { name: '🏍️ Motocicleta (15,000)', value: 'motorcycle' },
          { name: '🚗 Auto (50,000)', value: 'car' },
          { name: '🏎️ Auto Deportivo (250,000)', value: 'sportscar' },
          { name: '🏢 Apartamento (100,000)', value: 'apartment' },
          { name: '🏠 Casa (500,000)', value: 'house' },
          { name: '🏰 Mansión (2,000,000)', value: 'mansion' },
          { name: '🛥️ Yate (5,000,000)', value: 'yacht' },
          { name: '🚁 Helicóptero (10,000,000)', value: 'helicopter' },
          { name: '🏝️ Isla Privada (50,000,000)', value: 'island' }
        ]
      }
    ]
  },
  {
    name: 'mis-propiedades',
    description: '🏆 Ver tus propiedades de prestigio'
  },
  {
    name: 'comprar-cripto',
    description: '₿ Compra EasyCoins (criptomoneda volátil)',
    options: [
      {
        name: 'cantidad',
        description: 'Cantidad de EasyCoins',
        type: 4,
        required: true,
        min_value: 1
      }
    ]
  },
  {
    name: 'vender-cripto',
    description: '₿ Vende tus EasyCoins',
    options: [
      {
        name: 'cantidad',
        description: 'Cantidad de EasyCoins',
        type: 4,
        required: true,
        min_value: 1
      }
    ]
  },
  {
    name: 'mercado-cripto',
    description: '₿ Ver el precio actual de EasyCoins y tu portafolio'
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
