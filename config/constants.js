// ==========================================
// CONFIGURACIÓN GLOBAL DEL BOT
// ==========================================

module.exports = {
  // Archivos de datos
  FILES: {
    TICKETS: './tickets.json',
    ECONOMY: './economy.json',
    CLANS: './clans.json',
    PERSISTENT: './persistent.json'
  },

  // IDs de canales
  CHANNELS: {
    LOGS: '1419826668708827146'
  },

  // IDs de roles del staff (configurar según tu servidor)
  STAFF_ROLES: [
    '1241106092768899164', // Staff principal
    '1241106092768899163'  // Moderadores
  ],

  // Rol de aprobados/reclutados
  APPROVED_ROLE: '1309780662014013490',

  // Configuración de economía
  ECONOMY: {
    DAILY_REWARD: 100,
    DAILY_COOLDOWN: 86400000, // 24 horas en ms
    WORK_MIN: 50,
    WORK_MAX: 280,
    WORK_COOLDOWN: 3600000, // 1 hora en ms
    TRANSFER_COMMISSION: 0.05, // 5%
    BANK_INTEREST_RATE: 0.005, // 0.5% por hora
    BANK_MAX_HOURS: 48
  },

  // Configuración de juegos
  GAMES: {
    BLACKJACK_MULTIPLIER: 2,
    BLACKJACK_NATURAL_MULTIPLIER: 2.5,
    COINFLIP_MULTIPLIER: 2,
    DICE_JACKPOT: 5,
    DICE_HIGH: 2,
    ROULETTE_NUMBER_MULTIPLIER: 36,
    ROULETTE_COLOR_MULTIPLIER: 2,
    CLEANUP_INTERVAL: 300000, // 5 minutos
    GAME_EXPIRY_TIME: 600000 // 10 minutos
  },

  // Configuración de préstamos
  LOANS: {
    MIN_AMOUNT: 100,
    MAX_AMOUNT: 5000,
    INTEREST_RATE: 0.10, // 10%
    DUE_DAYS: 7,
    PENALTY_RATE: 0.10 // 10% adicional por retraso
  },

  // Configuración de misiones diarias
  DAILY_QUESTS: {
    COUNT: 3,
    MIN_REWARD: 80,
    MAX_REWARD: 200
  },

  // Configuración de racha
  STREAK: {
    REWARDS: {
      3: 50,
      7: 100,
      14: 250,
      30: 500
    }
  },

  // Configuración de Battle Pass
  BATTLEPASS: {
    MAX_LEVEL: 50,
    XP_PER_LEVEL: 100
  }
};
