const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits, REST, Routes, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// Inicializar Gemini AI con Vision (modelo actualizado 2.5)
let genAI = null;
let aiModel = null;
if (process.env.GEMINI_API_KEY) {
  try {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    aiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    console.log('✅ Sistema de IA activado con modelo gemini-2.5-flash');
  } catch (error) {
    console.error('❌ Error al inicializar Gemini AI:', error);
  }
} else {
  console.log('⚠️ No se encontró GEMINI_API_KEY - Sistema de IA desactivado');
}

// Archivo de tickets
const TICKETS_FILE = './tickets.json';
const CANAL_LOGS = '1419826668708827146';

// Archivo de economía
const ECONOMY_FILE = './economy.json';

// Archivo de clanes
const CLANS_FILE = './clans.json';

// Archivo de datos persistentes (cooldowns, juegos activos, etc.)
const PERSISTENT_FILE = './persistent.json';

// Almacenar juegos activos en memoria
const activeGames = new Map();

// Cargar/guardar datos persistentes
function loadPersistent() {
  if (!fs.existsSync(PERSISTENT_FILE)) {
    return { activeGames: [], cooldowns: {} };
  }
  try {
    const data = JSON.parse(fs.readFileSync(PERSISTENT_FILE, 'utf8'));
    
    // Restaurar juegos activos desde el archivo
    if (data.activeGames && Array.isArray(data.activeGames)) {
      data.activeGames.forEach(([key, value]) => {
        // Verificar que el juego no haya expirado (más de 5 minutos)
        const gameTime = parseInt(key.split('_').pop());
        const now = Date.now();
        if (now - gameTime < 300000) { // 5 minutos
          activeGames.set(key, value);
        }
      });
    }
    
    return data;
  } catch (error) {
    console.error('❌ Error cargando datos persistentes:', error);
    return { activeGames: [], cooldowns: {} };
  }
}

function savePersistent() {
  try {
    const data = {
      activeGames: Array.from(activeGames.entries()),
      cooldowns: {},
      lastSave: Date.now()
    };
    fs.writeFileSync(PERSISTENT_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('❌ Error guardando datos persistentes:', error);
  }
}

// Auto-guardar datos persistentes cada 30 segundos
setInterval(() => {
  savePersistent();
}, 30000);

// Funciones wrapper para activeGames que auto-guardan
const originalSet = activeGames.set.bind(activeGames);
const originalDelete = activeGames.delete.bind(activeGames);

activeGames.set = function(key, value) {
  const result = originalSet(key, value);
  // Guardar después de un pequeño delay para evitar escrituras excesivas
  setTimeout(() => savePersistent(), 1000);
  return result;
};

activeGames.delete = function(key) {
  const result = originalDelete(key);
  // Guardar después de un pequeño delay
  setTimeout(() => savePersistent(), 1000);
  return result;
};

// Sistema de Backup Automático
function createBackup() {
  try {
    const backupDir = './backups';
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Backup de economía
    if (fs.existsSync(ECONOMY_FILE)) {
      const economyBackup = `${backupDir}/economy_${timestamp}.json`;
      fs.copyFileSync(ECONOMY_FILE, economyBackup);
    }

    // Backup de tickets
    if (fs.existsSync(TICKETS_FILE)) {
      const ticketsBackup = `${backupDir}/tickets_${timestamp}.json`;
      fs.copyFileSync(TICKETS_FILE, ticketsBackup);
    }

    // Backup de datos persistentes
    if (fs.existsSync(PERSISTENT_FILE)) {
      const persistentBackup = `${backupDir}/persistent_${timestamp}.json`;
      fs.copyFileSync(PERSISTENT_FILE, persistentBackup);
    }

    // Backup de clanes
    if (fs.existsSync(CLANS_FILE)) {
      const clansBackup = `${backupDir}/clans_${timestamp}.json`;
      fs.copyFileSync(CLANS_FILE, clansBackup);
    }

    // Limpiar backups antiguos (mantener solo los últimos 10 de cada tipo)
    const files = fs.readdirSync(backupDir);
    const economyBackups = files.filter(f => f.startsWith('economy_')).sort().reverse();
    const ticketsBackups = files.filter(f => f.startsWith('tickets_')).sort().reverse();
    const persistentBackups = files.filter(f => f.startsWith('persistent_')).sort().reverse();
    const clansBackups = files.filter(f => f.startsWith('clans_')).sort().reverse();

    economyBackups.slice(10).forEach(file => fs.unlinkSync(`${backupDir}/${file}`));
    ticketsBackups.slice(10).forEach(file => fs.unlinkSync(`${backupDir}/${file}`));
    persistentBackups.slice(10).forEach(file => fs.unlinkSync(`${backupDir}/${file}`));
    clansBackups.slice(10).forEach(file => fs.unlinkSync(`${backupDir}/${file}`));

    console.log(`✅ Backup creado: ${timestamp}`);
  } catch (error) {
    console.error('❌ Error creando backup:', error);
  }
}

// Función para obtener los roles de staff (soporta múltiples roles separados por comas)
function getStaffRoles() {
  const staffRoles = process.env.ROL_STAFF || '1241211764100698203'; // Rol por defecto si no está configurado
  return staffRoles.split(',').map(id => id.trim());
}

function getLiderPruebasRole() {
  // Rol específico para notificaciones de aprobación/rechazo de candidatos
  return process.env.ROL_LIDER_PRUEBAS || '1241211764100698203'; // Usar rol staff por defecto si no está configurado
}

// Verificar si un usuario tiene un juego activo
function hasActiveGame(userId, gameType = null) {
  for (let [gameId, game] of activeGames.entries()) {
    if (game.userId === userId) {
      // Si se especifica un tipo de juego, verificar que coincida
      if (gameType) {
        if (game.game === gameType || gameId.startsWith(gameType)) {
          return { hasGame: true, gameId, gameType: game.game || gameType };
        }
      } else {
        // Sin tipo específico, cualquier juego cuenta
        return { hasGame: true, gameId, gameType: game.game || 'unknown' };
      }
    }
  }
  return { hasGame: false };
}

// Cargar/guardar tickets
function loadTickets() {
  if (!fs.existsSync(TICKETS_FILE)) return {};
  return JSON.parse(fs.readFileSync(TICKETS_FILE, 'utf8'));
}

function saveTickets(tickets) {
  fs.writeFileSync(TICKETS_FILE, JSON.stringify(tickets, null, 2));
}

// Cargar/guardar economía
function loadEconomy() {
  if (!fs.existsSync(ECONOMY_FILE)) return {};
  return JSON.parse(fs.readFileSync(ECONOMY_FILE, 'utf8'));
}

function saveEconomy(economy) {
  fs.writeFileSync(ECONOMY_FILE, JSON.stringify(economy, null, 2));
}

// Cargar/guardar clanes
function loadClans() {
  if (!fs.existsSync(CLANS_FILE)) return {};
  return JSON.parse(fs.readFileSync(CLANS_FILE, 'utf8'));
}

function saveClans(clans) {
  fs.writeFileSync(CLANS_FILE, JSON.stringify(clans, null, 2));
}

// Generar misiones diarias aleatorias
function generateDailyQuests() {
  const possibleQuests = [
    { id: 'play_games', description: 'Juega 3 partidas en el casino', reward: 150, goal: 3, progress: 0 },
    { id: 'win_games', description: 'Gana 2 partidas', reward: 200, goal: 2, progress: 0 },
    { id: 'work', description: 'Trabaja 2 veces', reward: 100, goal: 2, progress: 0 },
    { id: 'transfer', description: 'Transfiere monedas a otro usuario', reward: 120, goal: 1, progress: 0 },
    { id: 'daily', description: 'Reclama tu daily', reward: 80, goal: 1, progress: 0 },
    { id: 'spend', description: 'Gasta 500 monedas', reward: 180, goal: 500, progress: 0 },
    { id: 'duel', description: 'Participa en un duelo', reward: 150, goal: 1, progress: 0 }
  ];

  // Seleccionar 3 misiones aleatorias
  const shuffled = possibleQuests.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3).map((q, i) => ({ ...q, id: `quest_${i}` }));
}

// Sistema de trabajos - Datos de trabajos
function getJobsData(workLevel) {
  const baseJobs = [
    {
      id: 'programmer',
      name: 'Programador',
      emoji: '💻',
      unlockLevel: 1,
      questions: [
        { q: '🐛 ¿Qué es un "null pointer exception"?', a: ['Variable sin valor asignado', 'Error de sintaxis', 'Problema de red'], correct: 0 },
        { q: '📚 ¿Qué es un array?', a: ['Una lista de elementos', 'Un número', 'Una función'], correct: 0 },
        { q: '🔄 ¿Qué hace un loop?', a: ['Repite código', 'Borra datos', 'Cierra programa'], correct: 0 },
        { q: '⚡ ¿Qué lenguaje usa Node.js?', a: ['JavaScript', 'Python', 'Java'], correct: 0 },
        { q: '🎯 ¿Qué es debugging?', a: ['Encontrar y arreglar errores', 'Escribir código', 'Borrar archivos'], correct: 0 }
      ]
    },
    {
      id: 'chef',
      name: 'Chef',
      emoji: '👨‍🍳',
      unlockLevel: 1,
      questions: [
        { q: '🌡️ ¿A qué temperatura hierve el agua?', a: ['100°C', '50°C', '200°C'], correct: 0 },
        { q: '🍳 ¿Cuál es el primer paso para hacer un huevo frito?', a: ['Calentar la sartén', 'Agregar sal', 'Batir el huevo'], correct: 0 },
        { q: '🥖 ¿Qué ingrediente básico se usa para hacer pan?', a: ['Harina', 'Azúcar', 'Leche'], correct: 0 },
        { q: '🔪 ¿Qué significa "picar finamente"?', a: ['Cortar en trozos pequeños', 'Cortar grueso', 'No cortar'], correct: 0 },
        { q: '🍝 ¿Cuánto tiempo se cocina pasta al dente?', a: ['8-10 minutos', '30 minutos', '2 minutos'], correct: 0 }
      ]
    },
    {
      id: 'driver',
      name: 'Conductor',
      emoji: '🚗',
      unlockLevel: 1,
      questions: [
        { q: '🚦 Semáforo en ámbar, ¿qué haces?', a: ['Frenar con precaución', 'Acelerar', 'Tocar bocina'], correct: 0 },
        { q: '⛽ ¿Qué significa la luz de gasolina?', a: ['Tanque casi vacío', 'Motor caliente', 'Llantas bajas'], correct: 0 },
        { q: '🛑 ¿Qué significa una señal octagonal roja?', a: ['Alto total', 'Ceda el paso', 'No estacionar'], correct: 0 },
        { q: '🏎️ ¿Cuándo usas luces altas?', a: ['Carreteras oscuras sin tráfico', 'Siempre', 'En la ciudad'], correct: 0 },
        { q: '🔧 ¿Cada cuánto cambiar aceite del motor?', a: ['5,000-10,000 km', '50,000 km', '1,000 km'], correct: 0 }
      ]
    },
    {
      id: 'teacher',
      name: 'Profesor',
      emoji: '👨‍🏫',
      unlockLevel: 1,
      questions: [
        { q: '🌍 ¿Cuál es la capital de Francia?', a: ['París', 'Londres', 'Madrid'], correct: 0 },
        { q: '🔢 ¿Cuánto es 15 x 8?', a: ['120', '100', '150'], correct: 0 },
        { q: '📖 ¿Quién escribió Don Quijote?', a: ['Miguel de Cervantes', 'Shakespeare', 'Dante'], correct: 0 },
        { q: '🌊 ¿Cuál es el océano más grande?', a: ['Pacífico', 'Atlántico', 'Índico'], correct: 0 },
        { q: '🔬 ¿Qué es H2O?', a: ['Agua', 'Oxígeno', 'Hidrógeno'], correct: 0 }
      ]
    },
    {
      id: 'doctor',
      name: 'Médico',
      emoji: '👨‍⚕️',
      unlockLevel: 1,
      questions: [
        { q: '🩺 Paciente: fiebre, tos, dolor de cabeza', a: ['Gripe', 'Alergia', 'Insolación'], correct: 0 },
        { q: '💊 ¿Para qué sirve el paracetamol?', a: ['Bajar fiebre y dolor', 'Dormir', 'Vitamina'], correct: 0 },
        { q: '❤️ ¿Cuántas veces late el corazón por minuto?', a: ['60-100', '20-30', '200-300'], correct: 0 },
        { q: '🏥 ¿Qué es un estetoscopio?', a: ['Escuchar corazón/pulmones', 'Medir presión', 'Ver garganta'], correct: 0 },
        { q: '🩹 ¿Qué haces con una herida que sangra?', a: ['Presionar con gasa', 'Ignorarla', 'Echar alcohol'], correct: 0 }
      ]
    },
    {
      id: 'streamer',
      name: 'Streamer',
      emoji: '🎮',
      unlockLevel: 1,
      questions: [
        { q: '📹 ¿Qué plataforma es para streaming?', a: ['Twitch', 'WhatsApp', 'Gmail'], correct: 0 },
        { q: '🎤 ¿Qué necesitas para hablar en stream?', a: ['Micrófono', 'Impresora', 'Scanner'], correct: 0 },
        { q: '💬 ¿Cómo se llaman los espectadores?', a: ['Viewers', 'Players', 'Editors'], correct: 0 },
        { q: '⚡ ¿Qué internet necesitas para streamear?', a: ['Rápido y estable', 'Lento', 'Solo WiFi'], correct: 0 },
        { q: '🎁 ¿Qué son las subs?', a: ['Suscripciones pagadas', 'Puntos gratis', 'Emojis'], correct: 0 }
      ]
    }
  ];

  const premiumJobs = [
    {
      id: 'ceo',
      name: 'CEO',
      emoji: '💼',
      unlockLevel: 10,
      questions: [
        { q: '📊 ¿Qué es un balance general?', a: ['Estado financiero', 'Lista de empleados', 'Inventario'], correct: 0 },
        { q: '💰 ¿Qué es ROI?', a: ['Retorno de inversión', 'Riesgo operativo', 'Registro oficial'], correct: 0 },
        { q: '👥 ¿Qué hace un CEO?', a: ['Dirige la empresa', 'Limpia oficinas', 'Contesta teléfonos'], correct: 0 }
      ]
    },
    {
      id: 'athlete',
      name: 'Deportista Pro',
      emoji: '⚽',
      unlockLevel: 12,
      questions: [
        { q: '🏃 ¿Cuántos minutos tiene un partido de fútbol?', a: ['90 minutos', '60 minutos', '120 minutos'], correct: 0 },
        { q: '💪 ¿Qué es importante antes de entrenar?', a: ['Calentar', 'Dormir', 'Comer mucho'], correct: 0 },
        { q: '🥇 ¿Cada cuántos años son las Olimpiadas?', a: ['4 años', '2 años', '5 años'], correct: 0 }
      ]
    },
    {
      id: 'actor',
      name: 'Actor',
      emoji: '🎬',
      unlockLevel: 15,
      questions: [
        { q: '🎭 ¿Qué es un guión?', a: ['Diálogos y acciones', 'Vestuario', 'Escenario'], correct: 0 },
        { q: '🎥 ¿Qué grita el director al empezar?', a: ['¡Acción!', '¡Silencio!', '¡Corten!'], correct: 0 },
        { q: '🏆 ¿Cuál es el premio más famoso del cine?', a: ['Oscar', 'Grammy', 'Emmy'], correct: 0 }
      ]
    }
  ];

  return [...baseJobs, ...premiumJobs.filter(job => workLevel >= job.unlockLevel)];
}

// Calcular XP necesario para siguiente nivel
function getXPForLevel(level) {
  return level * 200; // Nivel 1 = 200 XP, Nivel 2 = 400 XP, etc.
}

// Calcular pago base según nivel y turno
function calculatePay(baseMin, baseMax, workLevel, shift) {
  const levelBonus = 1 + (workLevel - 1) * 0.15; // +15% por nivel
  const shiftMultiplier = { '2h': 1, '4h': 2.2, '8h': 4.5 }[shift];
  
  const min = Math.floor(baseMin * levelBonus * shiftMultiplier);
  const max = Math.floor(baseMax * levelBonus * shiftMultiplier);
  
  return { min, max };
}

// Obtener o crear usuario de economía
function getUser(userId) {
  const economy = loadEconomy();
  if (!economy[userId]) {
    economy[userId] = {
      coins: 1000,
      bank: 0,
      lastDaily: 0,
      lastWork: 0,
      lastSpin: 0,
      lastActive: Date.now(),
      streak: 0,
      loan: null, // { amount, deadline, paid }
      quests: [],
      inventory: [],
      titles: [],
      workLevel: 1,
      workXP: 0,
      workStreak: 0,
      lastWorkDate: null,
      businesses: [],
      lastBusinessClaim: 0,
      stocks: {},
      properties: [],
      crypto: { easycoins: 0 },
      rpg: {
        class: null,
        level: 1,
        xp: 0,
        hp: 100,
        maxHp: 100,
        mp: 50,
        maxMp: 50,
        stats: { atk: 10, def: 5, magic: 5, speed: 5, luck: 5 },
        equipment: { weapon: null, armor: null, accessory: null },
        inventory: [],
        lastDungeon: 0,
        bossesDefeated: 0
      },
      social: {
        partner: null,
        marriageDate: null,
        clan: null,
        reputation: 0,
        repsGiven: [],
        lastRepDate: 0
      },
      battlePass: {
        tier: 0,
        xp: 0,
        season: 1,
        claimed: []
      },
      boxes: {
        common: 0,
        rare: 0,
        legendary: 0
      },
      stats: {
        gamesPlayed: 0,
        gamesWon: 0,
        gamesLost: 0,
        totalWinnings: 0,
        totalLosses: 0
      }
    };
    saveEconomy(economy);
  }
  
  // Migrar usuarios existentes
  if (economy[userId].bank === undefined) economy[userId].bank = 0;
  if (economy[userId].lastWork === undefined) economy[userId].lastWork = 0;
  if (economy[userId].lastSpin === undefined) economy[userId].lastSpin = 0;
  if (economy[userId].lastActive === undefined) economy[userId].lastActive = Date.now();
  if (economy[userId].streak === undefined) economy[userId].streak = 0;
  if (economy[userId].loan === undefined) economy[userId].loan = null;
  if (economy[userId].quests === undefined) economy[userId].quests = [];
  if (economy[userId].workLevel === undefined) economy[userId].workLevel = 1;
  if (economy[userId].workXP === undefined) economy[userId].workXP = 0;
  if (economy[userId].workStreak === undefined) economy[userId].workStreak = 0;
  if (economy[userId].lastWorkDate === undefined) economy[userId].lastWorkDate = null;
  if (economy[userId].businesses === undefined) economy[userId].businesses = [];
  if (economy[userId].lastBusinessClaim === undefined) economy[userId].lastBusinessClaim = 0;
  if (economy[userId].stocks === undefined) economy[userId].stocks = {};
  if (economy[userId].properties === undefined) economy[userId].properties = [];
  if (economy[userId].crypto === undefined) economy[userId].crypto = { easycoins: 0 };
  if (economy[userId].rpg === undefined) {
    economy[userId].rpg = {
      class: null,
      level: 1,
      xp: 0,
      hp: 100,
      maxHp: 100,
      mp: 50,
      maxMp: 50,
      stats: { atk: 10, def: 5, magic: 5, speed: 5, luck: 5 },
      equipment: { weapon: null, armor: null, accessory: null },
      inventory: [],
      lastDungeon: 0,
      bossesDefeated: 0
    };
  }
  if (economy[userId].social === undefined) {
    economy[userId].social = {
      partner: null,
      marriageDate: null,
      clan: null,
      reputation: 0,
      repsGiven: [],
      lastRepDate: 0
    };
  }
  if (economy[userId].battlePass === undefined) {
    economy[userId].battlePass = {
      tier: 0,
      xp: 0,
      season: 1,
      claimed: []
    };
  }
  if (economy[userId].boxes === undefined) {
    economy[userId].boxes = {
      common: 0,
      rare: 0,
      legendary: 0
    };
  }
  
  return economy[userId];
}

function updateUser(userId, data) {
  const economy = loadEconomy();
  economy[userId] = { ...economy[userId], ...data };
  saveEconomy(economy);
}

// Función para agregar XP con boost
function addBattlePassXP(userData, xp) {
  let finalXP = xp;
  
  // Verificar si tiene boost activo
  if (userData.battlePass.xpBoost && Date.now() < userData.battlePass.xpBoost) {
    finalXP = xp * 2; // Doble XP
  }
  
  userData.battlePass.xp += finalXP;
  return { finalXP, hasBoost: finalXP > xp }; // Retorna el XP final y si tiene boost
}

client.once('ready', async () => {
  console.log(`✅ Bot listo: ${client.user.tag}`);
  
  // Cargar datos persistentes (juegos activos, cooldowns, etc.)
  console.log('📂 Cargando datos persistentes...');
  loadPersistent();
  console.log(`✅ Datos persistentes cargados. Juegos activos restaurados: ${activeGames.size}`);
  
  // Registrar comandos ejecutando register.js
  try {
    console.log('🔄 Registrando comandos slash...');
    require('./register.js');
  } catch (error) {
    console.error('❌ Error registrando comandos:', error);
  }
  
  // Crear backup inicial
  createBackup();
  
  // Backup automático cada hora (3600000 ms)
  setInterval(() => {
    createBackup();
  }, 3600000);

  // Verificar tickets inactivos cada 30 minutos
  setInterval(async () => {
    try {
      const tickets = loadTickets();
      const now = Date.now();
      const inactivityLimit = 48 * 60 * 60 * 1000; // 48 horas en ms

      for (const [channelId, ticket] of Object.entries(tickets)) {
        if (ticket.status !== 'open') continue;
        if (!ticket.lastUserActivity) continue;

        const timeSinceLastActivity = now - ticket.lastUserActivity;

        if (timeSinceLastActivity >= inactivityLimit) {
          try {
            const channel = await client.channels.fetch(channelId);
            if (!channel) {
              delete tickets[channelId];
              continue;
            }

            // Avisar que se va a cerrar
            const warningEmbed = new EmbedBuilder()
              .setColor('#e67e22')
              .setTitle('⚠️ Ticket Inactivo')
              .setDescription('Este ticket será cerrado por inactividad del usuario.')
              .addFields(
                { name: '⏰ Última actividad', value: `<t:${Math.floor(ticket.lastUserActivity / 1000)}:R>`, inline: true },
                { name: '🔒 Cerrando en', value: '30 segundos', inline: true }
              )
              .setFooter({ text: 'El usuario no ha respondido en 48 horas' })
              .setTimestamp();

            await channel.send({ embeds: [warningEmbed] });

            // Esperar 30 segundos antes de cerrar
            setTimeout(async () => {
              try {
                const closedEmbed = new EmbedBuilder()
                  .setColor('#e74c3c')
                  .setTitle('🔒 Ticket Cerrado Automáticamente')
                  .setDescription('Este ticket ha sido cerrado por inactividad del usuario (48 horas sin respuesta).')
                  .setFooter({ text: '© Ea$y Esports | Sistema Automático' })
                  .setTimestamp();

                await channel.send({ embeds: [closedEmbed] });

                // Log de cierre automático
                try {
                  const canalLogs = await client.channels.fetch(CANAL_LOGS);
                  const usuario = await client.users.fetch(ticket.userId);
                  const tipoTicket = ticket.tipo === 'reclutamiento' ? 'Reclutamiento' : 
                                    ticket.tipo === 'crear_soporte_reporte' ? 'Reporte' :
                                    ticket.tipo === 'crear_soporte_duda' ? 'Duda' : 'Soporte';

                  const logEmbed = new EmbedBuilder()
                    .setColor('#e67e22')
                    .setTitle('🔒 Ticket Cerrado Automáticamente')
                    .setDescription('⚠️ Ticket cerrado por inactividad del usuario')
                    .addFields(
                      { name: '👤 Usuario:', value: `${usuario} (${usuario.tag})`, inline: true },
                      { name: '📋 Tipo:', value: tipoTicket, inline: true },
                      { name: '⏰ Inactivo por:', value: '48 horas', inline: true },
                      { name: '📅 Creado:', value: `<t:${Math.floor(new Date(ticket.createdAt).getTime() / 1000)}:F>`, inline: true },
                      { name: '🕐 Última actividad:', value: `<t:${Math.floor(ticket.lastUserActivity / 1000)}:R>`, inline: true }
                    )
                    .setThumbnail(usuario.displayAvatarURL())
                    .setFooter({ text: '© Ea$y Esports | Sistema de Auto-cierre' })
                    .setTimestamp();

                  await canalLogs.send({ embeds: [logEmbed] });
                } catch (error) {
                  console.error('Error al enviar log de auto-cierre:', error);
                }

                // Eliminar ticket del registro y canal
                delete tickets[channelId];
                saveTickets(tickets);

                setTimeout(async () => {
                  await channel.delete().catch(console.error);
                }, 5000);

              } catch (error) {
                console.error('Error al cerrar ticket automáticamente:', error);
              }
            }, 30000);

          } catch (error) {
            console.error('Error al procesar ticket inactivo:', error);
          }
        }
      }
      
      saveTickets(tickets);
    } catch (error) {
      console.error('Error en verificación de tickets inactivos:', error);
    }
  }, 1800000); // Cada 30 minutos

  // Limpiar juegos abandonados/expirados cada 5 minutos
  setInterval(() => {
    try {
      const now = Date.now();
      const expiredGames = [];
      
      for (const [gameId, game] of activeGames.entries()) {
        // Extraer timestamp del gameId
        const parts = gameId.split('_');
        const timestamp = parseInt(parts[parts.length - 1]);
        
        // Si el juego tiene más de 10 minutos, eliminarlo
        if (!isNaN(timestamp) && now - timestamp > 600000) { // 10 minutos
          expiredGames.push(gameId);
        }
      }
      
      if (expiredGames.length > 0) {
        expiredGames.forEach(gameId => activeGames.delete(gameId));
        console.log(`🧹 Limpieza automática: ${expiredGames.length} juego(s) expirado(s) eliminado(s)`);
      }
    } catch (error) {
      console.error('Error en limpieza de juegos:', error);
    }
  }, 300000); // Cada 5 minutos
});

// Manejar mensajes para el juego de adivinar el número
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // Actualizar actividad del usuario en tickets
  const tickets = loadTickets();
  const ticket = tickets[message.channel.id];
  if (ticket && ticket.userId === message.author.id && ticket.status === 'open') {
    ticket.lastUserActivity = Date.now();
    saveTickets(tickets);
  }

  // Sistema de respuesta automática con IA en tickets
  if (ticket && ticket.status === 'open' && aiModel) {
    // Solo responder al usuario que creó el ticket (NO a staff ni otros usuarios)
    const staffRoles = getStaffRoles();
    const isStaff = message.member?.roles?.cache?.some(role => staffRoles.includes(role.id)) || 
                    message.member?.permissions?.has(PermissionFlagsBits.Administrator);
    const isTicketOwner = message.author.id === ticket.userId;
    
    // Si es staff o NO es el dueño del ticket, no responder
    if (isStaff || !isTicketOwner) return;

    // Verificar si hay staff activo en el ticket (mensajes del staff en los últimos 5 minutos)
    const recentMessages = await message.channel.messages.fetch({ limit: 10 });
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    const staffIsActive = Array.from(recentMessages.values()).some(msg => {
      if (msg.createdTimestamp < fiveMinutesAgo) return false;
      const msgIsStaff = msg.member?.roles?.cache?.some(role => staffRoles.includes(role.id)) || 
                         msg.member?.permissions?.has(PermissionFlagsBits.Administrator);
      return msgIsStaff && !msg.author.bot;
    });

    // Si hay staff atendiendo activamente, no responder con IA
    if (staffIsActive) return;

    try {
      // Indicar que está escribiendo
      await message.channel.sendTyping();

      // Verificar si hay imágenes en el mensaje
      const hasImages = message.attachments.size > 0 && 
                        message.attachments.some(att => att.contentType?.startsWith('image/'));

      // Obtener historial del ticket (últimos 20 mensajes)
      const messages = await message.channel.messages.fetch({ limit: 20 });
      const messagesArray = Array.from(messages.values()).reverse();
      
      // Contar imágenes previas del usuario (no del bot)
      const userImages = messagesArray.filter(m => 
        !m.author.bot && 
        m.author.id === message.author.id &&
        m.attachments.size > 0 &&
        m.attachments.some(att => att.contentType?.startsWith('image/'))
      );
      
      const imageCount = userImages.length;

      const history = messagesArray
        .map(m => `${m.author.bot ? 'Bot' : 'Usuario'}: ${m.content}`)
        .join('\n');

      // Determinar tipo de ticket
      const tipoTicket = ticket.tipo === 'reclutamiento' ? 'Reclutamiento' : 'Soporte Técnico';

      let result;

      if (hasImages) {
        // gemini-2.5-flash puede manejar múltiples imágenes
        const imageAttachments = Array.from(message.attachments.values())
          .filter(att => att.contentType?.startsWith('image/'));

        // Descargar todas las imágenes
        const imageParts = [];
        for (const attachment of imageAttachments) {
          const response = await fetch(attachment.url);
          const buffer = await response.arrayBuffer();
          const base64Image = Buffer.from(buffer).toString('base64');
          imageParts.push({
            inlineData: {
              data: base64Image,
              mimeType: attachment.contentType
            }
          });
        }
        
        const totalImagesInMessage = imageAttachments.length;

        const prompt = ticket.tipo === 'reclutamiento' 
          ? `Eres un reclutador profesional de Ea$y Esports que mantiene conversaciones naturales. Tono amigable, profesional y conversacional.

CONTEXTO COMPLETO DEL TICKET:
- Usuario: ${message.author.username}
- Mensaje actual: ${message.content || 'Envió imagen(s)'}
- Imágenes en este mensaje: ${totalImagesInMessage}
- Imágenes enviadas previamente por usuario: ${imageCount}
- Total de imágenes del usuario hasta ahora: ${imageCount + totalImagesInMessage}
- Requisitos: 2 capturas (Resurgimiento RANKED + Battle Royale RANKED), KD >= 3.0 en ambas

HISTORIAL COMPLETO (LEE TODO ANTES DE RESPONDER):
${history}

⚠️ REGLAS DE CONVERSACIÓN:
1. LEE EL HISTORIAL COMPLETO - Busca si YA tomaste una decisión ([APROBACIÓN_CONFIRMADA] o [RECHAZO_CONFIRMADO])
2. Si YA enviaste [APROBACIÓN_CONFIRMADA] o [RECHAZO_CONFIRMADO] antes → NUNCA lo envíes de nuevo
3. NO REPITAS información que ya diste antes
4. Si ya analizaste capturas y tomaste decisión, NO pidas capturas de nuevo
5. Si el usuario hace una PREGUNTA después de la decisión, respóndela naturalmente
6. Si el usuario comenta algo, responde de forma conversacional
7. Mantén coherencia con lo que dijiste antes
8. UNA decisión por ticket - después solo conversas

🔍 VALIDACIÓN CRÍTICA - CÓMO FUNCIONA RANKED EN WARZONE:
⚠️ IMPORTANTE: En Warzone, el rango y las estadísticas están en PANTALLAS SEPARADAS:
- Una captura muestra el RANGO/DIVISIÓN (Carmesí, Iridiscente, Oro, etc.)
- Otra captura muestra las ESTADÍSTICAS con K/D del mismo modo Ranked

Por cada modo necesitas VALIDAR:
1. ✅ Que sea modo RANKED (busca texto "RANKED", "PARTIDA IGUALADA", "CLASIFICATORIA" o rango visible)
2. ✅ Que el K/D sea del modo Ranked (puede estar en captura separada)
3. ✅ NO aceptar K/D de modo normal/público

🎯 PROCESO DE VALIDACIÓN:
- Si envían RANGO → Confirma que sea Ranked, pide las stats con K/D
- Si envían STATS con K/D → Verifica que sea de modo Ranked (no modo normal)
- Si envían stats de modo NORMAL → Rechaza esa captura, pide stats de Ranked
- Necesitas confirmar ambos modos: Resurgimiento Ranked Y Battle Royale Ranked

🚫 SI LA CAPTURA ES DE MODO NORMAL/PÚBLICO:
→ "Esta captura muestra el modo normal/público, no Ranked. Necesito ver las estadísticas del modo **Ranked/Partida Igualada** competitivo. Por favor envía la captura correcta del menú Ranked."

⚠️ REGLA ABSOLUTA: 
- Solo cuenta K/D de capturas de modo RANKED
- Pueden enviar varias capturas por modo (rango + stats separadas)
- NO analices K/D de modo normal/público
- Solo usa [APROBACIÓN_CONFIRMADA] o [RECHAZO_CONFIRMADO] cuando tengas K/D RANKED >= 3.0 de AMBOS modos confirmado

ANÁLISIS DE IMÁGENES (solo si hay imágenes nuevas en este mensaje):
- Si enviaron 2 imágenes juntas: Verifica que AMBAS sean Ranked antes de analizar KD
- Si enviaron 1 imagen y ya había otra: Verifica que AMBAS sean Ranked antes de analizar KD
- Si es la primera imagen: Analízala y pide la segunda

SITUACIONES POSIBLES:

A) SI HAY IMÁGENES NUEVAS:
   - Imagen borrosa → Pide una más clara
   - Muestra RANGO de Ranked → Confirma y pide captura de stats con K/D: "Veo tu rango [X]. Ahora envía la captura de tus estadísticas de Ranked donde se vea el K/D."
   - Muestra STATS con K/D:
     * Si es de modo RANKED (con indicador) → Analiza el K/D
     * Si es de modo NORMAL/PÚBLICO → Rechaza: "Esta captura es de modo normal, no Ranked. Envía las stats del modo Ranked competitivo."
   
   PROCESO POR MODO:
   - Resurgimiento Ranked: Espera capturas que demuestren ser Ranked + K/D visible
   - Battle Royale Ranked: Espera capturas que demuestren ser Ranked + K/D visible
   
   DECISIÓN FINAL (solo cuando tengas info completa):
   - Si tienes K/D RANKED confirmado de AMBOS modos:
     * KD >= 3.0 en AMBOS modos Ranked → APROBADO [APROBACIÓN_CONFIRMADA]
     * KD < 3.0 en algún modo Ranked → RECHAZADO [RECHAZO_CONFIRMADO]
   - Si falta información de algún modo → Sigue pidiendo capturas

⚠️ RECORDATORIO CRÍTICO: 
- Acepta múltiples capturas por modo (rango + stats separadas)
- Solo cuenta K/D de modo RANKED (con indicadores visibles)
- Ignora completamente K/D de modo normal/público
- Necesitas K/D Ranked de AMBOS modos antes de decidir

B) SI NO HAY IMÁGENES (solo texto):
   - Usuario pregunta algo → Responde naturalmente
   - Usuario hace comentario → Responde conversacionalmente
   - Usuario pregunta requisitos → Explica: KD 3.0+ en ambos modos ranked
   - Si YA tomaste decisión antes → NO pidas capturas de nuevo, solo conversa

🚨 REGLA ABSOLUTAMENTE CRÍTICA - SOLO DECIDES UNA VEZ:
⛔ PROHIBIDO enviar [APROBACIÓN_CONFIRMADA] o [RECHAZO_CONFIRMADO] más de UNA vez
⛔ Si ya enviaste decisión antes (búscala en el historial) → NO la envíes de nuevo

✅ CHECKLIST OBLIGATORIO ANTES DE DECIDIR (verifica TODO):
1. ¿Ya tomé decisión antes en este ticket? → Si SÍ: NO decidas de nuevo, solo conversa
2. ¿Tengo K/D de RESURGIMIENTO RANKED visible y verificado? → Debe ser SÍ
3. ¿Tengo K/D de BATTLE ROYALE RANKED visible y verificado? → Debe ser SÍ  
4. ¿Ambas capturas son definitivamente de modo RANKED (no normal)? → Debe ser SÍ
5. ¿Tengo los valores numéricos exactos de AMBOS K/D? → Debe ser SÍ

⚠️ SI ALGUNA ES "NO" → **NO USES** [APROBACIÓN_CONFIRMADA] NI [RECHAZO_CONFIRMADO]
⚠️ En su lugar → Di algo como: "Perfecto, recibí tu captura de [modo]. Ahora envía la de [modo que falta]"

ESTRATEGIA DE EVALUACIÓN POR ETAPAS:
📍 PRIMERA CAPTURA: Confirma que sea Ranked, anota el K/D, pide la segunda
📍 SEGUNDA CAPTURA: Confirma que sea Ranked, anota el K/D, AHORA SÍ decide

📋 FORMATO DE RESPUESTAS (Sé natural, evita repetir requisitos innecesariamente):

🟢 PRIMERA captura con K/D >= 3.0:
"Perfecto, ${message.author.username}! Ya revisé tu [Resurgimiento/Battle Royale] Ranked y confirmo que tu K/D es de [X.X]. ¡Excelente estadística! Ahora envía las capturas de [Battle Royale/Resurgimiento] Ranked para completar la evaluación."

🟡 PRIMERA captura con K/D < 3.0:
"Perfecto, ${message.author.username}! Ya revisé tu [Resurgimiento/Battle Royale] Ranked con K/D de [X.X]. Ahora envía las capturas de [Battle Royale/Resurgimiento] Ranked para completar la evaluación."

🟢 SEGUNDA captura - AMBOS K/D >= 3.0 (APROBACIÓN):
"¡Excelente! Ya revisé tu [Battle Royale/Resurgimiento] Ranked con K/D [Y.Y]. Junto con tu [Resurgimiento/Battle Royale] Ranked (K/D [X.X]), cumples perfectamente los requisitos. El equipo te contactará pronto para las pruebas. Tienes 48h para completarlas. ¡Bienvenido al proceso! [APROBACIÓN_CONFIRMADA]"

🔴 SEGUNDA captura - Algún K/D < 3.0 (RECHAZO):
"Gracias por enviar todas las capturas. Ya revisé tus estadísticas completas: [Resurgimiento/Battle Royale] Ranked K/D [X.X] y [Battle Royale/Resurgimiento] Ranked K/D [Y.Y]. Lamentablemente no cumples el requisito mínimo de K/D 3.0 en ambos modos ranked. Sigue mejorando y vuelve a postularte cuando alcances el estándar requerido. [RECHAZO_CONFIRMADO]"

🔵 Si solo envía RANGO (sin K/D visible):
"Veo tu rango [Carmesí/Iridiscente/etc.] en [modo] Ranked. Ahora envía la captura donde se vea tu K/D de ese modo (puede estar en otra pantalla del menú)."

🔵 Si envía captura de modo NORMAL:
"Esta captura es de modo normal/público. Necesito las estadísticas del modo Ranked/Partida Igualada competitivo (donde tienes rango). Por favor envía las capturas correctas."

REGLAS FINALES:
- Habla natural, mantén contexto, NO repitas
- SIEMPRE di "Ranked" al mencionar modos
- ⚠️ CRÍTICO: SOLO decides UNA VEZ por ticket - después solo conversas
- ⚠️ CRÍTICO: NECESITAS VER AMBOS MODOS antes de decidir
- ⚠️ CRÍTICO: NUNCA aceptes K/D de modo normal - SOLO Ranked
- Máximo 120 palabras por respuesta`
          : `Eres un asistente de soporte profesional para Ea$y Esports, un equipo competitivo de Call of Duty Warzone.

CONTEXTO DEL TICKET:
- Tipo: ${tipoTicket}
- Usuario: ${message.author.username}
- Mensaje: ${message.content || 'Usuario envió una imagen'}

INSTRUCCIONES:
1. Analiza la imagen detalladamente
2. Si es captura de problema técnico, identifica el error
3. Si es gameplay, proporciona feedback constructivo
4. Si es consulta general, responde con información útil
5. Responde profesionalmente y conciso (máximo 150 palabras)
6. Usa emojis moderadamente (2-3)

ANALIZA LA IMAGEN Y RESPONDE:`;

        // Enviar prompt con todas las imágenes
        result = await aiModel.generateContent([prompt, ...imageParts]);

      } else {
        // Procesar solo texto (sin imágenes)
        const prompt = ticket.tipo === 'reclutamiento'
          ? `Eres un reclutador profesional de Ea$y Esports. Mantén conversaciones naturales, profesionales y coherentes.

HISTORIAL COMPLETO (LEE TODO):
${history}

MENSAJE ACTUAL: ${message.content}

REGLAS DE CONVERSACIÓN:
1. LEE EL HISTORIAL - Entiende qué ya pasó
2. NO REPITAS lo que ya dijiste antes
3. Si ya analizaste capturas y decidiste → Responde a preguntas, NO pidas capturas de nuevo
4. Si el usuario pregunta algo después de tu decisión → Responde naturalmente
5. Si pregunta requisitos y aún no envió capturas → Explica requisitos
6. Mantén coherencia total con mensajes anteriores

REQUISITOS (menciona solo si pregunta):
- KD 3.0+ en Resurgimiento Ranked Y Battle Royale Ranked
- 2 capturas de pantalla (modos ranked únicamente)
- 48h para pruebas después de aprobación

RESPONDE DE FORMA NATURAL:
- Si pregunta requisitos → Explícalos
- Si da ID de Activision → Pide capturas (no tienes acceso a consultas)
- Si hace pregunta general → Responde profesionalmente
- Si ya decidiste antes → NO pidas capturas, solo conversa
- Máximo 100 palabras, tono profesional y conversacional`
          : `Eres un asistente de soporte profesional de Ea$y Esports, equipo competitivo de Call of Duty Warzone. Tu trabajo es ayudar con cualquier duda de forma útil y profesional.

HISTORIAL COMPLETO:
${history}

PREGUNTA ACTUAL: ${message.content}

INFORMACIÓN DEL EQUIPO:
- Ea$y Esports: Equipo competitivo de Warzone
- Requisitos: KD 3.0+ en Resurgimiento Ranked y Battle Royale Ranked
- Proceso de reclutamiento: Abrir ticket de reclutamiento, enviar capturas de stats ranked
- Postulaciones: SIEMPRE ABIERTAS - cualquier persona puede abrir ticket de reclutamiento
- Torneos y scrims regulares
- Entrenamiento y mejora constante

TIPOS DE DUDAS QUE PUEDES RESOLVER:
1. **Cómo postularse**: Abrir ticket de reclutamiento y enviar capturas de estadísticas ranked
2. Requisitos para unirse: KD 3.0+ en ambos modos ranked
3. Proceso de reclutamiento y pruebas
4. Información sobre torneos y competiciones
5. Dudas sobre Discord (roles, canales, permisos)
6. Horarios de entrenamientos/scrims
7. Reglas del equipo
8. Preguntas generales sobre Call of Duty Warzone

SITUACIONES QUE DEBES DERIVAR AL STAFF:
- Reportar un jugador/miembro del equipo
- Denuncias o quejas sobre comportamiento
- Problemas técnicos graves
- Solicitudes especiales o permisos
- Cualquier tema que requiera acción del staff

CÓMO RESPONDER:
- Si pregunta cómo postularse → "Puedes postularte ahora mismo abriendo un ticket de reclutamiento y enviando capturas de tus estadísticas ranked"
- Si pregunta si están abiertas → "Las postulaciones están siempre abiertas. Solo necesitas cumplir KD 3.0+ en ambos modos ranked"
- Si es sobre requisitos → Explica KD 3.0+ en Resurgimiento Ranked y Battle Royale Ranked
- Si quiere reportar/denunciar → "Entiendo tu situación. El staff revisará tu reporte y tomará las medidas necesarias. Espera su respuesta pronto."
- Si es duda técnica compleja → "El staff revisará tu consulta y te responderá pronto"
- Si requiere acción del staff → "He notado tu solicitud. El staff la revisará y te responderá a la brevedad"
- NO inventes que las postulaciones están cerradas
- Lee el historial para mantener contexto
- No repitas información ya dicha
- Tono profesional pero amigable
- Máximo 150 palabras

RESPONDE LA DUDA:`;

        result = await aiModel.generateContent(prompt);
      }

      const responseText = result.response.text();

      // Enviar respuesta
      await message.reply({
        content: responseText,
        allowedMentions: { repliedUser: false }
      });

      // Si es ticket de reclutamiento y la IA tomó una decisión FINAL, notificar al Líder de Pruebas
      // IMPORTANTE: Solo notificar UNA VEZ por ticket - evitar spam de notificaciones
      if (ticket.tipo === 'reclutamiento') {
        const decision = responseText.toUpperCase();
        
        // Verificar si ya se tomó una decisión antes revisando el historial
        const allMessages = await message.channel.messages.fetch({ limit: 50 });
        const previousDecisions = Array.from(allMessages.values()).filter(msg => {
          if (!msg.author.bot || msg.author.id !== client.user.id) return false;
          const content = msg.content.toUpperCase();
          return content.includes('APROBACIÓN_CONFIRMADA') || 
                 content.includes('RECHAZO_CONFIRMADO') ||
                 content.includes('BIENVENIDO AL PROCESO');
        });

        // Si ya hay una decisión previa, NO enviar otra notificación
        if (previousDecisions.length > 1) {
          console.log(`⚠️ Decisión duplicada detectada en ticket ${message.channel.id} - Notificación bloqueada`);
          return; // Salir sin enviar notificación duplicada
        }
        
        if (decision.includes('APROBACIÓN_CONFIRMADA') || decision.includes('BIENVENIDO AL PROCESO')) {
          // Notificar al Líder de Pruebas con embed verde (discreto, sin mencionar IA)
          const liderPruebasRoleId = getLiderPruebasRole();
          
          const approvedEmbed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ Nuevo Candidato Aprobado')
            .setDescription(`El usuario ${message.author} ha pasado la revisión inicial de estadísticas.`)
            .addFields(
              { name: '👤 Usuario', value: `${message.author.tag}`, inline: true },
              { name: '📊 Requisitos', value: 'KD >= 3.0 en ambos modos ✅', inline: true },
              { name: '⏭️ Siguiente paso', value: 'Coordinar prueba en partida', inline: false }
            )
            .setFooter({ text: 'Revisión automática de estadísticas' })
            .setTimestamp();

          await message.channel.send({
            content: `<@&${liderPruebasRoleId}>`,
            embeds: [approvedEmbed]
          });
          
          console.log(`✅ Candidato aprobado: ${message.author.tag} en ticket ${message.channel.id}`);

        } else if (decision.includes('RECHAZO_CONFIRMADO')) {
          // Notificar al Líder de Pruebas con embed rojo (discreto)
          const liderPruebasRoleId = getLiderPruebasRole();
          
          const rejectedEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ Candidato No Cumple Requisitos')
            .setDescription(`El usuario ${message.author} no alcanza el KD mínimo requerido tras revisar ambos modos ranked.`)
            .addFields(
              { name: '👤 Usuario', value: `${message.author.tag}`, inline: true },
              { name: '📊 Estado', value: 'KD insuficiente (< 3.0)', inline: true },
              { name: '⏭️ Siguiente paso', value: 'Cerrar ticket', inline: false }
            )
            .setFooter({ text: 'Revisión automática de estadísticas • hoy a las ' + new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) })
            .setTimestamp();

          await message.channel.send({
            content: `<@&${liderPruebasRoleId}>`,
            embeds: [rejectedEmbed]
          });
          
          console.log(`❌ Candidato rechazado: ${message.author.tag} en ticket ${message.channel.id}`);
        }
      }

    } catch (error) {
      console.error('Error en respuesta automática IA:', error);
      // Silenciosamente fallar - el staff puede responder manualmente
    }
  }

  // Buscar si el usuario tiene un juego activo
  for (const [gameId, game] of activeGames.entries()) {
    if (gameId.startsWith('guess_') && game.userId === message.author.id) {
      const guess = parseInt(message.content);
      
      if (isNaN(guess) || guess < 1 || guess > 100) {
        continue; // Ignorar mensajes que no sean números válidos
      }

      game.attempts++;

      if (guess === game.targetNumber) {
        const multipliers = [0, 5, 4, 3, 2, 1];
        const multiplier = multipliers[game.attempts];
        const winnings = game.bet * multiplier;
        const bpXPRewards = [0, 80, 60, 45, 35, 25];
        const bpXP = bpXPRewards[game.attempts];

        const userData = getUser(message.author.id);
        userData.coins += winnings - game.bet;
        const xpResult = addBattlePassXP(userData, bpXP);
        const finalXP = xpResult.finalXP;
        const hasBoost = xpResult.hasBoost;
        userData.stats.gamesPlayed++;
        userData.stats.gamesWon++;
        userData.stats.totalWinnings += winnings - game.bet;
        updateUser(message.author.id, userData);

        const medals = ['', '🥇', '🥈', '🥉', '🎖️', '⭐'];
        const resultBox = `╔═══════════════════════╗\n║                                              ║\n║  ${medals[game.attempts]} **¡CORRECTO!** ${medals[game.attempts]}  ║\n║   El número era **${game.targetNumber}**   ║\n║                                              ║\n║  💰 **+${(winnings - game.bet).toLocaleString()} 🪙** (${multiplier}x)  ║\n║  ⭐ **+${finalXP} XP${hasBoost ? ' 🔥' : ''}**  ║\n║                                              ║\n╚═══════════════════════╝`;

        const embed = new EmbedBuilder()
          .setColor('#2ecc71')
          .setTitle('🔢 Adivina el Número - ¡ACERTASTE!')
          .setDescription(resultBox)
          .addFields(
            { name: '🎯 Intentos', value: `**${game.attempts}**/${game.maxAttempts}`, inline: true },
            { name: '💎 Multiplicador', value: `**${multiplier}x**`, inline: true },
            { name: '🏆 Premio', value: `**${(winnings - game.bet).toLocaleString()}** 🪙`, inline: true }
          )
          .setFooter({ text: `💰 Nuevo balance: ${userData.coins.toLocaleString()} 🪙` });

        await message.reply({ embeds: [embed] });
        activeGames.delete(gameId);
        break;
      } else {
        if (game.attempts >= game.maxAttempts) {
          const userData = getUser(message.author.id);
          userData.coins -= game.bet;
          userData.stats.gamesPlayed++;
          userData.stats.gamesLost++;
          userData.stats.totalLosses += game.bet;
          updateUser(message.author.id, userData);

          const embed = new EmbedBuilder()
            .setColor('#e74c3c')
            .setTitle('🔢 Adivina el Número - Game Over')
            .setDescription(`╔═══════════════════╗\n║                                      ║\n║  💀 **GAME OVER** 💀  ║\n║                                      ║\n║  El número era **${game.targetNumber}**  ║\n║  **-${game.bet.toLocaleString()} 🪙**  ║\n║                                      ║\n╚═══════════════════╝`)
            .setFooter({ text: `💰 Nuevo balance: ${userData.coins.toLocaleString()} 🪙 | ¡Mejor suerte la próxima vez!` });

          await message.reply({ embeds: [embed] });
          activeGames.delete(gameId);
          break;
        } else {
          const hint = guess < game.targetNumber ? '⬆️ **MÁS ALTO**' : '⬇️ **MÁS BAJO**';
          const attemptsLeft = game.maxAttempts - game.attempts;
          
          // Determinar qué tan cerca está
          const difference = Math.abs(guess - game.targetNumber);
          let temperature = '';
          let tempColor = '#e74c3c';
          
          if (difference <= 5) {
            temperature = '🔥 **¡CALIENTE!** 🔥';
            tempColor = '#e74c3c';
          } else if (difference <= 15) {
            temperature = '🌡️ **Tibio**';
            tempColor = '#f39c12';
          } else {
            temperature = '❄️ **Frío**';
            tempColor = '#3498db';
          }

          const embed = new EmbedBuilder()
            .setColor(tempColor)
            .setTitle('🔢 Adivina el Número')
            .setDescription(`╔═══════════════════╗\n║                                      ║\n║   ❌ **${guess}** ❌   ║\n║                                      ║\n║   ${hint}   ║\n║   ${temperature}   ║\n║                                      ║\n╚═══════════════════╝`)
            .addFields(
              { name: '🎯 Intentos restantes', value: `**${attemptsLeft}**`, inline: true },
              { name: '💡 Pista', value: hint, inline: true }
            )
            .setFooter({ text: '💭 Sigue intentando... ¡Estás cerca!' });

          await message.reply({ embeds: [embed] });
        }
      }
      break;
    }
  }
});

client.on('interactionCreate', async interaction => {
  // Botón: Crear ticket reclutamiento
  if (interaction.isButton() && interaction.customId === 'crear_reclutamiento') {
    const tickets = loadTickets();
    const userTickets = Object.values(tickets).filter(t => t.userId === interaction.user.id && t.status === 'open');
    
    if (userTickets.length > 0) {
      return interaction.reply({ content: '❌ Ya tienes un ticket abierto.', flags: 64 });
    }

    const modal = new ModalBuilder()
      .setCustomId('modal_reclutamiento')
      .setTitle('Postulación Easy Esports');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('nombre')
          .setLabel('Nombre y Edad')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('activision')
          .setLabel('Activision ID')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('stats')
          .setLabel('Rol y KD')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('disponibilidad')
          .setLabel('Disponibilidad y Torneos')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('presentacion')
          .setLabel('Presentación')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      )
    );

    await interaction.showModal(modal);
  }

  // Modal: Procesar reclutamiento
  if (interaction.isModalSubmit() && interaction.customId === 'modal_reclutamiento') {
    await interaction.deferReply({ flags: 64 }); // 64 = Ephemeral

    const nombre = interaction.fields.getTextInputValue('nombre');
    const activision = interaction.fields.getTextInputValue('activision');
    const stats = interaction.fields.getTextInputValue('stats');
    const disponibilidad = interaction.fields.getTextInputValue('disponibilidad');
    const presentacion = interaction.fields.getTextInputValue('presentacion');

    // Crear permisos para múltiples roles de staff
    const staffRoleIds = getStaffRoles();
    const permissionOverwrites = [
      { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ReadMessageHistory] },
      ...staffRoleIds.map(roleId => ({
        id: roleId,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ReadMessageHistory]
      }))
    ];

    // Crear canal
    const canal = await interaction.guild.channels.create({
      name: `reclutamiento-${interaction.user.username}`,
      type: 0,
      parent: process.env.CATEGORIA_RECLUTAMIENTO,
      permissionOverwrites
    });

    // Guardar ticket
    const tickets = loadTickets();
    tickets[canal.id] = {
      id: canal.id,
      userId: interaction.user.id,
      username: interaction.user.username,
      tipo: 'reclutamiento',
      data: { nombre, activision, stats, disponibilidad, presentacion },
      createdAt: new Date().toISOString(),
      lastUserActivity: Date.now(),
      status: 'open'
    };
    saveTickets(tickets);
    console.log(`✅ Ticket guardado: ${canal.id} | Usuario: ${interaction.user.username}`);

    // Embed con datos del usuario
    const embedDatos = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('📋 Nueva Postulación - Ea$y Esports')
      .setDescription(`**${interaction.user}** ha enviado una solicitud para unirse al equipo.\n━━━━━━━━━━━━━━━━━━━━`)
      .addFields(
        { name: '👤 Nombre y Edad', value: `\`\`\`${nombre}\`\`\``, inline: false },
        { name: '🎮 Activision ID', value: `\`\`\`${activision}\`\`\``, inline: false },
        { name: '📊 Rol y KD', value: `\`\`\`${stats}\`\`\``, inline: false },
        { name: '🕐 Disponibilidad y Torneos', value: `\`\`\`${disponibilidad}\`\`\``, inline: false },
        { name: '📝 Presentación', value: `\`\`\`${presentacion}\`\`\``, inline: false }
      )
      .setFooter({ text: '© Ea$y Esports | Sistema de Reclutamiento' })
      .setTimestamp();

    // Embed pidiendo pruebas
    const embedPruebas = new EmbedBuilder()
      .setColor('#FF6B00')
      .setTitle('📸 Pruebas Obligatorias')
      .setDescription(`**${interaction.user.username}**, para continuar con tu postulación debes enviar las siguientes pruebas:\n`)
      .addFields(
        { 
          name: '🎯 Requisitos:', 
          value: '• Screenshots de tus **estadísticas** (WZRank, K/D, Wins)\n• Clips o **VODs** de tus mejores jugadas\n• Capturas de **torneos ganados** o participaciones\n• **Pruebas de gameplay** que demuestren tu nivel',
          inline: false 
        },
        { 
          name: '⚠️ Importante:', 
          value: '> Las pruebas deben ser **claras y verificables**\n> Puedes subir imágenes directamente o compartir enlaces\n> El Staff revisará tu postulación una vez envíes las pruebas\n> **K/D mínimo requerido: 3.0**\n> ⏰ Tienes **48 horas** para enviar las pruebas o el ticket se cerrará automáticamente',
          inline: false 
        },
        { 
          name: '✅ Siguiente paso:', 
          value: '*Sube tus pruebas en este canal y espera la respuesta del Staff*',
          inline: false 
        }
      )
      .setThumbnail('https://cdn.discordapp.com/attachments/1309783318031503384/1431136085756608644/Fondo_1_3.png')
      .setFooter({ text: 'Recuerda ser honesto y transparente' });

    const botones = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('reclamar_ticket')
        .setLabel('✋ Reclamar')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('cerrar_ticket')
        .setLabel('🔒 Cerrar')
        .setStyle(ButtonStyle.Danger)
    );

    // Mencionar rol específico de reclutamiento
    await canal.send({ content: `<@&1382022718899355688>`, embeds: [embedDatos] });
    await canal.send({ embeds: [embedPruebas], components: [botones] });

    // Log de apertura
    try {
      const canalLogs = await interaction.guild.channels.fetch(CANAL_LOGS);
      const embedLog = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('📋 Nuevo Ticket Abierto')
        .addFields(
          { name: '👤 Usuario:', value: `${interaction.user} (${interaction.user.tag})`, inline: true },
          { name: '📋 Tipo:', value: 'Reclutamiento', inline: true },
          { name: '🔗 Canal:', value: `${canal}`, inline: true },
          { name: '📅 Fecha:', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
        )
        .setThumbnail(interaction.user.displayAvatarURL())
        .setFooter({ text: '© Ea$y Esports | Sistema de Logs' })
        .setTimestamp();
      
      await canalLogs.send({ embeds: [embedLog] });
    } catch (error) {
      console.error('Error al enviar log:', error);
    }

    await interaction.editReply({ content: `✅ Ticket creado: ${canal}` });
  }

  // Botón: Reclamar ticket
  if (interaction.isButton() && interaction.customId === 'reclamar_ticket') {
    // Verificar si es staff
    const staffRoles = getStaffRoles();
    const hasStaffRole = interaction.member.roles.cache.some(role => staffRoles.includes(role.id));

    if (!hasStaffRole && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ 
        content: '❌ Solo el staff puede reclamar tickets.', 
        flags: 64 
      });
    }

    const tickets = loadTickets();
    console.log(`🔍 Intentando reclamar ticket en canal: ${interaction.channel.id}`);
    console.log(`📋 Tickets cargados:`, Object.keys(tickets));
    const ticket = tickets[interaction.channel.id];

    if (!ticket) {
      console.log(`❌ Ticket no encontrado para canal: ${interaction.channel.id}`);
      return interaction.reply({ content: '❌ No es un ticket válido.', flags: 64 });
    }

    if (ticket.reclamadoPor) {
      return interaction.reply({ content: `❌ Este ticket ya fue reclamado por <@${ticket.reclamadoPor}>.`, flags: 64 });
    }

    ticket.reclamadoPor = interaction.user.id;
    saveTickets(tickets);

    const embed = new EmbedBuilder()
      .setColor('#2ecc71')
      .setDescription(`✅ **${interaction.user}** ha reclamado este ticket y se encargará de atenderlo.`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // Botón: Cerrar ticket
  if (interaction.isButton() && interaction.customId === 'cerrar_ticket') {
    // Verificar si es staff
    const staffRoles = getStaffRoles();
    const hasStaffRole = interaction.member.roles.cache.some(role => staffRoles.includes(role.id));

    if (!hasStaffRole && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ 
        content: '❌ Solo el staff puede cerrar tickets.', 
        flags: 64 
      });
    }

    const tickets = loadTickets();
    const ticket = tickets[interaction.channel.id];

    if (!ticket) {
      return interaction.reply({ content: '❌ No es un ticket válido.', flags: 64 });
    }

    await interaction.reply({ content: '✅ Cerrando ticket...', flags: 64 });

    const tipoTicket = ticket.tipo === 'reclutamiento' ? 'Reclutamiento' : 
                       ticket.tipo === 'soporte_tecnico' ? 'Soporte Técnico' :
                       ticket.tipo === 'soporte_reporte' ? 'Reporte de Jugador' :
                       ticket.tipo === 'soporte_apelacion' ? 'Apelación' : 'Consulta General';

    const embed = new EmbedBuilder()
      .setColor('#e74c3c')
      .setTitle('🔒 Ticket Cerrado')
      .setDescription(`Este ticket ha sido cerrado y será eliminado en breve.\n━━━━━━━━━━━━━━━━━━━━`)
      .addFields(
        { name: '👤 Cerrado por:', value: `${interaction.user}`, inline: true },
        { name: '📋 Tipo:', value: tipoTicket, inline: true },
        { name: '⏰ Duración:', value: `<t:${Math.floor(new Date(ticket.createdAt).getTime() / 1000)}:R>`, inline: true }
      )
      .setFooter({ text: '© Ea$y Esports | Gracias por tu tiempo' })
      .setTimestamp();

    await interaction.channel.send({ embeds: [embed] });

    // Log de cierre
    try {
      const canalLogs = await interaction.guild.channels.fetch(CANAL_LOGS);
      const usuario = await interaction.guild.members.fetch(ticket.userId);
      
      const embedLog = new EmbedBuilder()
        .setColor('#e74c3c')
        .setTitle('🔒 Ticket Cerrado')
        .addFields(
          { name: '👤 Usuario:', value: `${usuario.user} (${usuario.user.tag})`, inline: true },
          { name: '📋 Tipo:', value: tipoTicket, inline: true },
          { name: '🔒 Cerrado por:', value: `${interaction.user}`, inline: true },
          { name: '📅 Creado:', value: `<t:${Math.floor(new Date(ticket.createdAt).getTime() / 1000)}:F>`, inline: true },
          { name: '⏰ Duración:', value: `<t:${Math.floor(new Date(ticket.createdAt).getTime() / 1000)}:R>`, inline: true },
          { name: '👨‍💼 Reclamado por:', value: ticket.reclamadoPor ? `<@${ticket.reclamadoPor}>` : 'Nadie', inline: true }
        )
        .setThumbnail(usuario.user.displayAvatarURL())
        .setFooter({ text: '© Ea$y Esports | Sistema de Logs' })
        .setTimestamp();
      
      await canalLogs.send({ embeds: [embedLog] });
    } catch (error) {
      console.error('Error al enviar log de cierre:', error);
    }

    tickets[interaction.channel.id].status = 'closed';
    saveTickets(tickets);

    setTimeout(async () => {
      delete tickets[interaction.channel.id];
      saveTickets(tickets);
      await interaction.channel.delete().catch(() => {});
    }, 5000);
  }

  // Comando: Panel reclutamiento (Solo Admin)
  if (interaction.isChatInputCommand() && interaction.commandName === 'panel-reclutamiento') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Necesitas permisos de administrador para usar este comando.', flags: 64 });
    }

    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('⚔️ Reclutamiento Ea$y')
      .setDescription('¿Quieres unirte a **Ea$y Esports**? Completa tu solicitud y el Staff la revisará.\n\nRecuerda que buscamos jugadores **activos, competitivos y con disciplina**.\n📌 **Formato obligatorio de postulación:**\n\n• 🎮 **Activision ID**\n\n• 🎯 **Rol de juego** (🔵 Ancla / 🔴 IGL / 🟡 Support / 🟢 Fragger)\n\n• 🔫 **KD** / WZRank, Resurgimiento, BattleRoyale.\n\n• ⏰ **Disponibilidad** (días/horas)\n\n• 🏆 **Torneos ganados:** (indica cuántos has participado y ganado, pruebas)\n\n• 🎬 **Pruebas:** clips, VODs o capturas de tus jugadas\n\n• 👤 **Breve presentación personal**\n\n⚠️ **REQUISITOS MÍNIMOS:**\n• K/D mínimo: **3.0**\n• Debes enviar **pruebas** (capturas/clips) en **48 horas** o el ticket se cerrará automáticamente')
      .setImage('https://cdn.discordapp.com/attachments/1309783318031503384/1431136085756608644/Fondo_1_3.png')
      .setFooter({ text: '© Ea$y Esports | Sistema de Reclutamiento' });

    const boton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('crear_reclutamiento')
        .setLabel('📝 Postularme')
        .setStyle(ButtonStyle.Success)
    );

    await interaction.channel.send({ embeds: [embed], components: [boton] });
    await interaction.reply({ content: '✅ Panel creado.', flags: 64 });
  }

  // Comando: Panel soporte (Solo Admin)
  if (interaction.isChatInputCommand() && interaction.commandName === 'panel-soporte') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Necesitas permisos de administrador para usar este comando.', flags: 64 });
    }

    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('⚔️ Reclutamiento Ea$y')
      .setDescription('¿Quieres unirte a **Ea$y Esports**? Completa tu solicitud y el Staff la revisará.\n\nRecuerda que buscamos jugadores **activos, competitivos y con disciplina**.\n📌 **Formato obligatorio de postulación:**\n\n• 🎮 **Activision ID**\n\n• 🎯 **Rol de juego** (🔵 Ancla / 🔴 IGL / 🟡 Support / 🟢 Fragger)\n\n• 🔫 **KD** / WZRank, Resurgimiento, BattleRoyale.\n\n• ⏰ **Disponibilidad** (días/horas)\n\n• 🏆 **Torneos ganados:** (indica cuántos has participado y ganado, pruebas)\n\n• 🎬 **Pruebas:** clips, VODs o capturas de tus jugadas\n\n• 👤 **Breve presentación personal**')
      .setImage('https://cdn.discordapp.com/attachments/1309783318031503384/1431136085756608644/Fondo_1_3.png')
      .setFooter({ text: '© Ea$y Esports | Sistema de Reclutamiento' });

    const boton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('crear_reclutamiento')
        .setLabel('📝 Postularme')
        .setStyle(ButtonStyle.Success)
    );

    await interaction.channel.send({ embeds: [embed], components: [boton] });
    await interaction.reply({ content: '✅ Panel creado.', flags: 64 });
  }

  // Comando: Panel soporte
  if (interaction.isChatInputCommand() && interaction.commandName === 'panel-soporte') {
    const embed = new EmbedBuilder()
      .setColor('#3498db')
      .setTitle('🛠️ Ticket-Soporte')
      .setDescription('¿Necesitas ayuda del Staff? Abre un ticket y te atenderemos lo antes posible.\n\nPor favor, elige la categoría correcta para agilizar tu caso.\n\n• 🧰 **Soporte técnico** – problemas con Discord o bots\n\n• 🚫 **Reporte de jugador** – conductas tóxicas / chetos\n\n• 📜 **Apelaciones** – sanciones o advertencias\n\n• ❓ **Otras consultas** – cualquier tema general\n\n👉 Presiona el botón de abajo para crear tu ticket. Sé claro y adjunta capturas si es necesario.')
      .setImage('https://cdn.discordapp.com/attachments/1309783318031503384/1431136085756608644/Fondo_1_3.png')
      .setFooter({ text: '© Soporte Ea$y Esports' });

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('soporte_tecnico')
        .setLabel('🧰 Soporte Técnico')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('soporte_reporte')
        .setLabel('🚫 Reporte de Jugador')
        .setStyle(ButtonStyle.Danger)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('soporte_apelacion')
        .setLabel('📜 Apelaciones')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('soporte_consulta')
        .setLabel('❓ Otras Consultas')
        .setStyle(ButtonStyle.Success)
    );

    await interaction.channel.send({ embeds: [embed], components: [row1, row2] });
    await interaction.reply({ content: '✅ Panel de soporte creado.', flags: 64 });
  }

  // Botones de soporte
  if (interaction.isButton() && interaction.customId.startsWith('soporte_')) {
    const tickets = loadTickets();
    const userTickets = Object.values(tickets).filter(t => t.userId === interaction.user.id && t.status === 'open');
    
    if (userTickets.length > 0) {
      return interaction.reply({ content: '❌ Ya tienes un ticket abierto.', flags: 64 });
    }

    await interaction.deferReply({ flags: 64 });

    const tipos = {
      'soporte_tecnico': { nombre: 'Soporte Técnico', emoji: '🧰' },
      'soporte_reporte': { nombre: 'Reporte de Jugador', emoji: '🚫' },
      'soporte_apelacion': { nombre: 'Apelación', emoji: '📜' },
      'soporte_consulta': { nombre: 'Consulta General', emoji: '❓' }
    };

    const tipo = tipos[interaction.customId];

    // Crear permisos para múltiples roles de staff
    const staffRoleIds = getStaffRoles();
    const permissionOverwrites = [
      { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ReadMessageHistory] },
      ...staffRoleIds.map(roleId => ({
        id: roleId,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ReadMessageHistory]
      }))
    ];

    // Crear canal
    const canal = await interaction.guild.channels.create({
      name: `${tipo.emoji}-${interaction.user.username}`,
      type: 0,
      parent: '1431157269453869086',
      permissionOverwrites
    });

    // Guardar ticket
    tickets[canal.id] = {
      id: canal.id,
      userId: interaction.user.id,
      username: interaction.user.username,
      tipo: interaction.customId,
      createdAt: new Date().toISOString(),
      lastUserActivity: Date.now(),
      status: 'open'
    };
    saveTickets(tickets);
    console.log(`✅ Ticket de soporte guardado: ${canal.id} | Usuario: ${interaction.user.username} | Tipo: ${interaction.customId}`);

    // Embed del ticket
    const embedTicket = new EmbedBuilder()
      .setColor('#3498db')
      .setTitle(`${tipo.emoji} ${tipo.nombre}`)
      .setDescription(`**${interaction.user}** ha creado un ticket de **${tipo.nombre}**.\n\nPor favor, describe tu problema o consulta de forma clara y detallada.\n\n**El Staff te atenderá pronto.**`)
      .setFooter({ text: '© Soporte Ea$y Esports' })
      .setTimestamp();

    const botonesTicket = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('reclamar_ticket')
        .setLabel('✋ Reclamar')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('cerrar_ticket')
        .setLabel('🔒 Cerrar')
        .setStyle(ButtonStyle.Danger)
    );

    // Mencionar todos los roles de staff
    // Mencionar rol específico de soporte
    await canal.send({ content: `<@&1241211764100698203>`, embeds: [embedTicket], components: [botonesTicket] });

    // Log de apertura
    try {
      const canalLogs = await interaction.guild.channels.fetch(CANAL_LOGS);
      const embedLog = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('📋 Nuevo Ticket Abierto')
        .addFields(
          { name: '👤 Usuario:', value: `${interaction.user} (${interaction.user.tag})`, inline: true },
          { name: '📋 Tipo:', value: tipo.nombre, inline: true },
          { name: '🔗 Canal:', value: `${canal}`, inline: true },
          { name: '📅 Fecha:', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
        )
        .setThumbnail(interaction.user.displayAvatarURL())
        .setFooter({ text: '© Ea$y Esports | Sistema de Logs' })
        .setTimestamp();
      
      await canalLogs.send({ embeds: [embedLog] });
    } catch (error) {
      console.error('Error al enviar log:', error);
    }

    await interaction.editReply({ content: `✅ Ticket creado: ${canal}` });
  }

  // ========== COMANDOS DE ECONOMÍA ==========

  // Comando: Balance
  if (interaction.isChatInputCommand() && interaction.commandName === 'balance') {
    const targetUser = interaction.options.getUser('usuario') || interaction.user;
    const userData = getUser(targetUser.id);

    const embed = new EmbedBuilder()
      .setColor('#f1c40f')
      .setTitle(`💰 Balance de ${targetUser.username}`)
      .setDescription(`**${userData.coins.toLocaleString()}** 🪙 Ea$y Coins`)
      .addFields(
        { name: '🎮 Partidas jugadas', value: `${userData.stats.gamesPlayed}`, inline: true },
        { name: '✅ Victorias', value: `${userData.stats.gamesWon}`, inline: true },
        { name: '❌ Derrotas', value: `${userData.stats.gamesLost}`, inline: true }
      )
      .setThumbnail(targetUser.displayAvatarURL())
      .setFooter({ text: '© Ea$y Esports | Sistema de Economía' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // Comando: Daily
  if (interaction.isChatInputCommand() && interaction.commandName === 'daily') {
    const userData = getUser(interaction.user.id);
    const now = Date.now();
    const cooldown = 24 * 60 * 60 * 1000; // 24 horas

    if (userData.lastDaily && (now - userData.lastDaily) < cooldown) {
      const timeLeft = cooldown - (now - userData.lastDaily);
      const hours = Math.floor(timeLeft / (60 * 60 * 1000));
      const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));

      return interaction.reply({ 
        content: `⏰ Ya reclamaste tu bonus diario. Vuelve en **${hours}h ${minutes}m**`,
        flags: 64 
      });
    }

    userData.coins += 100;
    userData.lastDaily = now;
    updateUser(interaction.user.id, userData);

    const embed = new EmbedBuilder()
      .setColor('#2ecc71')
      .setTitle('🎁 Bonus Diario Reclamado')
      .setDescription(`Has recibido **100** 🪙\n\nNuevo balance: **${userData.coins.toLocaleString()}** 🪙`)
      .setFooter({ text: 'Vuelve mañana por más!' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // Comando: Leaderboard
  if (interaction.isChatInputCommand() && interaction.commandName === 'leaderboard') {
    const economy = loadEconomy();
    const sorted = Object.entries(economy)
      .sort(([, a], [, b]) => b.coins - a.coins)
      .slice(0, 10);

    let description = '';
    for (let i = 0; i < sorted.length; i++) {
      const [userId, data] = sorted[i];
      const user = await interaction.guild.members.fetch(userId).catch(() => null);
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      description += `${medal} **${user ? user.user.username : 'Usuario Desconocido'}** - ${data.coins.toLocaleString()} 🪙\n`;
    }

    const embed = new EmbedBuilder()
      .setColor('#f39c12')
      .setTitle('🏆 Top 10 - Más Ricos')
      .setDescription(description || 'No hay datos aún')
      .setFooter({ text: '© Ea$y Esports | Leaderboard' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // Comando: Give
  if (interaction.isChatInputCommand() && interaction.commandName === 'give') {
    const targetUser = interaction.options.getUser('usuario');
    const amount = interaction.options.getInteger('cantidad');

    if (targetUser.id === interaction.user.id) {
      return interaction.reply({ content: '❌ No puedes regalarte monedas a ti mismo.', flags: 64 });
    }

    if (targetUser.bot) {
      return interaction.reply({ content: '❌ No puedes regalar monedas a un bot.', flags: 64 });
    }

    if (amount <= 0) {
      return interaction.reply({ content: '❌ La cantidad debe ser mayor a 0.', flags: 64 });
    }

    const senderData = getUser(interaction.user.id);
    
    // Comisión del 5% en transferencias
    const commission = Math.floor(amount * 0.05);
    const totalCost = amount + commission;

    if (senderData.coins < totalCost) {
      return interaction.reply({ 
        content: `❌ No tienes suficientes monedas.\n💰 Necesitas: **${totalCost.toLocaleString()}** 🪙 (${amount.toLocaleString()} + ${commission.toLocaleString()} comisión)\n💰 Tienes: **${senderData.coins.toLocaleString()}** 🪙`, 
        flags: 64 
      });
    }

    senderData.coins -= totalCost;
    updateUser(interaction.user.id, senderData);

    const receiverData = getUser(targetUser.id);
    receiverData.coins += amount;
    updateUser(targetUser.id, receiverData);

    const embed = new EmbedBuilder()
      .setColor('#3498db')
      .setTitle('💸 Transferencia Exitosa')
      .setDescription(`**${interaction.user.username}** ha enviado **${amount.toLocaleString()}** 🪙 a **${targetUser.username}**`)
      .addFields(
        { name: '💰 Monto enviado', value: `${amount.toLocaleString()} 🪙`, inline: true },
        { name: '📊 Comisión (5%)', value: `${commission.toLocaleString()} 🪙`, inline: true },
        { name: '💵 Total cobrado', value: `${totalCost.toLocaleString()} 🪙`, inline: true },
        { name: 'Tu nuevo balance', value: `${senderData.coins.toLocaleString()} 🪙`, inline: true },
        { name: 'Balance de ' + targetUser.username, value: `${receiverData.coins.toLocaleString()} 🪙`, inline: true }
      )
      .setFooter({ text: '💡 Tip: Las transferencias tienen una comisión del 5%' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // Comando: Reset Economy (Solo Admin) - Reinicia todas las monedas
  if (interaction.isChatInputCommand() && interaction.commandName === 'reset-economy') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Necesitas permisos de administrador para usar este comando.', flags: 64 });
    }

    const resetValue = interaction.options.getInteger('valor') || 0;

    // Crear botones de confirmación
    const confirmButton = new ButtonBuilder()
      .setCustomId('confirm_reset_economy')
      .setLabel('✅ Confirmar Reset')
      .setStyle(ButtonStyle.Danger);

    const cancelButton = new ButtonBuilder()
      .setCustomId('cancel_reset_economy')
      .setLabel('❌ Cancelar')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

    const economy = loadEconomy();
    const userCount = Object.keys(economy).length;

    const embed = new EmbedBuilder()
      .setColor('#e74c3c')
      .setTitle('⚠️ CONFIRMACIÓN DE RESET ECONÓMICO')
      .setDescription(`¿Estás seguro de que quieres resetear las monedas de **${userCount}** usuarios?\n\n**Valor de reset:** ${resetValue.toLocaleString()} 🪙\n\n⚠️ **Esta acción es IRREVERSIBLE**\nTodos los usuarios tendrán sus monedas establecidas en ${resetValue.toLocaleString()} 🪙`)
      .setFooter({ text: 'Esta confirmación expira en 30 segundos' })
      .setTimestamp();

    const response = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

    // Collector para los botones
    const collector = response.createMessageComponentCollector({ time: 30000 });

    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({ content: '❌ Solo el administrador que ejecutó el comando puede confirmar.', flags: 64 });
      }

      if (i.customId === 'confirm_reset_economy') {
        const economy = loadEconomy();
        let resetCount = 0;

        // Resetear coins de todos los usuarios
        for (const userId in economy) {
          economy[userId].coins = resetValue;
          resetCount++;
        }

        saveEconomy(economy);

        const successEmbed = new EmbedBuilder()
          .setColor('#2ecc71')
          .setTitle('✅ Reset Económico Completado')
          .setDescription(`Se han reseteado las monedas de **${resetCount}** usuarios a **${resetValue.toLocaleString()}** 🪙`)
          .addFields(
            { name: '👤 Ejecutado por', value: interaction.user.username, inline: true },
            { name: '📊 Usuarios afectados', value: resetCount.toString(), inline: true },
            { name: '💰 Nuevo valor', value: `${resetValue.toLocaleString()} 🪙`, inline: true }
          )
          .setFooter({ text: '© Ea$y Esports | Sistema Económico' })
          .setTimestamp();

        await i.update({ embeds: [successEmbed], components: [] });
        collector.stop();
      } else if (i.customId === 'cancel_reset_economy') {
        const cancelEmbed = new EmbedBuilder()
          .setColor('#95a5a6')
          .setTitle('❌ Reset Cancelado')
          .setDescription('La operación de reset económico ha sido cancelada. No se realizaron cambios.')
          .setTimestamp();

        await i.update({ embeds: [cancelEmbed], components: [] });
        collector.stop();
      }
    });

    collector.on('end', collected => {
      if (collected.size === 0) {
        const timeoutEmbed = new EmbedBuilder()
          .setColor('#95a5a6')
          .setTitle('⏱️ Tiempo Agotado')
          .setDescription('La confirmación de reset económico ha expirado. No se realizaron cambios.')
          .setTimestamp();

        interaction.editReply({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
      }
    });
  }

  // WORK - Trabajar para ganar monedas
  // ========== SISTEMA DE TRABAJO COMPLETO ==========
  if (interaction.isChatInputCommand() && interaction.commandName === 'work') {
    const userData = getUser(interaction.user.id);
    const now = Date.now();

    // Verificar cooldown
    if (userData.lastWork && (now - userData.lastWork) < 7200000) { // 2 horas mínimo
      const timeLeft = Math.ceil((7200000 - (now - userData.lastWork)) / 60000);
      const hours = Math.floor(timeLeft / 60);
      const mins = timeLeft % 60;
      return interaction.reply({ 
        content: `⏰ Ya has trabajado recientemente. Próximo trabajo disponible en **${hours}h ${mins}m**`, 
        flags: 64 
      });
    }

    // Calcular racha de trabajo
    const lastDate = userData.lastWorkDate ? new Date(userData.lastWorkDate).toDateString() : null;
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    
    if (lastDate === yesterday) {
      userData.workStreak += 1;
    } else if (lastDate !== today) {
      userData.workStreak = 1;
    }

    // Obtener trabajos disponibles
    const availableJobs = getJobsData(userData.workLevel);
    const xpNeeded = getXPForLevel(userData.workLevel);
    const xpProgress = Math.floor((userData.workXP / xpNeeded) * 100);

    // Crear menú de selección de trabajo
    const jobOptions = availableJobs.map(job => ({
      label: `${job.emoji} ${job.name}${job.unlockLevel > 1 ? ` (Nivel ${job.unlockLevel})` : ''}`,
      description: `Nivel requerido: ${job.unlockLevel}`,
      value: job.id
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`work_select_${interaction.user.id}`)
      .setPlaceholder('Selecciona tu trabajo')
      .addOptions(jobOptions);

    const embed = new EmbedBuilder()
      .setColor('#3498db')
      .setTitle('💼 Sistema de Trabajo')
      .setDescription(`**${interaction.user.username}**, elige tu trabajo para hoy`)
      .addFields(
        { name: '📊 Tu Nivel', value: `Nivel ${userData.workLevel} (${userData.workXP}/${xpNeeded} XP - ${xpProgress}%)`, inline: true },
        { name: '🔥 Racha', value: `${userData.workStreak} días consecutivos`, inline: true },
        { name: '💰 Balance', value: `${userData.coins.toLocaleString()} 🪙`, inline: true },
        { name: '📝 Cómo funciona', value: '1. Elige trabajo\n2. Selecciona turno (2h/4h/8h)\n3. Completa mini-juego\n4. Elige calidad\n5. Recibe pago + XP', inline: false }
      )
      .setFooter({ text: '💡 Trabajos premium se desbloquean al subir de nivel' });

    await interaction.reply({ 
      embeds: [embed], 
      components: [new ActionRowBuilder().addComponents(selectMenu)]
    });
  }

  // Selección de trabajo
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('work_select_')) {
    const userId = interaction.customId.split('_')[2];
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ Este menú no es para ti.', flags: 64 });
    }

    const jobId = interaction.values[0];
    const userData = getUser(interaction.user.id);
    const jobsData = getJobsData(userData.workLevel);
    const selectedJob = jobsData.find(j => j.id === jobId);

    // Crear botones de turno
    const shiftButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`work_shift_${userId}_${jobId}_2h`)
        .setLabel('🕐 Turno 2h')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`work_shift_${userId}_${jobId}_4h`)
        .setLabel('🕓 Turno 4h')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`work_shift_${userId}_${jobId}_8h`)
        .setLabel('🕗 Turno 8h')
        .setStyle(ButtonStyle.Success)
    );

    const pay2h = calculatePay(80, 150, userData.workLevel, '2h');
    const pay4h = calculatePay(80, 150, userData.workLevel, '4h');
    const pay8h = calculatePay(80, 150, userData.workLevel, '8h');

    const embed = new EmbedBuilder()
      .setColor('#f39c12')
      .setTitle(`${selectedJob.emoji} ${selectedJob.name}`)
      .setDescription(`Selecciona la duración de tu turno:`)
      .addFields(
        { name: '� Turno 2 horas', value: `💰 ${pay2h.min}-${pay2h.max} 🪙 + 10 XP\n⏰ Cooldown: 2 horas`, inline: true },
        { name: '🕓 Turno 4 horas', value: `💰 ${pay4h.min}-${pay4h.max} 🪙 + 25 XP\n⏰ Cooldown: 4 horas`, inline: true },
        { name: '🕗 Turno 8 horas', value: `💰 ${pay8h.min}-${pay8h.max} 🪙 + 50 XP\n⏰ Cooldown: 8 horas`, inline: true }
      )
      .setFooter({ text: 'Turnos más largos = más pago pero mayor cooldown' });

    await interaction.update({ embeds: [embed], components: [shiftButtons] });
  }

  // Selección de turno -> Mini-juego
  if (interaction.isButton() && interaction.customId.startsWith('work_shift_')) {
    const [, , userId, jobId, shift] = interaction.customId.split('_');
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ Este botón no es para ti.', flags: 64 });
    }

    const userData = getUser(interaction.user.id);
    const jobsData = getJobsData(userData.workLevel);
    const job = jobsData.find(j => j.id === jobId);
    
    // Seleccionar pregunta aleatoria
    const question = job.questions[Math.floor(Math.random() * job.questions.length)];
    
    // Crear botones de respuestas
    const answerButtons = new ActionRowBuilder().addComponents(
      ...question.a.map((answer, idx) => 
        new ButtonBuilder()
          .setCustomId(`work_answer_${userId}_${jobId}_${shift}_${idx}_${question.correct}`)
          .setLabel(answer)
          .setStyle(ButtonStyle.Secondary)
      )
    );

    const embed = new EmbedBuilder()
      .setColor('#9b59b6')
      .setTitle(`${job.emoji} ${job.name} - Pregunta`)
      .setDescription(question.q)
      .setFooter({ text: 'Responde correctamente para maximizar tu pago' });

    await interaction.update({ embeds: [embed], components: [answerButtons] });
  }

  // Respuesta del mini-juego -> Tareas
  if (interaction.isButton() && interaction.customId.startsWith('work_answer_')) {
    const [, , userId, jobId, shift, selectedAnswer, correctAnswer] = interaction.customId.split('_');
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ Este botón no es para ti.', flags: 64 });
    }

    const isCorrect = parseInt(selectedAnswer) === parseInt(correctAnswer);
    const userData = getUser(interaction.user.id);
    const jobsData = getJobsData(userData.workLevel);
    const job = jobsData.find(j => j.id === jobId);

    // Crear tareas progresivas
    const taskButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`work_task1_${userId}_${jobId}_${shift}_${isCorrect ? 1 : 0}_0`)
        .setLabel('� Tarea 1/3')
        .setStyle(ButtonStyle.Primary)
    );

    const embed = new EmbedBuilder()
      .setColor(isCorrect ? '#2ecc71' : '#e67e22')
      .setTitle(`${job.emoji} ${job.name} - ${isCorrect ? '✅ ¡Correcto!' : '⚠️ Respuesta incorrecta'}`)
      .setDescription(isCorrect 
        ? '¡Excelente! Ahora completa tus tareas del turno.'
        : 'No pasa nada, aún recibirás un pago base. Completa tus tareas.')
      .addFields(
        { name: '📝 Progreso', value: '⏳ Iniciar primera tarea\n🔒 Tarea 2 (Bloqueada)\n🔒 Tarea 3 (Bloqueada)', inline: false }
      );

    await interaction.update({ embeds: [embed], components: [taskButtons] });
  }

  // Tareas progresivas - Mostrar pregunta de cada tarea
  if (interaction.isButton() && interaction.customId.startsWith('work_task') && !interaction.customId.includes('taskanswer')) {
    const parts = interaction.customId.split('_');
    // parts = ['work', 'task1', userId, jobId, shift, correctBonus, tasksCompleted]
    const taskNum = parseInt(parts[1].replace('task', ''));
    const [, , userId, jobId, shift, correctBonus, tasksCompleted] = parts;
    
    console.log(`🔍 Tarea presionada: ${interaction.customId}`);
    console.log(`📋 TaskNum: ${taskNum}, JobId: ${jobId}, Parts:`, parts);
    
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ Este botón no es para ti.', flags: 64 });
    }

    const userData = getUser(interaction.user.id);
    const jobsData = getJobsData(userData.workLevel);
    const job = jobsData.find(j => j.id === jobId);
    const newTasksCompleted = parseInt(tasksCompleted) + 1;

    // Descripciones específicas por tarea
    const taskDescs = {
      programmer: ['💻 Revisar código del proyecto', '🔧 Arreglar bugs críticos', '🚀 Hacer deploy a producción'],
      chef: ['🥘 Preparar ingredientes', '🍳 Cocinar el plato', '🍽️ Emplatar y decorar'],
      driver: ['🚗 Revisar el vehículo', '🗺️ Planificar la ruta', '🏁 Completar el viaje'],
      teacher: ['📚 Preparar la clase', '👨‍🏫 Enseñar a estudiantes', '📝 Calificar trabajos'],
      doctor: ['🩺 Revisar pacientes', '💊 Recetar tratamientos', '📋 Actualizar historiales'],
      streamer: ['🎥 Configurar stream', '🎮 Entretener viewers', '💬 Agradecer subs'],
      ceo: ['📊 Revisar reportes', '👥 Reunión ejecutivos', '📈 Planificar crecimiento'],
      athlete: ['🏃 Calentamiento', '⚽ Entrenamiento', '💪 Recuperación'],
      actor: ['📖 Estudiar guión', '🎭 Grabar escenas', '🎬 Revisar tomas']
    };
      
    const taskDesc = taskDescs[jobId] ? taskDescs[jobId][taskNum - 1] : `Tarea ${taskNum}`;

    // Preguntas para cada tarea
    const taskQuestions = {
      programmer: [
        { q: '💻 ¿Qué herramienta usas para versionar código?', a: ['Git', 'Photoshop', 'Excel'], correct: 0 },
        { q: '🔧 ¿Cómo debugueas efectivamente?', a: ['Console.log y breakpoints', 'Ignorar errores', 'Reiniciar'], correct: 0 },
        { q: '🚀 ¿Qué comando despliega cambios?', a: ['git push', 'git delete', 'git stop'], correct: 0 }
      ],
      chef: [
        { q: '🥘 ¿Con qué cortas verduras?', a: ['Cuchillo afilado', 'Tenedor', 'Cuchara'], correct: 0 },
        { q: '🍳 ¿Temperatura para cocinar carne?', a: ['Medio-alto', 'Frío', 'Sin calor'], correct: 0 },
        { q: '🍽️ ¿Qué va primero en el plato?', a: ['Plato principal', 'Postre', 'Bebida'], correct: 0 }
      ],
      driver: [
        { q: '🚗 ¿Presión correcta de llantas?', a: ['30-35 PSI', '100 PSI', '5 PSI'], correct: 0 },
        { q: '🗺️ ¿Mejor app para navegar?', a: ['Google Maps', 'Instagram', 'TikTok'], correct: 0 },
        { q: '🏁 ¿Cómo asegurar la carga?', a: ['Con correas', 'Sin amarrar', 'Con cinta'], correct: 0 }
      ],
      teacher: [
        { q: '📚 ¿Cómo hacer clase interesante?', a: ['Con ejemplos prácticos', 'Solo leyendo', 'Callado'], correct: 0 },
        { q: '👨‍🏫 ¿Qué hacer si no entienden?', a: ['Explicar diferente', 'Ignorar', 'Regañar'], correct: 0 },
        { q: '📝 ¿Cómo calificar justamente?', a: ['Con rúbrica', 'Al azar', 'Todos 10'], correct: 0 }
      ],
      doctor: [
        { q: '🩺 ¿Qué revisar primero?', a: ['Signos vitales', 'Zapatos', 'Teléfono'], correct: 0 },
        { q: '💊 ¿Cuándo dar antibióticos?', a: ['Infección bacterial', 'Siempre', 'Nunca'], correct: 0 },
        { q: '📋 ¿Por qué documentar?', a: ['Seguimiento médico', 'Perder tiempo', 'Por gusto'], correct: 0 }
      ],
      streamer: [
        { q: '🎥 ¿Mejor calidad de video?', a: ['1080p o superior', '240p', '10p'], correct: 0 },
        { q: '🎮 ¿Cómo mantener viewers?', a: ['Interactuando', 'Ignorando', 'Callado'], correct: 0 },
        { q: '💬 ¿Qué decir al recibir sub?', a: ['Gracias con emoción', 'Nada', 'Quejarte'], correct: 0 }
      ],
      ceo: [
        { q: '📊 ¿Indicador más importante?', a: ['Rentabilidad', 'Color oficina', 'Café'], correct: 0 },
        { q: '👥 ¿Cómo decidir bien?', a: ['Con datos', 'Al azar', 'Emoción'], correct: 0 },
        { q: '📈 ¿Qué buscar al crecer?', a: ['Sostenibilidad', 'Gastar', 'Nada'], correct: 0 }
      ],
      athlete: [
        { q: '🏃 ¿Por qué calentar?', a: ['Evitar lesiones', 'Perder tiempo', 'Moda'], correct: 0 },
        { q: '⚽ ¿Qué comer antes?', a: ['Carbohidratos', 'Comida pesada', 'Nada'], correct: 0 },
        { q: '💪 ¿Qué hacer después?', a: ['Estirar', 'Sentarte', 'Dormir'], correct: 0 }
      ],
      actor: [
        { q: '📖 ¿Cómo memorizar líneas?', a: ['Repetir en voz alta', 'No leer', 'Olvidar'], correct: 0 },
        { q: '🎭 ¿Qué hacer en escena emotiva?', a: ['Conectar con personaje', 'Reír', 'Salir'], correct: 0 },
        { q: '🎬 ¿Cómo mejorar?', a: ['Viendo tomas', 'Sin revisar', 'Ignorando'], correct: 0 }
      ]
    };

    const taskQ = taskQuestions[jobId] ? taskQuestions[jobId][taskNum - 1] : null;
    
    console.log(`❓ Pregunta encontrada:`, taskQ);

    // Mostrar pregunta de esta tarea
    if (taskQ) {
      // Usar SelectMenu para mejor compatibilidad móvil
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`work_taskanswer_${userId}_${jobId}_${shift}_${correctBonus}_${tasksCompleted}_${taskNum}_${taskQ.correct}`)
        .setPlaceholder('Selecciona tu respuesta')
        .addOptions(
          taskQ.a.map((answer, idx) => ({
            label: answer,
            value: `${idx}`
          }))
        );

      const row = new ActionRowBuilder().addComponents(selectMenu);

      const embed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setTitle(`${job.emoji} ${job.name} - ${taskDesc}`)
        .setDescription(taskQ.q)
        .setFooter({ text: `Tarea ${taskNum}/3 | Responde para continuar` });

      return await interaction.update({ embeds: [embed], components: [row] });
    }

    if (newTasksCompleted < 3) {
      // Más tareas pendientes
      const nextTask = taskNum + 1;
      const taskButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`work_task${nextTask}_${userId}_${jobId}_${shift}_${correctBonus}_${newTasksCompleted}`)
          .setLabel(`📋 Continuar - Tarea ${nextTask}/3`)
          .setStyle(ButtonStyle.Primary)
      );

      const progressText = [
        newTasksCompleted >= 1 ? '✅ Tarea 1 completada' : '⏳ Tarea 1',
        newTasksCompleted >= 2 ? '✅ Tarea 2 completada' : newTasksCompleted === 1 ? '⏳ Iniciar tarea 2' : '🔒 Tarea 2 (Bloqueada)',
        newTasksCompleted >= 3 ? '✅ Tarea 3 completada' : '🔒 Tarea 3 (Bloqueada)'
      ].join('\n');

      const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle(`${job.emoji} ${job.name} - ✅ ${taskDesc}`)
        .setDescription(`**Completado:** ${taskDesc}\n\n¡Excelente! Continúa con la siguiente tarea.`)
        .addFields({ name: '� Progreso', value: progressText, inline: false });

      await interaction.update({ embeds: [embed], components: [taskButtons] });
    } else {
      // Todas las tareas completadas -> Elegir calidad
      const qualityButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`work_quality_${userId}_${jobId}_${shift}_${correctBonus}_fast`)
          .setLabel('⚡ Trabajo Rápido')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`work_quality_${userId}_${jobId}_${shift}_${correctBonus}_perfect`)
          .setLabel('⭐ Trabajo Perfecto')
          .setStyle(ButtonStyle.Success)
      );

      const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle(`${job.emoji} ${job.name} - ✅ Todas las Tareas Completadas`)
        .setDescription('¡Excelente trabajo! Ahora elige la calidad:')
        .addFields(
          { name: '⚡ Trabajo Rápido', value: '• 90% del pago\n• Cooldown reducido (-30 min)\n• +10 XP bonus', inline: true },
          { name: '⭐ Trabajo Perfecto', value: '• 120% del pago\n• Cooldown normal\n• +25 XP bonus', inline: true }
        )
        .setFooter({ text: 'Elige según tu estrategia' });

      await interaction.update({ embeds: [embed], components: [qualityButtons] });
    }
  }

  // Respuesta de pregunta de tarea
  // Handler para respuestas de tareas (SelectMenu)
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('work_taskanswer_')) {
    const [, , userId, jobId, shift, correctBonus, tasksCompleted, taskNum, correctAnswer] = interaction.customId.split('_');
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ Este menú no es para ti.', flags: 64 });
    }

    const selectedAnswer = interaction.values[0]; // Valor seleccionado del menú

    const userData = getUser(interaction.user.id);
    const jobsData = getJobsData(userData.workLevel);
    const job = jobsData.find(j => j.id === jobId);
    const newTasksCompleted = parseInt(tasksCompleted) + 1;
    const isCorrect = parseInt(selectedAnswer) === parseInt(correctAnswer);
    const newCorrectBonus = parseInt(correctBonus) + (isCorrect ? 1 : 0);

    if (newTasksCompleted < 3) {
      // Más tareas pendientes
      const nextTask = parseInt(taskNum) + 1;
      const taskButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`work_task${nextTask}_${userId}_${jobId}_${shift}_${newCorrectBonus}_${newTasksCompleted}`)
          .setLabel(`📋 Siguiente - Tarea ${nextTask}/3`)
          .setStyle(ButtonStyle.Primary)
      );

      const progressText = [
        newTasksCompleted >= 1 ? '✅ Tarea 1 completada' : '⏳ Tarea 1',
        newTasksCompleted >= 2 ? '✅ Tarea 2 completada' : newTasksCompleted === 1 ? '⏳ Iniciar tarea 2' : '🔒 Tarea 2 (Bloqueada)',
        newTasksCompleted >= 3 ? '✅ Tarea 3 completada' : '🔒 Tarea 3 (Bloqueada)'
      ].join('\n');

      const embed = new EmbedBuilder()
        .setColor(isCorrect ? '#2ecc71' : '#f39c12')
        .setTitle(`${job.emoji} ${job.name} - ${isCorrect ? '✅ ¡Correcto!' : '⚠️ Incorrecto'}`)
        .setDescription(isCorrect 
          ? `¡Excelente! Tarea ${taskNum} completada correctamente. Bonus acumulado.`
          : `Tarea ${taskNum} completada. La respuesta no fue correcta, pero sigues avanzando.`)
        .addFields({ name: '📝 Progreso', value: progressText, inline: false })
        .setFooter({ text: `Respuestas correctas: ${newCorrectBonus}/4 | Más respuestas = más pago` });

      await interaction.update({ embeds: [embed], components: [taskButtons] });
    } else {
      // Todas las tareas completadas -> Elegir calidad
      const qualityButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`work_quality_${userId}_${jobId}_${shift}_${newCorrectBonus}_fast`)
          .setLabel('⚡ Trabajo Rápido')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`work_quality_${userId}_${jobId}_${shift}_${newCorrectBonus}_perfect`)
          .setLabel('⭐ Trabajo Perfecto')
          .setStyle(ButtonStyle.Primary)
      );

      const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle(`${job.emoji} ${job.name} - ✅ ¡Turno Completado!`)
        .setDescription('¡Excelente trabajo! Ahora elige la calidad:')
        .addFields(
          { name: '⚡ Trabajo Rápido', value: '• 90% del pago\n• Cooldown reducido (-30 min)\n• +10 XP bonus', inline: true },
          { name: '⭐ Trabajo Perfecto', value: '• 120% del pago\n• Cooldown normal\n• +25 XP bonus', inline: true }
        )
        .setFooter({ text: `Respuestas correctas: ${newCorrectBonus}/4 | ¡Excelente desempeño!` });

      await interaction.update({ embeds: [embed], components: [qualityButtons] });
    }
    return;
  }

  // Handler antiguo de botones (por compatibilidad)
  if (interaction.isButton() && interaction.customId.startsWith('work_taskanswer_')) {
    const [, , userId, jobId, shift, correctBonus, tasksCompleted, taskNum, selectedAnswer, correctAnswer] = interaction.customId.split('_');
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ Este botón no es para ti.', flags: 64 });
    }

    const userData = getUser(interaction.user.id);
    const jobsData = getJobsData(userData.workLevel);
    const job = jobsData.find(j => j.id === jobId);
    const newTasksCompleted = parseInt(tasksCompleted) + 1;
    const isCorrect = parseInt(selectedAnswer) === parseInt(correctAnswer);
    const newCorrectBonus = parseInt(correctBonus) + (isCorrect ? 1 : 0);

    if (newTasksCompleted < 3) {
      // Más tareas pendientes
      const nextTask = parseInt(taskNum) + 1;
      const taskButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`work_task${nextTask}_${userId}_${jobId}_${shift}_${newCorrectBonus}_${newTasksCompleted}`)
          .setLabel(`📋 Siguiente - Tarea ${nextTask}/3`)
          .setStyle(ButtonStyle.Primary)
      );

      const progressText = [
        newTasksCompleted >= 1 ? '✅ Tarea 1 completada' : '⏳ Tarea 1',
        newTasksCompleted >= 2 ? '✅ Tarea 2 completada' : newTasksCompleted === 1 ? '⏳ Iniciar tarea 2' : '🔒 Tarea 2 (Bloqueada)',
        newTasksCompleted >= 3 ? '✅ Tarea 3 completada' : '🔒 Tarea 3 (Bloqueada)'
      ].join('\n');

      const embed = new EmbedBuilder()
        .setColor(isCorrect ? '#2ecc71' : '#f39c12')
        .setTitle(`${job.emoji} ${job.name} - ${isCorrect ? '✅ ¡Correcto!' : '⚠️ Incorrecto'}`)
        .setDescription(isCorrect 
          ? `¡Excelente! Tarea ${taskNum} completada correctamente. Bonus acumulado.`
          : `Tarea ${taskNum} completada. La respuesta no fue correcta, pero sigues avanzando.`)
        .addFields({ name: '📝 Progreso', value: progressText, inline: false })
        .setFooter({ text: `Respuestas correctas: ${newCorrectBonus}/4 | Más respuestas = más pago` });

      await interaction.update({ embeds: [embed], components: [taskButtons] });
    } else {
      // Todas las tareas completadas -> Elegir calidad
      const qualityButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`work_quality_${userId}_${jobId}_${shift}_${newCorrectBonus}_fast`)
          .setLabel('⚡ Trabajo Rápido')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`work_quality_${userId}_${jobId}_${shift}_${newCorrectBonus}_perfect`)
          .setLabel('⭐ Trabajo Perfecto')
          .setStyle(ButtonStyle.Success)
      );

      const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle(`${job.emoji} ${job.name} - ✅ Todas las Tareas Completadas`)
        .setDescription(`¡Excelente trabajo! Completaste las 3 tareas.\n\n**Respuestas correctas:** ${newCorrectBonus}/4\n\nAhora elige la calidad de tu trabajo:`)
        .addFields(
          { name: '⚡ Trabajo Rápido', value: '• 90% del pago\n• Cooldown -30 min\n• +10 XP bonus', inline: true },
          { name: '⭐ Trabajo Perfecto', value: '• 120% del pago\n• Cooldown normal\n• +25 XP bonus', inline: true }
        )
        .setFooter({ text: 'Elige según tu estrategia' });

      await interaction.update({ embeds: [embed], components: [qualityButtons] });
    }
  }

  // Elección de calidad -> Pago final
  if (interaction.isButton() && interaction.customId.startsWith('work_quality_')) {
    const [, , userId, jobId, shift, correctBonus, quality] = interaction.customId.split('_');
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ Este botón no es para ti.', flags: 64 });
    }

    const userData = getUser(interaction.user.id);
    const jobsData = getJobsData(userData.workLevel);
    const job = jobsData.find(j => j.id === jobId);
    
    // Calcular pago
    const basePay = calculatePay(80, 150, userData.workLevel, shift);
    const randomPay = Math.floor(Math.random() * (basePay.max - basePay.min + 1)) + basePay.min;
    
    const qualityMultiplier = quality === 'fast' ? 0.9 : 1.2;
    // Multiplicador por respuestas correctas: 0/4=1x, 1/4=1.05x, 2/4=1.10x, 3/4=1.15x, 4/4=1.25x
    const correctCount = parseInt(correctBonus);
    const correctMultiplier = 1 + (correctCount * 0.05) + (correctCount === 4 ? 0.05 : 0);
    const streakMultiplier = userData.workStreak >= 7 ? 1.25 : userData.workStreak >= 3 ? 1.10 : 1;
    
    const finalPay = Math.floor(randomPay * qualityMultiplier * correctMultiplier * streakMultiplier);
    
    // Calcular XP
    const baseXP = { '2h': 10, '4h': 25, '8h': 50 }[shift];
    const qualityXP = quality === 'fast' ? 10 : 25;
    const totalXP = baseXP + qualityXP;
    
    // Calcular cooldown
    const baseCooldown = { '2h': 2, '4h': 4, '8h': 8 }[shift];
    const cooldownHours = quality === 'fast' ? baseCooldown - 0.5 : baseCooldown;
    const cooldownMs = cooldownHours * 3600000;
    
    // Actualizar usuario
    userData.coins += finalPay;
    userData.workXP += totalXP;
    userData.lastWork = Date.now();
    userData.lastWorkDate = new Date().toISOString();
    
    // Verificar nivel
    const xpNeeded = getXPForLevel(userData.workLevel);
    let leveledUp = false;
    if (userData.workXP >= xpNeeded) {
      userData.workLevel += 1;
      userData.workXP = 0;
      leveledUp = true;
    }
    
    updateUser(interaction.user.id, userData);

    // Embed de resultado
    const embed = new EmbedBuilder()
      .setColor('#f1c40f')
      .setTitle(`${job.emoji} ${job.name} - 🎉 ¡Turno Completado!`)
      .setDescription(leveledUp ? `🎊 **¡SUBISTE DE NIVEL!** Ahora eres Nivel ${userData.workLevel}` : `¡Excelente trabajo ${interaction.user.username}!`)
      .addFields(
        { name: '💰 Ganancia Total', value: `${finalPay.toLocaleString()} 🪙`, inline: true },
        { name: '⭐ XP Ganado', value: `+${totalXP} XP`, inline: true },
        { name: '� Nuevo Balance', value: `${userData.coins.toLocaleString()} 🪙`, inline: true },
        { name: '📊 Desglose', value: `Pago base: ${randomPay}🪙\n${quality === 'perfect' ? 'Calidad perfecta +20%' : 'Trabajo rápido -10%'}\nRespuestas correctas (${correctCount}/4): +${Math.floor((correctMultiplier - 1) * 100)}%\n${streakMultiplier > 1 ? `Racha ${userData.workStreak} días: +${Math.floor((streakMultiplier - 1) * 100)}%` : ''}`, inline: false },
        { name: '⏰ Próximo trabajo', value: `En ${cooldownHours} horas`, inline: true },
        { name: '📈 Progreso', value: `Nivel ${userData.workLevel} (${userData.workXP}/${getXPForLevel(userData.workLevel)} XP)`, inline: true }
      )
      .setFooter({ text: `� Racha: ${userData.workStreak} días | Trabaja diario para mantenerla` })
      .setTimestamp();

    await interaction.update({ embeds: [embed], components: [] });
  }

  // BANK - Sistema bancario
  if (interaction.isChatInputCommand() && interaction.commandName === 'bank') {
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

  // LOAN - Sistema de préstamos
  if (interaction.isChatInputCommand() && interaction.commandName === 'loan') {
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

  // DAILY-QUEST - Misiones diarias
  if (interaction.isChatInputCommand() && interaction.commandName === 'daily-quest') {
    const userData = getUser(interaction.user.id);
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);

    // Generar nuevas misiones si es necesario
    if (!userData.quests || userData.quests.length === 0 || !userData.lastQuestReset || userData.lastQuestReset < oneDayAgo) {
      userData.quests = generateDailyQuests();
      userData.lastQuestReset = now;
      updateUser(interaction.user.id, userData);
    }

    const embed = new EmbedBuilder()
      .setColor('#9b59b6')
      .setTitle('📋 Misiones Diarias')
      .setDescription('Completa misiones para ganar recompensas extra!')
      .setFooter({ text: '💡 Las misiones se renuevan cada 24 horas' })
      .setTimestamp();

    for (let i = 0; i < userData.quests.length; i++) {
      const quest = userData.quests[i];
      const status = quest.completed ? '✅' : '⏳';
      const progressBar = '█'.repeat(Math.floor((quest.progress / quest.goal) * 10)) + '░'.repeat(10 - Math.floor((quest.progress / quest.goal) * 10));
      
      embed.addFields({
        name: `${status} Misión ${i + 1}`,
        value: `${quest.description}\n${progressBar} **${quest.progress}/${quest.goal}**\n🎁 Recompensa: **${quest.reward.toLocaleString()}** 🪙`,
        inline: false
      });
    }

    const allCompleted = userData.quests.every(q => q.completed);
    if (allCompleted && !userData.questsClaimedToday) {
      const totalReward = userData.quests.reduce((sum, q) => sum + q.reward, 0);
      userData.coins += totalReward;
      userData.questsClaimedToday = true;
      updateUser(interaction.user.id, userData);

      embed.setDescription(`🎉 **¡Todas las misiones completadas!**\nHas ganado **${totalReward.toLocaleString()}** 🪙`);
      embed.setColor('#2ecc71');
    }

    await interaction.reply({ embeds: [embed] });
  }

  // SPIN - Ruleta de premios
  if (interaction.isChatInputCommand() && interaction.commandName === 'spin') {
    const userData = getUser(interaction.user.id);
    const now = Date.now();
    const cooldown = 86400000; // 24 horas

    if (userData.lastSpin && (now - userData.lastSpin) < cooldown) {
      const timeLeft = cooldown - (now - userData.lastSpin);
      const hours = Math.floor(timeLeft / 3600000);
      return interaction.reply({ 
        content: `⏰ Ya has usado la ruleta hoy. Vuelve en **${hours}** horas.`, 
        flags: 64 
      });
    }

    const loadingEmbed = new EmbedBuilder()
      .setColor('#f39c12')
      .setTitle('🎰 Ruleta de Premios')
      .setDescription('🎲 **Girando la ruleta...**');

    await interaction.reply({ embeds: [loadingEmbed] });

    await new Promise(resolve => setTimeout(resolve, 2000));

    const prizes = [
      { name: '💰 50 Monedas', value: 50, emoji: '💰', chance: 30 },
      { name: '💵 100 Monedas', value: 100, emoji: '💵', chance: 25 },
      { name: '💎 250 Monedas', value: 250, emoji: '💎', chance: 20 },
      { name: '🌟 500 Monedas', value: 500, emoji: '🌟', chance: 15 },
      { name: '👑 1000 Monedas', value: 1000, emoji: '👑', chance: 7 },
      { name: '🎁 Item Aleatorio', value: 'item', emoji: '🎁', chance: 3 }
    ];

    let roll = Math.random() * 100;
    let selectedPrize = null;
    
    for (let prize of prizes) {
      if (roll <= prize.chance) {
        selectedPrize = prize;
        break;
      }
      roll -= prize.chance;
    }

    if (!selectedPrize) selectedPrize = prizes[0];

    const bpXPRewards = { 50: 10, 100: 15, 250: 25, 500: 40, 1000: 80, item: 30 };
    const bpXP = bpXPRewards[selectedPrize.value] || 10;

    if (selectedPrize.value === 'item') {
      const items = ['lucky_charm', 'shield', 'multiplier', 'daily_boost'];
      const randomItem = items[Math.floor(Math.random() * items.length)];
      userData.inventory.push(randomItem);
      selectedPrize.name = `🎁 ${randomItem.replace('_', ' ')}`;
    } else {
      userData.coins += selectedPrize.value;
    }

    const xpResult = addBattlePassXP(userData, bpXP);
    const finalXP = xpResult.finalXP;
    const hasBoost = xpResult.hasBoost;
    userData.lastSpin = now;
    updateUser(interaction.user.id, userData);

    const resultEmbed = new EmbedBuilder()
      .setColor('#2ecc71')
      .setTitle('🎰 ¡Resultado de la Ruleta!')
      .setDescription(`${selectedPrize.emoji} **${selectedPrize.name}**`)
      .addFields(
        { name: '💰 Nuevo Balance', value: `${userData.coins.toLocaleString()} 🪙`, inline: true },
        { name: '⭐ XP Ganado', value: `+${finalXP} XP${hasBoost ? ' 🔥' : ''}`, inline: true },
        { name: '⏰ Próximo Spin', value: 'En 24 horas', inline: true }
      )
      .setFooter({ text: '🎰 ¡Vuelve mañana para otro spin gratis!' })
      .setTimestamp();

    await interaction.editReply({ embeds: [resultEmbed] });
  }

  // STREAK - Ver racha de días consecutivos
  if (interaction.isChatInputCommand() && interaction.commandName === 'streak') {
    const userData = getUser(interaction.user.id);
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    const twoDaysAgo = now - (48 * 60 * 60 * 1000);

    // Verificar si la racha se rompió
    if (userData.lastActive && userData.lastActive < twoDaysAgo) {
      userData.streak = 0;
    }

    // Incrementar racha si es un nuevo día
    if (!userData.lastActive || userData.lastActive < oneDayAgo) {
      userData.streak = (userData.streak || 0) + 1;
      userData.lastActive = now;
      
      // Recompensa por racha
      let bonus = 0;
      if (userData.streak >= 30) bonus = 500;
      else if (userData.streak >= 14) bonus = 250;
      else if (userData.streak >= 7) bonus = 100;
      else if (userData.streak >= 3) bonus = 50;

      if (bonus > 0) {
        userData.coins += bonus;
        updateUser(interaction.user.id, userData);
      }
    }

    const milestones = [
      { days: 3, reward: 50, name: '🔥 Calentando' },
      { days: 7, reward: 100, name: '⚡ En Llamas' },
      { days: 14, reward: 250, name: '💫 Imparable' },
      { days: 30, reward: 500, name: '👑 Leyenda' }
    ];

    const nextMilestone = milestones.find(m => m.days > userData.streak) || milestones[milestones.length - 1];

    const embed = new EmbedBuilder()
      .setColor('#e74c3c')
      .setTitle('🔥 Tu Racha de Actividad')
      .setDescription(`Has estado activo por **${userData.streak}** días consecutivos!`)
      .addFields(
        { name: '📅 Días consecutivos', value: `**${userData.streak}** días`, inline: true },
        { name: '🎯 Siguiente meta', value: `${nextMilestone.days} días\n🎁 ${nextMilestone.reward} 🪙`, inline: true }
      )
      .setFooter({ text: '💡 Mantén tu racha activa cada día para ganar bonificaciones!' })
      .setTimestamp();

    // Agregar milestones alcanzados
    const achieved = milestones.filter(m => m.days <= userData.streak);
    if (achieved.length > 0) {
      embed.addFields({
        name: '🏆 Logros Desbloqueados',
        value: achieved.map(m => `${m.name} (${m.days} días)`).join('\n'),
        inline: false
      });
    }

    await interaction.reply({ embeds: [embed] });
  }

  // ========== COMANDOS DE STAFF ==========

  // ADD COINS (Solo Admin)
  if (interaction.isChatInputCommand() && interaction.commandName === 'add-coins') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Necesitas permisos de administrador para usar este comando.', flags: 64 });
    }

    const targetUser = interaction.options.getUser('usuario');
    const amount = interaction.options.getInteger('cantidad');

    if (amount <= 0) {
      return interaction.reply({ content: '❌ La cantidad debe ser mayor a 0.', flags: 64 });
    }

    const userData = getUser(targetUser.id);
    userData.coins += amount;
    updateUser(targetUser.id, userData);

    const embed = new EmbedBuilder()
      .setColor('#2ecc71')
      .setTitle('💰 Monedas Agregadas')
      .setDescription(`**${interaction.user.username}** agregó **${amount.toLocaleString()}** 🪙 a **${targetUser.username}**`)
      .addFields(
        { name: 'Nuevo balance', value: `${userData.coins.toLocaleString()} 🪙`, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // REMOVE COINS (Solo Admin)
  if (interaction.isChatInputCommand() && interaction.commandName === 'remove-coins') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Necesitas permisos de administrador para usar este comando.', flags: 64 });
    }

    const targetUser = interaction.options.getUser('usuario');
    const amount = interaction.options.getInteger('cantidad');

    if (amount <= 0) {
      return interaction.reply({ content: '❌ La cantidad debe ser mayor a 0.', flags: 64 });
    }

    const userData = getUser(targetUser.id);
    userData.coins -= amount;
    
    // No permitir balance negativo
    if (userData.coins < 0) userData.coins = 0;
    
    updateUser(targetUser.id, userData);

    const embed = new EmbedBuilder()
      .setColor('#e74c3c')
      .setTitle('💸 Monedas Removidas')
      .setDescription(`**${interaction.user.username}** removió **${amount.toLocaleString()}** 🪙 de **${targetUser.username}**`)
      .addFields(
        { name: 'Nuevo balance', value: `${userData.coins.toLocaleString()} 🪙`, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // ========== JUEGOS ==========

  // BLACKJACK
  if (interaction.isChatInputCommand() && interaction.commandName === 'blackjack') {
    const bet = interaction.options.getInteger('apuesta');
    const userData = getUser(interaction.user.id);

    if (bet <= 0) {
      return interaction.reply({ content: '❌ La apuesta debe ser mayor a 0.', flags: 64 });
    }

    if (userData.coins < bet) {
      return interaction.reply({ content: `❌ No tienes suficientes monedas. Tienes: **${userData.coins.toLocaleString()}** 🪙`, flags: 64 });
    }

    // Verificar si el usuario ya tiene una partida activa
    const activeCheck = hasActiveGame(interaction.user.id, 'blackjack');
    if (activeCheck.hasGame) {
      return interaction.reply({ content: '❌ Ya tienes una partida de Blackjack en curso. Termínala antes de empezar otra.', flags: 64 });
    }

    // Animación inicial
    const loadingEmbed = new EmbedBuilder()
      .setColor('#2c3e50')
      .setTitle('🃏 Blackjack')
      .setDescription('╔══════════════════════╗\n║                                          ║\n║    🎴 **MEZCLANDO CARTAS** 🎴   ║\n║                                          ║\n╚══════════════════════╝')
      .addFields(
        { name: '💰 Apuesta', value: `**${bet.toLocaleString()}** 🪙`, inline: true },
        { name: '🎯 Objetivo', value: '**21** puntos', inline: true }
      );

    try {
      await interaction.reply({ embeds: [loadingEmbed] });

      // Animación SIMPLIFICADA para evitar problemas de concurrencia
      // Solo 2 frames en lugar de 4 para reducir ediciones
      const shuffleFrames = [
        { text: '🎴 **MEZCLANDO**', color: '#2c3e50' },
        { text: '🃏 **REPARTIENDO**', color: '#34495e' }
      ];

      for (let i = 0; i < shuffleFrames.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 400)); // Mayor espera entre ediciones
        loadingEmbed.setColor(shuffleFrames[i].color);
        loadingEmbed.setDescription(`╔══════════════════════╗\n║                                          ║\n║       ${shuffleFrames[i].text}      ║\n║                                          ║\n╚══════════════════════╝`);
        try {
          await interaction.editReply({ embeds: [loadingEmbed] });
        } catch (err) {
          console.error('Error editReply during blackjack animation:', err);
          // Si falla la animación, continuamos igual (no es crítico)
          break; // Salir del loop de animación si falla
        }
      }
    } catch (err) {
      console.error('Blackjack initial error:', err);
      // Si falla el reply inicial, intentar responder con error
      try {
        await interaction.followUp({ content: '❌ Error al iniciar el juego. Intenta de nuevo.', flags: 64 });
      } catch (e) {
        console.error('No se pudo enviar mensaje de error:', e);
      }
      return;
    }

    // Crear baraja y repartir cartas
    const deck = [];
    const suits = ['♠️', '♥️', '♦️', '♣️'];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    
    for (let suit of suits) {
      for (let value of values) {
        deck.push({ suit, value });
      }
    }

    // Mezclar
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    const playerHand = [deck.pop(), deck.pop()];
    const dealerHand = [deck.pop(), deck.pop()];

    // Generar gameId único con timestamp + random para evitar colisiones
    const gameId = `bj_${interaction.user.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    activeGames.set(gameId, { deck, playerHand, dealerHand, bet, userId: interaction.user.id, game: 'blackjack' });

    const calculateHand = (hand) => {
      let sum = 0;
      let aces = 0;
      for (let card of hand) {
        if (card.value === 'A') {
          aces++;
          sum += 11;
        } else if (['J', 'Q', 'K'].includes(card.value)) {
          sum += 10;
        } else {
          sum += parseInt(card.value);
        }
      }
      while (sum > 21 && aces > 0) {
        sum -= 10;
        aces--;
      }
      return sum;
    };

    const playerValue = calculateHand(playerHand);
    const dealerValue = calculateHand([dealerHand[0]]);

    const embed = new EmbedBuilder()
      .setColor('#2c3e50')
      .setTitle('🃏 Blackjack')
      .setDescription('╔════════════════════╗\n║                                        ║\n║   🎯 **Llega a 21!** 🎯   ║\n║                                        ║\n╚════════════════════╝')
      .addFields(
        { 
          name: '🎴 Tu mano', 
          value: `${playerHand.map(c => `${c.value}${c.suit}`).join(' ')} = **${playerValue}** puntos`, 
          inline: false 
        },
        { 
          name: '🎰 Dealer', 
          value: `${dealerHand[0].value}${dealerHand[0].suit} 🂠 = **${dealerValue}** + ?`, 
          inline: false 
        },
        { name: '💰 Apuesta', value: `**${bet.toLocaleString()}** 🪙`, inline: true },
        { name: '📊 Estado', value: playerValue === 21 ? '🎊 **BLACKJACK!**' : playerValue > 16 ? '⚠️ Cuidado' : '✅ Seguro', inline: true }
      )
      .setFooter({ text: `💰 Balance: ${userData.coins.toLocaleString()} 🪙 | 🃏 Pedir carta o ✋ Plantarse` });

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`bj_hit_${gameId}`)
        .setLabel('🃏 Pedir')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`bj_stand_${gameId}`)
        .setLabel('✋ Plantarse')
        .setStyle(ButtonStyle.Danger)
    );

    if (playerValue === 21) {
      embed.setColor('#f1c40f')
        .setDescription('╔═══════════════════════╗\n║                                              ║\n║  � **¡BLACKJACK!** 🎊  ║\n║   **NATURAL 21**   ║\n║                                              ║\n║  💰 **+' + Math.floor(bet * 1.5).toLocaleString() + ' 🪙** (2.5x)  ║\n║                                              ║\n╚═══════════════════════╝');
      userData.coins += Math.floor(bet * 1.5);
      userData.stats.gamesPlayed++;
      userData.stats.gamesWon++;
      userData.stats.totalWinnings += Math.floor(bet * 1.5);
      updateUser(interaction.user.id, userData);
      activeGames.delete(gameId);
      embed.setFooter({ text: `💰 Nuevo balance: ${userData.coins.toLocaleString()} 🪙` });
      return interaction.editReply({ embeds: [embed] });
    }

    try {
      await interaction.editReply({ embeds: [embed], components: [buttons] });

      // CRÍTICO: Verificar que los botones estén presentes después de editar
      await new Promise(resolve => setTimeout(resolve, 100)); // Pequeña pausa para que Discord procese
      
      try {
        const replyMsg = await interaction.fetchReply();
        if (!replyMsg || !replyMsg.components || replyMsg.components.length === 0) {
          console.log('⚠️ FALLBACK ACTIVADO: Mensaje sin botones, enviando followUp');
          await interaction.followUp({ 
            content: '⚠️ Usa estos botones para jugar:', 
            embeds: [embed], 
            components: [buttons] 
          });
        }
      } catch (fetchErr) {
        console.log('⚠️ fetchReply falló, enviando followUp preventivo:', fetchErr?.message);
        await interaction.followUp({ 
          content: '⚠️ Usa estos botones para jugar:', 
          embeds: [embed], 
          components: [buttons] 
        });
      }
    } catch (editErr) {
      console.error('❌ editReply FALLÓ completamente, usando followUp:', editErr);
      // Si editReply falla completamente, enviar un mensaje nuevo
      try {
        await interaction.followUp({ 
          content: '🎴 Tu juego de Blackjack:', 
          embeds: [embed], 
          components: [buttons] 
        });
      } catch (followUpErr) {
        console.error('❌ CRÍTICO: followUp también falló:', followUpErr);
        // Eliminar el juego si no se pueden enviar los botones
        activeGames.delete(gameId);
      }
    }
  }

  // Botones de Blackjack
  if (interaction.isButton() && interaction.customId.startsWith('bj_')) {
    const parts = interaction.customId.split('_');
    const action = parts[1]; // 'hit' o 'stand'
    const gameId = parts.slice(2).join('_'); // resto es el gameId sin prefijo bj_
    
    // Buscar el juego del usuario (más robusto)
    let game = activeGames.get(gameId);
    
    // Si no se encuentra el juego exacto, buscar cualquier juego de blackjack del usuario
    if (!game) {
      for (const [key, g] of activeGames.entries()) {
        if (g.userId === interaction.user.id && g.game === 'blackjack') {
          game = g;
          break;
        }
      }
    }

    if (!game) {
      return interaction.reply({ content: '❌ Este juego ya terminó o expiró.', flags: 64 });
    }

    if (game.userId !== interaction.user.id) {
      return interaction.reply({ content: '❌ Este no es tu juego.', flags: 64 });
    }

    // PROTECCIÓN ANTI-SPAM: Evitar múltiples clics simultáneos
    if (game.processing) {
      return interaction.reply({ content: '⏳ Espera... procesando tu jugada anterior.', flags: 64 });
    }
    game.processing = true; // Bloquear el juego mientras se procesa

    const calculateHand = (hand) => {
      let sum = 0;
      let aces = 0;
      for (let card of hand) {
        if (card.value === 'A') {
          aces++;
          sum += 11;
        } else if (['J', 'Q', 'K'].includes(card.value)) {
          sum += 10;
        } else {
          sum += parseInt(card.value);
        }
      }
      while (sum > 21 && aces > 0) {
        sum -= 10;
        aces--;
      }
      return sum;
    };

    if (action === 'hit') {
      game.playerHand.push(game.deck.pop());
      const playerValue = calculateHand(game.playerHand);

      if (playerValue > 21) {
        const embed = new EmbedBuilder()
          .setColor('#e74c3c')
          .setTitle('🃏 Blackjack - ¡BUST!')
          .setDescription(`╔═══════════════════╗\n║                                      ║\n║   💥 **¡TE PASASTE!** 💥   ║\n║   **${playerValue}** puntos   ║\n║                                      ║\n║   **-${game.bet.toLocaleString()} 🪙**   ║\n║                                      ║\n╚═══════════════════╝`)
          .addFields(
            { 
              name: '🎴 Tu mano', 
              value: `${game.playerHand.map(c => `${c.value}${c.suit}`).join(' ')} = **${playerValue}** 💥`, 
              inline: false 
            },
            { 
              name: '🎰 Dealer tenía', 
              value: `${game.dealerHand.map(c => `${c.value}${c.suit}`).join(' ')} = **${calculateHand(game.dealerHand)}**`, 
              inline: false 
            }
          );

        const userData = getUser(interaction.user.id);
        userData.coins -= game.bet;
        userData.stats.gamesPlayed++;
        userData.stats.gamesLost++;
        userData.stats.totalLosses += game.bet;
        updateUser(interaction.user.id, userData);
        
        // Eliminar el juego correctamente (el lock se borra con el juego)
        for (const [key, g] of activeGames.entries()) {
          if (g.userId === interaction.user.id && g.game === 'blackjack') {
            activeGames.delete(key);
            break;
          }
        }

        embed.setFooter({ text: `💰 Nuevo balance: ${userData.coins.toLocaleString()} 🪙` });
        await interaction.update({ embeds: [embed], components: [] });
      } else {
        const statusMsg = playerValue === 21 ? '🎊 **¡BLACKJACK!**' : playerValue >= 19 ? '🔥 **Excelente mano**' : playerValue >= 17 ? '⚠️ **Arriesgado**' : '✅ **Seguro**';
        
        const embed = new EmbedBuilder()
          .setColor(playerValue >= 17 ? '#e67e22' : '#2c3e50')
          .setTitle('🃏 Blackjack')
          .setDescription(`╔════════════════════╗\n║                                        ║\n║   ${statusMsg}   ║\n║                                        ║\n╚════════════════════╝`)
          .addFields(
            { 
              name: '🎴 Tu mano', 
              value: `${game.playerHand.map(c => `${c.value}${c.suit}`).join(' ')} = **${playerValue}**`, 
              inline: false 
            },
            { 
              name: '� Tu mano', 
              value: `${game.playerHand.map(c => `${c.value}${c.suit}`).join(' ')} = **${playerValue}** puntos`, 
              inline: false 
            },
            { 
              name: '�🎰 Dealer', 
              value: `${game.dealerHand[0].value}${game.dealerHand[0].suit} 🂠 = **?**`, 
              inline: false 
            },
            { name: '💰 Apuesta', value: `**${game.bet.toLocaleString()}** 🪙`, inline: true },
            { name: '📊 Riesgo', value: statusMsg, inline: true }
          )
          .setFooter({ text: '🃏 Pedir otra carta o ✋ Plantarse' });

        const buttons = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`bj_hit_${gameId}`)
            .setLabel('🃏 Pedir')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`bj_stand_${gameId}`)
            .setLabel('✋ Plantarse')
            .setStyle(ButtonStyle.Danger)
        );

        game.processing = false; // Desbloquear para el siguiente clic
        await interaction.update({ embeds: [embed], components: [buttons] });
      }
    } else if (action === 'stand') {
      // Animación del dealer revelando y jugando
      const frames = [
        { emoji: '🎴', text: 'Revelando carta del dealer...', color: '#3498db' },
        { emoji: '🃏', text: 'Dealer jugando su turno...', color: '#9b59b6' },
        { emoji: '🎰', text: 'Evaluando resultado...', color: '#e67e22' }
      ];

      await interaction.update({ 
        embeds: [new EmbedBuilder()
          .setColor(frames[0].color)
          .setTitle('🃏 Blackjack')
          .setDescription(`${frames[0].emoji} **${frames[0].text}**`)
        ], 
        components: [] 
      });

      for (let i = 1; i < frames.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(frames[i].color)
            .setTitle('🃏 Blackjack')
            .setDescription(`${frames[i].emoji} **${frames[i].text}**`)
          ]
        });
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      let dealerValue = calculateHand(game.dealerHand);
      
      while (dealerValue < 17) {
        game.dealerHand.push(game.deck.pop());
        dealerValue = calculateHand(game.dealerHand);
      }

      const playerValue = calculateHand(game.playerHand);
      const userData = getUser(interaction.user.id);
      let result = '';
      let resultBox = '';
      let color = '#95a5a6';
      let icon = '🤝';

      if (dealerValue > 21 || playerValue > dealerValue) {
        const baseXP = 40;
        const { finalXP, hasBoost } = addBattlePassXP(userData, baseXP);
        icon = '🎉';
        resultBox = `╔═══════════════════════╗
║   � ¡VICTORIA! 🎊    ║
║                       ║
║   Ganancia: +${game.bet.toLocaleString()} 🪙   ║
║   XP: +${finalXP} ⭐${hasBoost ? ' 🔥' : ''}           ║
╚═══════════════════════╝`;
        result = `${icon} **¡Ganaste!**\n\n${resultBox}`;
        userData.coins += game.bet;
        userData.stats.gamesWon++;
        userData.stats.totalWinnings += game.bet;
        color = '#2ecc71';
      } else if (playerValue === dealerValue) {
        icon = '🤝';
        resultBox = `╔═══════════════════════╗
║      🤝 EMPATE 🤝     ║
║                       ║
║   Apuesta devuelta    ║
╚═══════════════════════╝`;
        result = `${icon} **Empate**\n\n${resultBox}`;
        color = '#f39c12';
      } else {
        icon = '💔';
        resultBox = `╔═══════════════════════╗
║    💔 DERROTA 💔      ║
║                       ║
║   Pérdida: -${game.bet.toLocaleString()} 🪙  ║
╚═══════════════════════╝`;
        result = `${icon} **Perdiste**\n\n${resultBox}`;
        userData.coins -= game.bet;
        userData.stats.gamesLost++;
        userData.stats.totalLosses += game.bet;
        color = '#e74c3c';
      }

      userData.stats.gamesPlayed++;
      updateUser(interaction.user.id, userData);

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle('🃏 Blackjack - Resultado Final')
        .setDescription(result)
        .addFields(
          { 
            name: '🎴 Tu mano', 
            value: `${game.playerHand.map(c => `${c.value}${c.suit}`).join(' ')} = **${playerValue}** puntos`, 
            inline: true 
          },
          { 
            name: '🎰 Dealer', 
            value: `${game.dealerHand.map(c => `${c.value}${c.suit}`).join(' ')} = **${dealerValue}** puntos`, 
            inline: true 
          }
        )
        .setFooter({ text: `💰 Balance: ${userData.coins.toLocaleString()} 🪙` });

      // Eliminar el juego correctamente (el lock se borra con el juego)
      for (const [key, g] of activeGames.entries()) {
        if (g.userId === interaction.user.id && g.game === 'blackjack') {
          activeGames.delete(key);
          break;
        }
      }
      
      await interaction.editReply({ embeds: [embed], components: [] });
    }
  }

  // COINFLIP
  if (interaction.isChatInputCommand() && interaction.commandName === 'coinflip') {
    const bet = interaction.options.getInteger('apuesta');
    const choice = interaction.options.getString('eleccion');
    const userData = getUser(interaction.user.id);

    if (bet <= 0) {
      return interaction.reply({ content: '❌ La apuesta debe ser mayor a 0.', flags: 64 });
    }

    if (userData.coins < bet) {
      return interaction.reply({ content: `❌ No tienes suficientes monedas. Tienes: **${userData.coins.toLocaleString()}** 🪙`, flags: 64 });
    }

    // Evitar que el usuario abra múltiples coinflips simultáneos
    const gameId = `coinflip_${interaction.user.id}_${Date.now()}`;
    for (const g of activeGames.values()) {
      if (g.userId === interaction.user.id && g.game === 'coinflip') {
        return interaction.reply({ content: '❌ Ya tienes un coinflip en curso. Espera a que termine.', flags: 64 });
      }
    }

    activeGames.set(gameId, { userId: interaction.user.id, game: 'coinflip', bet });

    // Animación mejorada de moneda girando
    const loadingEmbed = new EmbedBuilder()
      .setColor('#f39c12')
      .setTitle('🪙 Coinflip')
      .setDescription('┏━━━━━━━━━━━━━━━━━━┓\n┃                                        ┃\n┃          🪙 **LANZANDO**      ┃\n┃                                        ┃\n┗━━━━━━━━━━━━━━━━━━┛')
      .addFields(
        { name: '🎯 Tu elección', value: choice === 'cara' ? '✨ **CARA**' : '💀 **CRUZ**', inline: true },
        { name: '💰 Apuesta', value: `**${bet.toLocaleString()}** 🪙`, inline: true }
      );

    try {
      await interaction.reply({ embeds: [loadingEmbed] });

      // Animación más elaborada
      const frames = [
        { emoji: '🪙', text: '**GIRANDO**', color: '#f39c12' },
        { emoji: '💫', text: '**GIRANDO**', color: '#e67e22' },
        { emoji: '✨', text: '**GIRANDO**', color: '#d35400' },
        { emoji: '🌟', text: '**GIRANDO**', color: '#f39c12' },
        { emoji: '💫', text: '**GIRANDO**', color: '#e67e22' },
        { emoji: '⭐', text: '**CAYENDO**', color: '#f1c40f' },
        { emoji: '🪙', text: '**CAYENDO**', color: '#f39c12' }
      ];

      for (let i = 0; i < frames.length; i++) {
        // pequeño delay entre frames
        await new Promise(resolve => setTimeout(resolve, 300));
        loadingEmbed.setColor(frames[i].color);
        loadingEmbed.setDescription(`┏━━━━━━━━━━━━━━━━━━┓\n┃                                        ┃\n┃        ${frames[i].emoji} ${frames[i].text}      ┃\n┃                                        ┃\n┗━━━━━━━━━━━━━━━━━━┛`);
        try {
          await interaction.editReply({ embeds: [loadingEmbed] });
        } catch (err) {
          // No bloqueamos la animación si falla un edit (rate limit u otro)
          console.error('Error editReply during coinflip animation:', err);
        }
      }

      const result = Math.random() < 0.5 ? 'cara' : 'cruz';
      const won = result === choice;

      const embed = new EmbedBuilder()
        .setTitle('🪙 Coinflip - Resultado')
        .addFields(
          { name: '🎯 Tu elección', value: choice === 'cara' ? '✨ **CARA**' : '💀 **CRUZ**', inline: true },
          { name: '🎲 Cayó en', value: result === 'cara' ? '✨ **CARA**' : '💀 **CRUZ**', inline: true },
          { name: '💰 Apuesta', value: `**${bet.toLocaleString()}** 🪙`, inline: false }
        );

      if (won) {
        const baseXP = 20;
        const { finalXP, hasBoost } = addBattlePassXP(userData, baseXP);
        userData.coins += bet;
        userData.stats.gamesWon++;
        userData.stats.totalWinnings += bet;
        embed.setColor('#2ecc71')
          .setDescription(`╔═══════════════════╗\n║   🎉 **¡GANASTE!** 🎉    ║\n║  **+${bet.toLocaleString()} 🪙**  ║\n║  **+${finalXP} ⭐ XP**${hasBoost ? ' 🔥' : ''}  ║\n╚═══════════════════╝`);
      } else {
        userData.coins -= bet;
        userData.stats.gamesLost++;
        userData.stats.totalLosses += bet;
        embed.setColor('#e74c3c')
          .setDescription(`╔═══════════════════╗\n║   ❌ **PERDISTE** ❌     ║\n║  **-${bet.toLocaleString()} 🪙**  ║\n╚═══════════════════╝`);
      }

      userData.stats.gamesPlayed++;
      updateUser(interaction.user.id, userData);

      embed.setFooter({ text: `💰 Nuevo balance: ${userData.coins.toLocaleString()} 🪙` });
      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('Coinflip error:', err);
      try { await interaction.followUp({ content: '❌ Ocurrió un error ejecutando el coinflip. Intenta de nuevo.', flags: 64 }); } catch(e){}
    } finally {
      activeGames.delete(gameId);
    }
  }

  // DADOS
  if (interaction.isChatInputCommand() && interaction.commandName === 'dice') {
    const bet = interaction.options.getInteger('apuesta');
    const userData = getUser(interaction.user.id);

    if (bet <= 0) {
      return interaction.reply({ content: '❌ La apuesta debe ser mayor a 0.', flags: 64 });
    }

    if (userData.coins < bet) {
      return interaction.reply({ content: `❌ No tienes suficientes monedas. Tienes: **${userData.coins.toLocaleString()}** 🪙`, flags: 64 });
    }

    // Evitar que el usuario abra múltiples juegos de dados simultáneos
    const gameId = `dice_${interaction.user.id}_${Date.now()}`;
    for (const g of activeGames.values()) {
      if (g.userId === interaction.user.id && g.game === 'dice') {
        return interaction.reply({ content: '❌ Ya tienes un juego de dados en curso. Espera a que termine.', flags: 64 });
      }
    }

    activeGames.set(gameId, { userId: interaction.user.id, game: 'dice', bet });

    // Animación mejorada de dados
    const loadingEmbed = new EmbedBuilder()
      .setColor('#e74c3c')
      .setTitle('🎲 Dados')
      .setDescription('╔══════════════════╗\n║                                      ║\n║      🎲 **LANZANDO** 🎲     ║\n║                                      ║\n╚══════════════════╝')
      .addFields(
        { name: '💰 Apuesta', value: `**${bet.toLocaleString()}** 🪙`, inline: true },
        { name: '🎯 Objetivo', value: '**12** = 3x 💎\n**10-11** = 2x ⭐\n**7-9** = Empate 🤝', inline: true }
      );

    try {
      await interaction.reply({ embeds: [loadingEmbed] });

      // Animación más elaborada de dados girando
      const diceFrames = [
        { dice: '⚀ ⚀', text: '**GIRANDO**', color: '#e74c3c' },
        { dice: '⚁ ⚂', text: '**GIRANDO**', color: '#c0392b' },
        { dice: '⚃ ⚄', text: '**GIRANDO**', color: '#e74c3c' },
        { dice: '⚅ ⚀', text: '**GIRANDO**', color: '#c0392b' },
        { dice: '⚁ ⚃', text: '**RODANDO**', color: '#e67e22' },
        { dice: '⚄ ⚅', text: '**RODANDO**', color: '#d35400' },
        { dice: '⚂ ⚁', text: '**RODANDO**', color: '#e67e22' },
        { dice: '⚅ ⚃', text: '**CAYENDO**', color: '#f39c12' }
      ];

      for (let i = 0; i < diceFrames.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 250));
        loadingEmbed.setColor(diceFrames[i].color);
        loadingEmbed.setDescription(`╔══════════════════╗\n║                                      ║\n║   ${diceFrames[i].dice} ${diceFrames[i].text}   ║\n║                                      ║\n╚══════════════════╝`);
        try {
          await interaction.editReply({ embeds: [loadingEmbed] });
        } catch (err) {
          console.error('Error editReply during dice animation:', err);
        }
      }

    const dice1 = Math.floor(Math.random() * 6) + 1;
    const dice2 = Math.floor(Math.random() * 6) + 1;
    const total = dice1 + dice2;

    const diceEmojis = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

    let winnings = 0;
    let result = '';
    let color = '#e74c3c';
    let resultBox = '';

    if (total === 12) {
      winnings = bet * 3;
      result = `� **¡DOBLE 6!** 🎊\n💎 **JACKPOT** 💎`;
      color = '#f1c40f';
      resultBox = `╔═══════════════════╗\n║  🎊 **¡DOBLE 6!** 🎊   ║\n║   **+${winnings.toLocaleString()} 🪙** (3x)   ║\n╚═══════════════════╝`;
    } else if (total >= 10) {
      winnings = bet * 2;
      result = `✨ **¡EXCELENTE!** ✨`;
      color = '#2ecc71';
      resultBox = `╔═══════════════════╗\n║  ✨ **¡GANASTE!** ✨    ║\n║   **+${winnings.toLocaleString()} 🪙** (2x)   ║\n╚═══════════════════╝`;
    } else if (total >= 7) {
      winnings = bet;
      result = `🤝 **EMPATE** 🤝`;
      color = '#95a5a6';
      resultBox = `╔═══════════════════╗\n║    🤝 **EMPATE** 🤝     ║\n║  Apuesta devuelta   ║\n╚═══════════════════╝`;
    } else {
      winnings = -bet;
      result = `💔 **MUY BAJO** 💔`;
      color = '#e74c3c';
      resultBox = `╔═══════════════════╗\n║   ❌ **PERDISTE** ❌   ║\n║   **-${bet.toLocaleString()} 🪙**   ║\n╚═══════════════════╝`;
    }

      const baseXP = total === 12 ? 50 : total >= 10 ? 30 : 0;
      let finalXP = 0;
      let hasBoost = false;

      userData.coins += winnings;
      userData.stats.gamesPlayed++;
      
      if (winnings > 0) {
        const xpResult = addBattlePassXP(userData, baseXP);
        finalXP = xpResult.finalXP;
        hasBoost = xpResult.hasBoost;
        userData.stats.gamesWon++;
        userData.stats.totalWinnings += winnings;
      } else if (winnings < 0) {
        userData.stats.gamesLost++;
        userData.stats.totalLosses += Math.abs(winnings);
      }

      updateUser(interaction.user.id, userData);

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle('🎲 Dados - Resultado')
        .setDescription(resultBox)
        .addFields(
          { name: '🎲 Dados', value: `${diceEmojis[dice1-1]} ${diceEmojis[dice2-1]}`, inline: true },
          { name: '📊 Total', value: `**${total}** puntos`, inline: true },
          { name: '💰 Apuesta', value: `**${bet.toLocaleString()} **🪙`, inline: true },
          ...(finalXP > 0 ? [{ name: '⭐ XP Ganado', value: `+${finalXP} XP${hasBoost ? ' 🔥' : ''}`, inline: true }] : [])
        )
        .setFooter({ text: `💰 Nuevo balance: ${userData.coins.toLocaleString()} 🪙` });

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('Dice error:', err);
      try { await interaction.followUp({ content: '❌ Ocurrió un error ejecutando los dados. Intenta de nuevo.', flags: 64 }); } catch(e){}
    } finally {
      activeGames.delete(gameId);
    }
  }

  // RULETA
  if (interaction.isChatInputCommand() && interaction.commandName === 'roulette') {
    const bet = interaction.options.getInteger('apuesta');
    const choice = interaction.options.getString('eleccion');
    const userData = getUser(interaction.user.id);

    if (bet <= 0) {
      return interaction.reply({ content: '❌ La apuesta debe ser mayor a 0.', flags: 64 });
    }

    if (userData.coins < bet) {
      return interaction.reply({ content: `❌ No tienes suficientes monedas. Tienes: **${userData.coins.toLocaleString()}** 🪙`, flags: 64 });
    }

    // Animación de ruleta profesional
    const loadingEmbed = new EmbedBuilder()
      .setColor('#9b59b6')
      .setTitle('🎰 RULETA DE LA FORTUNA')
      .setDescription('┏━━━━━━━━━━━━━━━━━━━━┓\n┃                                            ┃\n┃    � **GIRANDO RULETA** 🎰   ┃\n┃                                            ┃\n┗━━━━━━━━━━━━━━━━━━━━┛')
      .addFields(
        { name: '🎯 Tu apuesta', value: choice === 'rojo' ? '🔴 **ROJO**' : choice === 'negro' ? '⚫ **NEGRO**' : `🎯 **Número ${choice}**`, inline: true },
        { name: '💰 Cantidad', value: `**${bet.toLocaleString()}** 🪙`, inline: true }
      );

    await interaction.reply({ embeds: [loadingEmbed] });

    // Animación más elaborada de ruleta
    const spinFrames = [
      { num: '36', color: '🔴', bgcolor: '#e74c3c' },
      { num: '13', color: '⚫', bgcolor: '#2c3e50' },
      { num: '27', color: '🔴', bgcolor: '#e74c3c' },
      { num: '6', color: '⚫', bgcolor: '#2c3e50' },
      { num: '34', color: '🔴', bgcolor: '#e74c3c' },
      { num: '17', color: '⚫', bgcolor: '#2c3e50' },
      { num: '25', color: '🔴', bgcolor: '#e74c3c' },
      { num: '2', color: '⚫', bgcolor: '#2c3e50' },
      { num: '21', color: '🔴', bgcolor: '#e74c3c' },
      { num: '4', color: '⚫', bgcolor: '#2c3e50' }
    ];

    for (let i = 0; i < spinFrames.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 200 + (i * 30))); // Va más lento al final
      loadingEmbed.setColor(spinFrames[i].bgcolor);
      loadingEmbed.setDescription(`┏━━━━━━━━━━━━━━━━━━━━┓\n┃                                            ┃\n┃       ${spinFrames[i].color} **${spinFrames[i].num}** 🎰       ┃\n┃                                            ┃\n┗━━━━━━━━━━━━━━━━━━━━┛`);
      await interaction.editReply({ embeds: [loadingEmbed] });
    }

    const number = Math.floor(Math.random() * 37); // 0-36
    const isRed = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(number);
    const color = number === 0 ? 'verde' : isRed ? 'rojo' : 'negro';

    let winnings = 0;
    let won = false;

    if (choice === number.toString()) {
      winnings = bet * 36;
      won = true;
    } else if (choice === 'rojo' && color === 'rojo') {
      winnings = bet * 2;
      won = true;
    } else if (choice === 'negro' && color === 'negro') {
      winnings = bet * 2;
      won = true;
    } else {
      winnings = -bet;
    }

    let resultBox = '';
    let finalColor = '#e74c3c';

    if (choice === number.toString() && won) {
      resultBox = `╔═══════════════════════╗\n║  🎊 **¡NÚMERO EXACTO!** 🎊  ║\n║    💎 **MEGA PREMIO** 💎    ║\n║     **+${winnings.toLocaleString()} 🪙** (36x)     ║\n╚═══════════════════════╝`;
      finalColor = '#f1c40f';
    } else if (won) {
      resultBox = `╔═══════════════════╗\n║   🎉 **¡GANASTE!** 🎉   ║\n║   **+${winnings.toLocaleString()} 🪙** (2x)   ║\n╚═══════════════════╝`;
      finalColor = '#2ecc71';
    } else {
      resultBox = `╔═══════════════════╗\n║   ❌ **PERDISTE** ❌   ║\n║    **-${bet.toLocaleString()} 🪙**    ║\n╚═══════════════════╝`;
      finalColor = '#e74c3c';
    }

    const embed = new EmbedBuilder()
      .setColor(finalColor)
      .setTitle('🎰 Ruleta - Resultado')
      .setDescription(resultBox)
      .addFields(
        { name: '🎯 Tu apuesta', value: choice === 'rojo' ? '🔴 **ROJO**' : choice === 'negro' ? '⚫ **NEGRO**' : `🎯 **#${choice}**`, inline: true },
        { name: '🎲 Cayó en', value: `${color === 'rojo' ? '🔴' : color === 'negro' ? '⚫' : '🟢'} **${number}** (${color.toUpperCase()})`, inline: true },
        { name: '💰 Apuesta', value: `**${bet.toLocaleString()}** 🪙`, inline: false },
        ...(bpXP > 0 ? [{ name: '⭐ XP Ganado', value: `+${bpXP} XP`, inline: true }] : [])
      );

    const baseXP = choice === number.toString() && won ? 100 : won ? 35 : 0;
    let finalXP = 0;
    let hasBoost = false;

    if (won) {
      userData.coins += winnings;
      const xpResult = addBattlePassXP(userData, baseXP);
      finalXP = xpResult.finalXP;
      hasBoost = xpResult.hasBoost;
      userData.stats.gamesWon++;
      userData.stats.totalWinnings += winnings;
    } else {
      userData.coins += winnings;
      userData.stats.gamesLost++;
      userData.stats.totalLosses += Math.abs(winnings);
    }

    userData.stats.gamesPlayed++;
    updateUser(interaction.user.id, userData);

    // Actualizar el embed con el XP correcto
    if (finalXP > 0 && embed.data.fields) {
      const xpFieldIndex = embed.data.fields.findIndex(f => f.name === '⭐ XP Ganado');
      if (xpFieldIndex >= 0) {
        embed.data.fields[xpFieldIndex].value = `+${finalXP} XP${hasBoost ? ' 🔥' : ''}`;
      }
    }

    embed.setFooter({ text: `💰 Nuevo balance: ${userData.coins.toLocaleString()} 🪙 | Color: 2x | Número exacto: 36x` });
    await interaction.editReply({ embeds: [embed] });
  }

  // PIEDRA PAPEL TIJERA
  if (interaction.isChatInputCommand() && interaction.commandName === 'rps') {
    const bet = interaction.options.getInteger('apuesta');
    const choice = interaction.options.getString('eleccion');
    const userData = getUser(interaction.user.id);

    if (bet <= 0) {
      return interaction.reply({ content: '❌ La apuesta debe ser mayor a 0.', flags: 64 });
    }

    if (userData.coins < bet) {
      return interaction.reply({ content: `❌ No tienes suficientes monedas. Tienes: **${userData.coins.toLocaleString()}** 🪙`, flags: 64 });
    }

    const emojis = {
      piedra: '🪨',
      papel: '📄',
      tijera: '✂️'
    };

    // Animación de duelo
    const loadingEmbed = new EmbedBuilder()
      .setColor('#3498db')
      .setTitle('✊✋✌️ Piedra, Papel o Tijera')
      .setDescription('╔════════════════════╗\n║                                        ║\n║      ⚔️ **PREPARANDO** ⚔️     ║\n║                                        ║\n╚════════════════════╝')
      .addFields(
        { name: '🎯 Tu elección', value: `${emojis[choice]} **${choice.toUpperCase()}**`, inline: true },
        { name: '💰 Apuesta', value: `**${bet.toLocaleString()}** 🪙`, inline: true }
      );

    await interaction.reply({ embeds: [loadingEmbed] });

    // Animación de cuenta regresiva
    const countFrames = [
      { text: '**3...**', color: '#e74c3c' },
      { text: '**2...**', color: '#f39c12' },
      { text: '**1...**', color: '#f1c40f' },
      { text: '**¡YA!**', color: '#2ecc71' }
    ];

    for (let i = 0; i < countFrames.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      loadingEmbed.setColor(countFrames[i].color);
      loadingEmbed.setDescription(`╔════════════════════╗\n║                                        ║\n║       ${countFrames[i].text}       ║\n║                                        ║\n╚════════════════════╝`);
      await interaction.editReply({ embeds: [loadingEmbed] });
    }

    const options = ['piedra', 'papel', 'tijera'];
    const botChoice = options[Math.floor(Math.random() * 3)];

    let result = '';
    let winnings = 0;
    let color = '#95a5a6';
    let resultBox = '';

    if (choice === botChoice) {
      result = '🤝 **EMPATE**';
      color = '#f39c12';
      resultBox = `╔═══════════════════╗\n║    🤝 **EMPATE** 🤝     ║\n║  Apuesta devuelta   ║\n╚═══════════════════╝`;
    } else if (
      (choice === 'piedra' && botChoice === 'tijera') ||
      (choice === 'papel' && botChoice === 'piedra') ||
      (choice === 'tijera' && botChoice === 'papel')
    ) {
      const baseXP = 30;
      winnings = bet * 2;
      userData.coins += bet;
      const xpResult = addBattlePassXP(userData, baseXP);
      const finalXP = xpResult.finalXP;
      const hasBoost = xpResult.hasBoost;
      userData.stats.gamesWon++;
      userData.stats.totalWinnings += bet;
      result = `🎉 **¡VICTORIA!**`;
      color = '#2ecc71';
      resultBox = `╔═══════════════════╗\n║  🎉 **¡GANASTE!** 🎉   ║\n║   **+${bet.toLocaleString()} 🪙** (2x)   ║\n║   **+${finalXP} ⭐ XP${hasBoost ? ' 🔥' : ''}**   ║\n╚═══════════════════╝`;
    } else {
      winnings = -bet;
      userData.coins -= bet;
      userData.stats.gamesLost++;
      userData.stats.totalLosses += bet;
      result = `❌ **DERROTA**`;
      color = '#e74c3c';
      resultBox = `╔═══════════════════╗\n║   ❌ **PERDISTE** ❌   ║\n║    **-${bet.toLocaleString()} 🪙**    ║\n╚═══════════════════╝`;
    }

    userData.stats.gamesPlayed++;
    updateUser(interaction.user.id, userData);

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle('✊✋✌️ Piedra, Papel o Tijera - Resultado')
      .setDescription(resultBox)
      .addFields(
        { name: '🎯 Tú', value: `${emojis[choice]} **${choice.toUpperCase()}**`, inline: true },
        { name: '⚡ VS', value: '💥', inline: true },
        { name: '🤖 Bot', value: `${emojis[botChoice]} **${botChoice.toUpperCase()}**`, inline: true }
      )
      .setFooter({ text: `💰 Nuevo balance: ${userData.coins.toLocaleString()} 🪙` });

    await interaction.editReply({ embeds: [embed] });
  }

  // ADIVINA EL NÚMERO
  if (interaction.isChatInputCommand() && interaction.commandName === 'guess') {
    const bet = interaction.options.getInteger('apuesta');
    const userData = getUser(interaction.user.id);

    if (bet <= 0) {
      return interaction.reply({ content: '❌ La apuesta debe ser mayor a 0.', flags: 64 });
    }

    if (userData.coins < bet) {
      return interaction.reply({ content: `❌ No tienes suficientes monedas. Tienes: **${userData.coins.toLocaleString()}** 🪙`, flags: 64 });
    }

    // Verificar si el usuario ya tiene una partida activa de Guess
    const activeCheck = hasActiveGame(interaction.user.id, 'guess');
    if (activeCheck.hasGame) {
      return interaction.reply({ content: '❌ Ya tienes una partida de adivinanza en curso. Termínala antes de empezar otra.', flags: 64 });
    }

    const targetNumber = Math.floor(Math.random() * 100) + 1;
    const gameId = `guess_${interaction.user.id}_${Date.now()}`;
    
    activeGames.set(gameId, {
      targetNumber,
      attempts: 0,
      maxAttempts: 5,
      bet,
      userId: interaction.user.id
    });

    const embed = new EmbedBuilder()
      .setColor('#3498db')
      .setTitle('🔢 Adivina el Número')
      .setDescription('╔════════════════════════╗\n║                                            ║\n║  🎯 **PENSANDO UN NÚMERO** 🎯  ║\n║      **Del 1 al 100**      ║\n║                                            ║\n╚════════════════════════╝\n\n🎮 Tienes **5 intentos** para adivinarlo.\n💡 Cuantos menos intentos uses, **¡MÁS GANAS!**\n\n✍️ **Escribe un número en el chat**')
      .addFields(
        { name: '💰 Apuesta', value: `**${bet.toLocaleString()}** 🪙`, inline: true },
        { name: '🎯 Intentos', value: '**5** restantes', inline: true },
        { name: '🏆 Multiplicadores', value: '🥇 **1 intento:** 5x\n🥈 **2 intentos:** 4x\n🥉 **3 intentos:** 3x\n🎖️ **4 intentos:** 2x\n⭐ **5 intentos:** 1x', inline: false }
      )
      .setFooter({ text: '💭 Piensa bien... cada intento cuenta!' });

    await interaction.reply({ embeds: [embed] });
  }

  // HIGH OR LOW
  if (interaction.isChatInputCommand() && interaction.commandName === 'highlow') {
    const bet = interaction.options.getInteger('apuesta');
    const userData = getUser(interaction.user.id);

    if (bet <= 0) {
      return interaction.reply({ content: '❌ La apuesta debe ser mayor a 0.', flags: 64 });
    }

    if (userData.coins < bet) {
      return interaction.reply({ content: `❌ No tienes suficientes monedas. Tienes: **${userData.coins.toLocaleString()}** 🪙`, flags: 64 });
    }

    // Verificar si el usuario ya tiene una partida activa de High/Low
    const activeCheck = hasActiveGame(interaction.user.id);
    if (activeCheck.hasGame && activeCheck.gameId.includes(interaction.user.id)) {
      return interaction.reply({ content: '❌ Ya tienes una partida en curso. Termínala antes de empezar otra.', flags: 64 });
    }

    const currentNumber = Math.floor(Math.random() * 100) + 1;
    const gameId = `${interaction.user.id}_${Date.now()}`;
    
    activeGames.set(gameId, {
      currentNumber,
      streak: 0,
      bet,
      userId: interaction.user.id
    });

    const embed = new EmbedBuilder()
      .setColor('#9b59b6')
      .setTitle('📊 Higher or Lower')
      .setDescription(`🎲 **Número actual: ${currentNumber}**\n\n❓ **¿El siguiente será mayor o menor?**\n\n🔥 Construye rachas para ganar más!\n💰 Puedes cobrar en cualquier momento`)
      .addFields(
        { name: '💰 Apuesta', value: `${bet.toLocaleString()} 🪙`, inline: true },
        { name: '🔥 Racha', value: '**0**', inline: true },
        { name: '💎 Multiplicador', value: '**1x**', inline: true },
        { name: '🏆 Premios', value: '**Racha 5:** 10x 💎\n**Racha 3:** 5x ⭐\n**Racha 1:** 2x ✨', inline: false }
      )
      .setFooter({ text: '🎮 ¡Elige sabiamente!' });

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`hl_higher_${gameId}`)
        .setLabel('⬆️ Mayor')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`hl_lower_${gameId}`)
        .setLabel('⬇️ Menor')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`hl_cashout_${gameId}`)
        .setLabel('💰 Cobrar')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true)
    );

    await interaction.reply({ embeds: [embed], components: [buttons] });
  }

  // Botones de Higher or Lower
  if (interaction.isButton() && interaction.customId.startsWith('hl_')) {
    const parts = interaction.customId.split('_');
    const action = parts[1]; // 'higher', 'lower', o 'cashout'
    const gameId = parts.slice(2).join('_'); // resto es el gameId
    const game = activeGames.get(gameId);

    if (!game) {
      return interaction.reply({ content: '❌ Este juego ya terminó.', flags: 64 });
    }

    if (game.userId !== interaction.user.id) {
      return interaction.reply({ content: '❌ Este no es tu juego.', flags: 64 });
    }

    // PROTECCIÓN ANTI-SPAM: Evitar múltiples clics simultáneos
    if (game.processing) {
      return interaction.reply({ content: '⏳ Espera... procesando tu jugada anterior.', flags: 64 });
    }
    game.processing = true; // Bloquear el juego mientras se procesa

    if (action === 'cashout') {
      const multipliers = [0, 2, 3, 5, 7, 10];
      const multiplier = multipliers[Math.min(game.streak, 5)];
      const winnings = game.bet * multiplier;
      const bpXPRewards = [0, 20, 35, 50, 70, 100];
      const bpXP = bpXPRewards[Math.min(game.streak, 5)];

      const userData = getUser(interaction.user.id);
      userData.coins += winnings - game.bet;
      const xpResult = addBattlePassXP(userData, bpXP);
      const finalXP = xpResult.finalXP;
      const hasBoost = xpResult.hasBoost;
      userData.stats.gamesPlayed++;
      userData.stats.gamesWon++;
      userData.stats.totalWinnings += winnings - game.bet;
      updateUser(interaction.user.id, userData);

      const streakMedals = ['', '✨', '⭐', '🌟', '💫', '💎'];
      const medal = streakMedals[Math.min(game.streak, 5)];

      const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('📊 Higher or Lower - ¡COBRADO!')
        .setDescription(`╔═══════════════════════╗\n║                                              ║\n║  ${medal} **¡PREMIO COBRADO!** ${medal}  ║\n║                                              ║\n║  💰 **+${(winnings - game.bet).toLocaleString()} 🪙**  ║\n║  ⭐ **+${finalXP} XP${hasBoost ? ' 🔥' : ''}**  ║\n║                                              ║\n╚═══════════════════════╝`)
        .addFields(
          { name: '🔥 Racha final', value: `**${game.streak}** ${medal}`, inline: true },
          { name: '💎 Multiplicador', value: `**${multiplier}x**`, inline: true },
          { name: '🏆 Ganancia', value: `**${(winnings - game.bet).toLocaleString()}** 🪙`, inline: true }
        )
        .setFooter({ text: `💰 Nuevo balance: ${userData.coins.toLocaleString()} 🪙 | ¡Excelente decisión!` });

      activeGames.delete(gameId); // El lock se elimina con el juego
      await interaction.update({ embeds: [embed], components: [] });
    } else {
      const nextNumber = Math.floor(Math.random() * 100) + 1;
      const correct = (action === 'higher' && nextNumber > game.currentNumber) ||
                     (action === 'lower' && nextNumber < game.currentNumber);

      if (correct) {
        game.streak++;
        game.currentNumber = nextNumber;

        const multipliers = [0, 2, 3, 5, 7, 10];
        const multiplier = multipliers[Math.min(game.streak, 5)];

        const streakEmojis = ['', '✨', '⭐', '🌟', '💫', '💎'];
        const streakText = game.streak >= 5 ? '💎 **¡RACHA ÉPICA!** 💎' : game.streak >= 3 ? '🌟 **¡GRAN RACHA!** 🌟' : '✨ **¡Correcto!** ✨';

        const embed = new EmbedBuilder()
          .setColor(game.streak >= 5 ? '#f1c40f' : game.streak >= 3 ? '#9b59b6' : '#3498db')
          .setTitle('📊 Higher or Lower - ¡Acertaste!')
          .setDescription(`╔══════════════════════╗\n║                                          ║\n║   ${streakText}   ║\n║                                          ║\n║      🎲 Nuevo número:      ║\n║         **${nextNumber}**         ║\n║                                          ║\n╚══════════════════════╝\n\n❓ **¿Seguir jugando o cobrar?**`)
          .addFields(
            { name: '💰 Apuesta', value: `**${game.bet.toLocaleString()}** 🪙`, inline: true },
            { name: '🔥 Racha', value: `**${game.streak}** ${streakEmojis[Math.min(game.streak, 5)]}`, inline: true },
            { name: '💎 Multiplicador', value: `**${multiplier}x**`, inline: true }
          )
          .setFooter({ text: `💡 Ganancia actual: ${((game.bet * multiplier) - game.bet).toLocaleString()} 🪙` });

        const buttons = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`hl_higher_${gameId}`)
            .setLabel('⬆️ Mayor')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`hl_lower_${gameId}`)
            .setLabel('⬇️ Menor')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`hl_cashout_${gameId}`)
            .setLabel('💰 Cobrar')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(game.streak === 0)
        );

        game.processing = false; // Desbloquear para el siguiente clic
        await interaction.update({ embeds: [embed], components: [buttons] });
      } else {
        const userData = getUser(interaction.user.id);
        userData.coins -= game.bet;
        userData.stats.gamesPlayed++;
        userData.stats.gamesLost++;
        userData.stats.totalLosses += game.bet;
        updateUser(interaction.user.id, userData);

        const embed = new EmbedBuilder()
          .setColor('#e74c3c')
          .setTitle('📊 Higher or Lower - ¡Fallaste!')
          .setDescription(`╔═══════════════════╗\n║                                      ║\n║   💔 **INCORRECTO** 💔   ║\n║                                      ║\n║  El número era **${nextNumber}**  ║\n║   **-${game.bet.toLocaleString()} 🪙**   ║\n║                                      ║\n╚═══════════════════╝`)
          .addFields(
            { name: '🔥 Racha alcanzada', value: game.streak > 0 ? `**${game.streak}** 🎯` : 'Ninguna 😢', inline: true },
            { name: '💰 Balance', value: `**${userData.coins.toLocaleString()}** 🪙`, inline: true }
          )
          .setFooter({ text: '¡No te rindas! Intenta de nuevo' });

        activeGames.delete(gameId); // El lock se elimina con el juego
        await interaction.update({ embeds: [embed], components: [] });
      }
    }
  }
  // ========== SISTEMA DE DUELOS ==========
  if (interaction.isChatInputCommand() && interaction.commandName === 'duel') {
    const opponent = interaction.options.getUser('oponente');
    const bet = interaction.options.getInteger('apuesta');
    const gameType = interaction.options.getString('juego') || 'coinflip';
    const userData = getUser(interaction.user.id);

    if (opponent.id === interaction.user.id) {
      return interaction.reply({ content: '❌ No puedes retarte a ti mismo.', flags: 64 });
    }

    if (opponent.bot) {
      return interaction.reply({ content: '❌ No puedes retar a un bot.', flags: 64 });
    }

    if (bet <= 0) {
      return interaction.reply({ content: '❌ La apuesta debe ser mayor a 0.', flags: 64 });
    }

    if (userData.coins < bet) {
      return interaction.reply({ content: `❌ No tienes suficientes monedas. Tienes: **${userData.coins.toLocaleString()}** 🪙`, flags: 64 });
    }

    const opponentData = getUser(opponent.id);
    if (opponentData.coins < bet) {
      return interaction.reply({ content: `❌ ${opponent.username} no tiene suficientes monedas para este duelo.`, flags: 64 });
    }

    // Verificar si ya hay un duelo pendiente con este usuario
    for (const game of activeGames.values()) {
      if (game.game === 'duel' && (game.challenger === interaction.user.id || game.opponent === opponent.id)) {
        return interaction.reply({ content: '❌ Ya hay un duelo pendiente con este usuario.', flags: 64 });
      }
    }

    const gameNames = {
      'coinflip': '🪙 Cara o Cruz',
      'dice': '🎲 Dados',
      'blackjack': '🃏 Blackjack',
      'rps': '✊ Piedra/Papel/Tijera',
      'guess': '🔢 Adivinanza'
    };

    const duelId = `duel_${interaction.user.id}_${Date.now()}`;
    activeGames.set(duelId, {
      game: 'duel',
      gameType,
      challenger: interaction.user.id,
      opponent: opponent.id,
      bet,
      timestamp: Date.now()
    });

    const embed = new EmbedBuilder()
      .setColor('#e74c3c')
      .setTitle('⚔️ Duelo de Monedas')
      .setDescription(`**${interaction.user}** ha retado a **${opponent}** a un duelo!`)
      .addFields(
        { name: '💰 Apuesta', value: `**${bet.toLocaleString()}** 🪙`, inline: true },
        { name: '🎯 Modalidad', value: gameNames[gameType], inline: true },
        { name: '⏱️ Tiempo límite', value: '60 segundos', inline: true }
      )
      .setFooter({ text: 'El retado debe aceptar para comenzar' });

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`duel_accept_${duelId}`)
        .setLabel('⚔️ Aceptar Duelo')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`duel_decline_${duelId}`)
        .setLabel('❌ Rechazar')
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.reply({ content: `${opponent}`, embeds: [embed], components: [buttons] });

    // Auto-cancelar después de 60 segundos
    setTimeout(() => {
      if (activeGames.has(duelId)) {
        activeGames.delete(duelId);
      }
    }, 60000);
  }

  // Botones de duelo
  if (interaction.isButton() && interaction.customId.startsWith('duel_')) {
    const parts = interaction.customId.split('_');
    const action = parts[1]; // 'accept' o 'decline'
    const duelId = parts.slice(2).join('_');
    
    const duel = activeGames.get(duelId);
    if (!duel) {
      return interaction.reply({ content: '❌ Este duelo ya expiró o fue cancelado.', flags: 64 });
    }

    if (interaction.user.id !== duel.opponent) {
      return interaction.reply({ content: '❌ Este duelo no es para ti.', flags: 64 });
    }

    // PROTECCIÓN ANTI-SPAM
    if (duel.processing) {
      return interaction.reply({ content: '⏳ Este duelo ya está siendo procesado.', flags: 64 });
    }
    duel.processing = true;

    if (action === 'decline') {
      activeGames.delete(duelId);
      await interaction.update({ 
        content: '❌ Duelo rechazado', 
        embeds: [], 
        components: [] 
      });
      return;
    }

    if (action === 'accept') {
      // Realizar el duelo
      const challenger = await client.users.fetch(duel.challenger);
      const opponent = await client.users.fetch(duel.opponent);
      
      const challengerData = getUser(duel.challenger);
      const opponentData = getUser(duel.opponent);

      // Verificar que ambos aún tengan monedas
      if (challengerData.coins < duel.bet) {
        activeGames.delete(duelId);
        return interaction.update({ 
          content: `❌ ${challenger.username} ya no tiene suficientes monedas.`, 
          embeds: [], 
          components: [] 
        });
      }

      if (opponentData.coins < duel.bet) {
        activeGames.delete(duelId);
        return interaction.update({ 
          content: `❌ ${opponent.username} ya no tiene suficientes monedas.`, 
          embeds: [], 
          components: [] 
        });
      }

      const gameType = duel.gameType || 'coinflip';
      let winner, loser, resultDetails;

      // Animación inicial
      const loadingEmbed = new EmbedBuilder()
        .setColor('#f39c12')
        .setTitle('⚔️ Duelo en Progreso');

      await interaction.update({ embeds: [loadingEmbed], components: [] });

      // Ejecutar el juego según el tipo
      if (gameType === 'coinflip') {
        loadingEmbed.setDescription('🪙 **Lanzando moneda...**');
        await interaction.editReply({ embeds: [loadingEmbed] });
        await new Promise(resolve => setTimeout(resolve, 1000));

        loadingEmbed.setDescription('💫 **Girando...**').setColor('#e67e22');
        await interaction.editReply({ embeds: [loadingEmbed] });
        await new Promise(resolve => setTimeout(resolve, 1000));

        loadingEmbed.setDescription('✨ **Cayendo...**').setColor('#f1c40f');
        await interaction.editReply({ embeds: [loadingEmbed] });
        await new Promise(resolve => setTimeout(resolve, 500));

        winner = Math.random() < 0.5 ? duel.challenger : duel.opponent;
        loser = winner === duel.challenger ? duel.opponent : duel.challenger;
        const result = Math.random() < 0.5 ? 'Cara' : 'Cruz';
        resultDetails = `Resultado: **${result}**`;

      } else if (gameType === 'dice') {
        loadingEmbed.setDescription('🎲 **Lanzando dados...**');
        await interaction.editReply({ embeds: [loadingEmbed] });
        await new Promise(resolve => setTimeout(resolve, 1500));

        let challengerDice, opponentDice, challengerSum, opponentSum;
        let rolls = 0;
        let maxRolls = 3;

        // Relanzar en caso de empate
        do {
          rolls++;
          challengerDice = [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1];
          opponentDice = [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1];
          challengerSum = challengerDice.reduce((a, b) => a + b, 0);
          opponentSum = opponentDice.reduce((a, b) => a + b, 0);

          if (challengerSum === opponentSum && rolls < maxRolls) {
            loadingEmbed.setDescription(`🎲 **¡EMPATE en lanzamiento ${rolls}!**\n\nAmbos: **${challengerSum}**\n\n⚡ Relanzando dados...`);
            await interaction.editReply({ embeds: [loadingEmbed] });
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } while (challengerSum === opponentSum && rolls < maxRolls);

        loadingEmbed.setDescription(`🎲 **Resultados:**\n\n${challenger.username}: [${challengerDice[0]}] [${challengerDice[1]}] = **${challengerSum}**\n${opponent.username}: [${opponentDice[0]}] [${opponentDice[1]}] = **${opponentSum}**${rolls > 1 ? `\n\n📊 Relanzamientos: ${rolls - 1}` : ''}`);
        await interaction.editReply({ embeds: [loadingEmbed] });
        await new Promise(resolve => setTimeout(resolve, 2000));

        if (challengerSum > opponentSum) {
          winner = duel.challenger;
          loser = duel.opponent;
        } else if (opponentSum > challengerSum) {
          winner = duel.opponent;
          loser = duel.challenger;
        } else {
          // Si después de 3 lanzamientos sigue empate (raro), ganador aleatorio
          winner = Math.random() < 0.5 ? duel.challenger : duel.opponent;
          loser = winner === duel.challenger ? duel.opponent : duel.challenger;
        }
        resultDetails = `${challenger.username}: **${challengerSum}** | ${opponent.username}: **${opponentSum}**${rolls > 1 ? ` (${rolls} lanzamientos)` : ''}`;

      } else if (gameType === 'blackjack') {
        loadingEmbed.setDescription('🃏 **Repartiendo cartas...**');
        await interaction.editReply({ embeds: [loadingEmbed] });
        await new Promise(resolve => setTimeout(resolve, 1500));

        const drawCard = () => Math.min(Math.floor(Math.random() * 13) + 1, 10);
        const calculateScore = (cards) => {
          let score = cards.reduce((a, b) => a + b, 0);
          if (score > 21 && cards.includes(1)) {
            score -= 10;
          }
          return score;
        };

        const challengerCards = [drawCard(), drawCard()];
        const opponentCards = [drawCard(), drawCard()];
        let challengerScore = calculateScore(challengerCards);
        let opponentScore = calculateScore(opponentCards);

        loadingEmbed.setDescription(`🃏 **Cartas iniciales:**\n\n${challenger.username}: **${challengerScore}**\n${opponent.username}: **${opponentScore}**`);
        await interaction.editReply({ embeds: [loadingEmbed] });
        await new Promise(resolve => setTimeout(resolve, 2000));

        if (challengerScore > opponentScore && challengerScore <= 21) {
          winner = duel.challenger;
          loser = duel.opponent;
        } else if (opponentScore > challengerScore && opponentScore <= 21) {
          winner = duel.opponent;
          loser = duel.challenger;
        } else if (challengerScore > 21 && opponentScore <= 21) {
          winner = duel.opponent;
          loser = duel.challenger;
        } else if (opponentScore > 21 && challengerScore <= 21) {
          winner = duel.challenger;
          loser = duel.opponent;
        } else {
          winner = Math.random() < 0.5 ? duel.challenger : duel.opponent;
          loser = winner === duel.challenger ? duel.opponent : duel.challenger;
        }
        resultDetails = `${challenger.username}: **${challengerScore}** | ${opponent.username}: **${opponentScore}**`;

      } else if (gameType === 'rps') {
        loadingEmbed.setDescription('✊ **Eligiendo jugadas...**');
        await interaction.editReply({ embeds: [loadingEmbed] });
        await new Promise(resolve => setTimeout(resolve, 1500));

        const choices = ['piedra', 'papel', 'tijera'];
        const emojis = { 'piedra': '✊', 'papel': '✋', 'tijera': '✌️' };
        let challengerChoice, opponentChoice;
        let rounds = [];
        let maxRounds = 5; // Máximo 5 rounds para evitar empates infinitos

        // Jugar rounds hasta que haya ganador o se alcance el máximo
        for (let round = 1; round <= maxRounds; round++) {
          challengerChoice = choices[Math.floor(Math.random() * 3)];
          opponentChoice = choices[Math.floor(Math.random() * 3)];
          
          rounds.push(`Round ${round}: ${emojis[challengerChoice]} vs ${emojis[opponentChoice]}`);

          if (challengerChoice !== opponentChoice) {
            // Hay ganador, salir del bucle
            if (round > 1) {
              loadingEmbed.setDescription(`✊ **¡Empates anteriores! Jugando Round ${round}...**\n\n${rounds.slice(-2).join('\n')}`);
              await interaction.editReply({ embeds: [loadingEmbed] });
              await new Promise(resolve => setTimeout(resolve, 1500));
            }
            break;
          } else if (round < maxRounds) {
            // Empate, mostrar y continuar
            loadingEmbed.setDescription(`✊ **EMPATE en Round ${round}!**\n\n${challenger.username}: ${emojis[challengerChoice]}\n${opponent.username}: ${emojis[opponentChoice]}\n\n⚡ Jugando otro round...`);
            await interaction.editReply({ embeds: [loadingEmbed] });
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }

        loadingEmbed.setDescription(`✊ **Jugadas finales:**\n\n${challenger.username}: ${emojis[challengerChoice]} **${challengerChoice}**\n${opponent.username}: ${emojis[opponentChoice]} **${opponentChoice}**${rounds.length > 1 ? `\n\n📊 Empates: ${rounds.length - 1}` : ''}`);
        await interaction.editReply({ embeds: [loadingEmbed] });
        await new Promise(resolve => setTimeout(resolve, 2000));

        if (challengerChoice === opponentChoice) {
          // Si después de 5 rounds sigue empate (muy raro), elegir al azar
          winner = Math.random() < 0.5 ? duel.challenger : duel.opponent;
          loser = winner === duel.challenger ? duel.opponent : duel.challenger;
        } else if (
          (challengerChoice === 'piedra' && opponentChoice === 'tijera') ||
          (challengerChoice === 'papel' && opponentChoice === 'piedra') ||
          (challengerChoice === 'tijera' && opponentChoice === 'papel')
        ) {
          winner = duel.challenger;
          loser = duel.opponent;
        } else {
          winner = duel.opponent;
          loser = duel.challenger;
        }
        resultDetails = `${emojis[challengerChoice]} vs ${emojis[opponentChoice]}${rounds.length > 1 ? ` (${rounds.length} rounds)` : ''}`;

      } else if (gameType === 'guess') {
        loadingEmbed.setDescription('🔢 **Adivinando número (1-100)...**');
        await interaction.editReply({ embeds: [loadingEmbed] });
        await new Promise(resolve => setTimeout(resolve, 1500));

        let targetNumber, challengerGuess, opponentGuess, challengerDiff, opponentDiff;
        let attempts = 0;
        let maxAttempts = 3;

        // Repetir hasta que NO haya empate o se alcance el máximo
        do {
          attempts++;
          targetNumber = Math.floor(Math.random() * 100) + 1;
          challengerGuess = Math.floor(Math.random() * 100) + 1;
          opponentGuess = Math.floor(Math.random() * 100) + 1;
          challengerDiff = Math.abs(targetNumber - challengerGuess);
          opponentDiff = Math.abs(targetNumber - opponentGuess);

          if (challengerDiff === opponentDiff && attempts < maxAttempts) {
            loadingEmbed.setDescription(`🔢 **¡EMPATE en intento ${attempts}!**\n\nNúmero: ${targetNumber}\nAmbos: diferencia ${challengerDiff}\n\n⚡ Intentando de nuevo...`);
            await interaction.editReply({ embeds: [loadingEmbed] });
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } while (challengerDiff === opponentDiff && attempts < maxAttempts);

        loadingEmbed.setDescription(`🔢 **Número secreto: ${targetNumber}**\n\n${challenger.username}: **${challengerGuess}** (diferencia: ${challengerDiff})\n${opponent.username}: **${opponentGuess}** (diferencia: ${opponentDiff})${attempts > 1 ? `\n\n📊 Intentos: ${attempts}` : ''}`);
        await interaction.editReply({ embeds: [loadingEmbed] });
        await new Promise(resolve => setTimeout(resolve, 2000));

        if (challengerDiff < opponentDiff) {
          winner = duel.challenger;
          loser = duel.opponent;
        } else if (opponentDiff < challengerDiff) {
          winner = duel.opponent;
          loser = duel.challenger;
        } else {
          // Si después de 3 intentos sigue empate (extremadamente raro), elegir al azar
          winner = Math.random() < 0.5 ? duel.challenger : duel.opponent;
          loser = winner === duel.challenger ? duel.opponent : duel.challenger;
        }
        resultDetails = `Número: **${targetNumber}** | ${challenger.username}: ${challengerGuess} | ${opponent.username}: ${opponentGuess}${attempts > 1 ? ` (${attempts} intentos)` : ''}`;
      }

      // Actualizar datos de los jugadores
      const baseXP = 50;
      const winnerData = getUser(winner);
      const loserData = getUser(loser);

      winnerData.coins += duel.bet;
      loserData.coins -= duel.bet;

      const xpResult = addBattlePassXP(winnerData, baseXP);
      const finalXP = xpResult.finalXP;
      const hasBoost = xpResult.hasBoost;
      winnerData.stats.gamesPlayed++;
      winnerData.stats.gamesWon++;
      winnerData.stats.totalWinnings += duel.bet;

      loserData.stats.gamesPlayed++;
      loserData.stats.gamesLost++;
      loserData.stats.totalLosses += duel.bet;

      updateUser(winner, winnerData);
      updateUser(loser, loserData);

      const winnerUser = winner === duel.challenger ? challenger : opponent;
      const loserUser = loser === duel.challenger ? challenger : opponent;

      const resultEmbed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('⚔️ Resultado del Duelo')
        .setDescription(`╔═══════════════════════╗\n║                                              ║\n║   🏆 **¡${winnerUser.username.toUpperCase()} GANA!** 🏆   ║\n║                                              ║\n╚═══════════════════════╝\n\n${resultDetails}`)
        .addFields(
          { name: '👑 Ganador', value: `${winnerUser}\n+${duel.bet.toLocaleString()} 🪙\n+${finalXP} ⭐ XP${hasBoost ? ' 🔥' : ''}`, inline: true },
          { name: '💔 Perdedor', value: `${loserUser}\n-${duel.bet.toLocaleString()} 🪙`, inline: true },
          { name: '\u200b', value: '\u200b', inline: true },
          { name: '💰 Nuevo balance (Ganador)', value: `${winnerData.coins.toLocaleString()} 🪙`, inline: true },
          { name: '💰 Nuevo balance (Perdedor)', value: `${loserData.coins.toLocaleString()} 🪙`, inline: true }
        )
        .setFooter({ text: '¡Buen duelo! Usa /duel para retar a alguien más' })
        .setTimestamp();

      activeGames.delete(duelId);
      await interaction.editReply({ embeds: [resultEmbed] });
    }
  }

  // ========== TIENDA DE ITEMS ==========
  if (interaction.isChatInputCommand() && interaction.commandName === 'shop') {
    const shopItems = [
      { id: 'lucky_charm', name: '🍀 Amuleto de la Suerte', price: 5000, description: '+10% de probabilidad de ganar por 24h' },
      { id: 'shield', name: '🛡️ Escudo Protector', price: 3000, description: 'Protege el 50% de pérdidas por 12h' },
      { id: 'multiplier', name: '💎 Multiplicador x2', price: 10000, description: 'Duplica ganancias por 1 hora' },
      { id: 'daily_boost', name: '⚡ Boost Diario', price: 2000, description: 'Daily da 500 monedas extra por 7 días' },
      { id: 'vip_title', name: '👑 Título VIP', price: 15000, description: 'Título permanente "VIP" en tu perfil' }
    ];

    const embed = new EmbedBuilder()
      .setColor('#f1c40f')
      .setTitle('🛒 Tienda de Items')
      .setDescription('Compra items especiales con tus monedas. Usa `/buy <nombre>` para comprar.\n━━━━━━━━━━━━━━━━━━━━')
      .setFooter({ text: `💰 Tu balance: ${getUser(interaction.user.id).coins.toLocaleString()} 🪙` });

    shopItems.forEach(item => {
      embed.addFields({
        name: `${item.name} - ${item.price.toLocaleString()} 🪙`,
        value: `${item.description}\n\`/buy ${item.id}\``,
        inline: false
      });
    });

    await interaction.reply({ embeds: [embed] });
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'buy') {
    const itemId = interaction.options.getString('item');
    const userData = getUser(interaction.user.id);

    const shopItems = {
      'lucky_charm': { name: '🍀 Amuleto de la Suerte', price: 5000, duration: 86400000 },
      'shield': { name: '🛡️ Escudo Protector', price: 3000, duration: 43200000 },
      'multiplier': { name: '💎 Multiplicador x2', price: 10000, duration: 3600000 },
      'daily_boost': { name: '⚡ Boost Diario', price: 2000, duration: 604800000 },
      'vip_title': { name: '👑 Título VIP', price: 15000, duration: null }
    };

    const item = shopItems[itemId];
    if (!item) {
      return interaction.reply({ content: '❌ Item no encontrado. Usa `/shop` para ver items disponibles.', flags: 64 });
    }

    if (userData.coins < item.price) {
      return interaction.reply({ 
        content: `❌ No tienes suficientes monedas.\n💰 Precio: **${item.price.toLocaleString()}** 🪙\n💰 Tienes: **${userData.coins.toLocaleString()}** 🪙`, 
        flags: 64 
      });
    }

    // Verificar si ya tiene el item
    const existingItem = userData.inventory.find(i => i.id === itemId && i.expires > Date.now());
    if (existingItem) {
      return interaction.reply({ content: `❌ Ya tienes **${item.name}** activo.`, flags: 64 });
    }

    userData.coins -= item.price;
    
    if (itemId === 'vip_title') {
      if (!userData.titles.includes('👑 VIP')) {
        userData.titles.push('👑 VIP');
      }
    } else {
      userData.inventory.push({
        id: itemId,
        name: item.name,
        purchasedAt: Date.now(),
        expires: Date.now() + item.duration
      });
    }

    updateUser(interaction.user.id, userData);

    const embed = new EmbedBuilder()
      .setColor('#2ecc71')
      .setTitle('✅ Compra Exitosa')
      .setDescription(`Has comprado **${item.name}**`)
      .addFields(
        { name: '💰 Precio', value: `${item.price.toLocaleString()} 🪙`, inline: true },
        { name: '💵 Nuevo balance', value: `${userData.coins.toLocaleString()} 🪙`, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'inventory') {
    const targetUser = interaction.options.getUser('usuario') || interaction.user;
    const userData = getUser(targetUser.id);

    const activeItems = userData.inventory.filter(item => item.expires > Date.now());

    const embed = new EmbedBuilder()
      .setColor('#9b59b6')
      .setTitle(`🎒 Inventario de ${targetUser.username}`)
      .setDescription(activeItems.length > 0 ? 'Items activos:' : 'No tienes items activos.')
      .setTimestamp();

    if (activeItems.length > 0) {
      activeItems.forEach(item => {
        const timeLeft = Math.floor((item.expires - Date.now()) / 1000 / 60);
        embed.addFields({
          name: item.name,
          value: `⏱️ Expira en: ${timeLeft} minutos`,
          inline: true
        });
      });
    }

    if (userData.titles.length > 0) {
      embed.addFields({
        name: '🏆 Títulos',
        value: userData.titles.join(', '),
        inline: false
      });
    }

    await interaction.reply({ embeds: [embed] });
  }

  // ========== NUEVOS JUEGOS - FASE 1 ==========
  
  // Funciones auxiliares para Bingo
  function generateBingoCard() {
    const card = [];
    const columns = [
      Array.from({ length: 15 }, (_, i) => i + 1),   // B: 1-15
      Array.from({ length: 15 }, (_, i) => i + 16),  // I: 16-30
      Array.from({ length: 15 }, (_, i) => i + 31),  // N: 31-45
      Array.from({ length: 15 }, (_, i) => i + 46),  // G: 46-60
      Array.from({ length: 15 }, (_, i) => i + 61)   // O: 61-75
    ];

    for (let col of columns) {
      const shuffled = col.sort(() => Math.random() - 0.5);
      card.push(shuffled.slice(0, 5));
    }

    card[2][2] = 'FREE'; // Centro gratis
    return card;
  }

  async function startBingoGame(interaction, gameId) {
    const game = activeGames.get(gameId);
    if (!game || game.status !== 'waiting') return;

    game.status = 'playing';
    game.drawnNumbers = [];
    game.allNumbers = Array.from({ length: 75 }, (_, i) => i + 1);

    const embed = new EmbedBuilder()
      .setColor('#f39c12')
      .setTitle('🎰 ¡Bingo en Progreso!')
      .setDescription(`🎱 **Sacando números...**\n\n👥 Jugadores: ${game.players.length}\n🏆 Pozo: **${game.pot.toLocaleString()}** 🪙\n\n*El primer jugador en completar una línea gana!*`)
      .setFooter({ text: 'Simulando partida...' });

    await interaction.channel.send({ embeds: [embed] });

    // Simular partida (sacar números hasta que alguien gane)
    await new Promise(resolve => setTimeout(resolve, 2000));

    let winner = null;
    let drawCount = 0;

    while (!winner && drawCount < 75) {
      // Sacar número
      const randomIndex = Math.floor(Math.random() * game.allNumbers.length);
      const drawnNumber = game.allNumbers.splice(randomIndex, 1)[0];
      game.drawnNumbers.push(drawnNumber);
      drawCount++;

      // Verificar si alguien ganó
      for (const player of game.players) {
        if (checkBingoWin(player.card, game.drawnNumbers)) {
          winner = player;
          break;
        }
      }
    }

    if (winner) {
      const bpXP = 100;
      const winnerData = getUser(winner.id);
      winnerData.coins += game.pot;
      winnerData.battlePass.xp += bpXP;
      winnerData.stats.gamesPlayed += 1;
      const xpResult = addBattlePassXP(winnerData, bpXP);
      const finalXP = xpResult.finalXP;
      const hasBoost = xpResult.hasBoost;
      winnerData.stats.gamesWon += 1;
      winnerData.stats.totalWinnings += game.pot;
      updateUser(winner.id, winnerData);

      // Actualizar stats de perdedores
      for (const player of game.players) {
        if (player.id !== winner.id) {
          const loserData = getUser(player.id);
          loserData.stats.gamesPlayed += 1;
          loserData.stats.gamesLost += 1;
          loserData.stats.totalLosses += player.bet;
          updateUser(player.id, loserData);
        }
      }

      const winEmbed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('🎉 ¡BINGO!')
        .setDescription(`🏆 **${winner.name}** ganó el Bingo!\n\n💰 **Premio:** ${game.pot.toLocaleString()} 🪙\n⭐ **XP Ganado:** +${finalXP} XP${hasBoost ? ' 🔥' : ''}\n🎱 **Números sacados:** ${drawCount}\n👥 **Jugadores:** ${game.players.length}`)
        .addFields({ name: '🎯 Números ganadores', value: game.drawnNumbers.slice(-10).join(', ') + '...' })
        .setFooter({ text: 'Ea$y Esports Bingo' })
        .setTimestamp();

      await interaction.channel.send({ embeds: [winEmbed] });
    }

    activeGames.delete(gameId);
  }

  function checkBingoWin(card, drawnNumbers) {
    // Marcar números en el cartón
    const marked = card.map(col => 
      col.map(num => num === 'FREE' || drawnNumbers.includes(num))
    );

    // Verificar líneas horizontales
    for (let row = 0; row < 5; row++) {
      if (marked.every(col => col[row])) return true;
    }

    // Verificar líneas verticales
    for (let col = 0; col < 5; col++) {
      if (marked[col].every(cell => cell)) return true;
    }

    // Verificar diagonales
    if (marked[0][0] && marked[1][1] && marked[2][2] && marked[3][3] && marked[4][4]) return true;
    if (marked[0][4] && marked[1][3] && marked[2][2] && marked[3][1] && marked[4][0]) return true;

    return false;
  }

  // SLOTS - Máquina Tragamonedas
  if (interaction.isChatInputCommand() && interaction.commandName === 'slots') {
    const apuesta = interaction.options.getInteger('apuesta');
    const userData = getUser(interaction.user.id);

    if (userData.coins < apuesta) {
      return interaction.reply({ 
        content: `❌ No tienes suficientes monedas. Tienes: **${userData.coins.toLocaleString()}** 🪙`, 
        flags: 64 
      });
    }

    const gameId = `slots_${interaction.user.id}_${Date.now()}`;
    if (activeGames.has(gameId)) {
      return interaction.reply({ content: '❌ Ya tienes un juego activo.', flags: 64 });
    }

    activeGames.set(gameId, { userId: interaction.user.id, bet: apuesta });

    try {
      userData.coins -= apuesta;
      updateUser(interaction.user.id, userData);

      const slots = ['🍒', '🍋', '🍊', '🍇', '💎', '7️⃣', '⭐'];
      
      // Animación de rodillos
      const embed1 = new EmbedBuilder()
        .setColor('#f39c12')
        .setTitle('🎰 Máquina Tragamonedas')
        .setDescription(`**${interaction.user.username}** apostó **${apuesta.toLocaleString()}** 🪙\n\n🎰 [ ? | ? | ? ]\n\n*Girando...*`)
        .setFooter({ text: 'Ea$y Esports Casino' });

      await interaction.reply({ embeds: [embed1] });
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Resultado
      const reel1 = slots[Math.floor(Math.random() * slots.length)];
      const reel2 = slots[Math.floor(Math.random() * slots.length)];
      const reel3 = slots[Math.floor(Math.random() * slots.length)];

      let winnings = 0;
      let resultText = '';

      if (reel1 === reel2 && reel2 === reel3) {
        // Jackpot!
        if (reel1 === '💎') {
          winnings = apuesta * 50;
          resultText = '💎 **¡MEGA JACKPOT!** 💎';
        } else if (reel1 === '7️⃣') {
          winnings = apuesta * 25;
          resultText = '🎉 **¡JACKPOT 777!** 🎉';
        } else if (reel1 === '⭐') {
          winnings = apuesta * 15;
          resultText = '⭐ **¡SUPER PREMIO!** ⭐';
        } else {
          winnings = apuesta * 10;
          resultText = '🎊 **¡TRES IGUALES!** 🎊';
        }
      } else if (reel1 === reel2 || reel2 === reel3 || reel1 === reel3) {
        // Dos iguales
        winnings = Math.floor(apuesta * 2);
        resultText = '✨ **¡Dos iguales!**';
      } else {
        // Perdiste
        resultText = '💥 **Sin suerte esta vez...**';
      }

      // Calcular XP según el tipo de premio
      let baseXP = 0;
      if (reel1 === reel2 && reel2 === reel3) {
        baseXP = reel1 === '💎' ? 150 : reel1 === '7️⃣' ? 100 : 50;
      } else if (winnings > 0) {
        baseXP = 25;
      }

      let finalXP = 0;
      let hasBoost = false;

      userData.coins += winnings;
      userData.stats.gamesPlayed += 1;
      if (winnings > 0) {
        const xpResult = addBattlePassXP(userData, baseXP);
        finalXP = xpResult.finalXP;
        hasBoost = xpResult.hasBoost;
        userData.stats.gamesWon += 1;
        userData.stats.totalWinnings += winnings;
      } else {
        userData.stats.gamesLost += 1;
        userData.stats.totalLosses += apuesta;
      }
      updateUser(interaction.user.id, userData);

      const embed2 = new EmbedBuilder()
        .setColor(winnings > 0 ? '#2ecc71' : '#e74c3c')
        .setTitle('🎰 Máquina Tragamonedas')
        .setDescription(`**${interaction.user.username}** apostó **${apuesta.toLocaleString()}** 🪙\n\n🎰 [ ${reel1} | ${reel2} | ${reel3} ]\n\n${resultText}`)
        .addFields(
          { name: winnings > 0 ? '💰 Ganaste' : '💸 Perdiste', value: `${winnings > 0 ? '+' : ''}${(winnings - apuesta).toLocaleString()} 🪙`, inline: true },
          { name: '💼 Nuevo Balance', value: `${userData.coins.toLocaleString()} 🪙`, inline: true },
          ...(finalXP > 0 ? [{ name: '⭐ XP Ganado', value: `+${finalXP} XP${hasBoost ? ' 🔥' : ''}`, inline: true }] : [])
        )
        .setFooter({ text: 'Ea$y Esports Casino' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed2] });

    } catch (error) {
      console.error('Error en slots:', error);
      userData.coins += apuesta;
      updateUser(interaction.user.id, userData);
      await interaction.editReply({ content: '❌ Error en el juego. Apuesta devuelta.' });
    } finally {
      activeGames.delete(gameId);
    }
  }

  // RACE - Carreras de Emojis
  if (interaction.isChatInputCommand() && interaction.commandName === 'race') {
    const apuesta = interaction.options.getInteger('apuesta');
    const corredor = interaction.options.getInteger('corredor');
    const userData = getUser(interaction.user.id);

    if (userData.coins < apuesta) {
      return interaction.reply({ 
        content: `❌ No tienes suficientes monedas. Tienes: **${userData.coins.toLocaleString()}** 🪙`, 
        flags: 64 
      });
    }

    const gameId = `race_${interaction.user.id}_${Date.now()}`;
    if (activeGames.has(gameId)) {
      return interaction.reply({ content: '❌ Ya tienes un juego activo.', flags: 64 });
    }

    activeGames.set(gameId, { userId: interaction.user.id, bet: apuesta });

    try {
      userData.coins -= apuesta;
      updateUser(interaction.user.id, userData);

      const racers = ['🐎', '🦄', '🐕', '🐆'];
      const racerNames = ['Caballo', 'Unicornio', 'Perro', 'Guepardo'];
      
      const embed1 = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('🏇 Carrera de Emojis')
        .setDescription(`**${interaction.user.username}** apostó **${apuesta.toLocaleString()}** 🪙 al **${racers[corredor - 1]} ${racerNames[corredor - 1]}**\n\n🏁 **PREPARADOS...**\n\n1️⃣ ${racers[0]} ▬▬▬▬▬▬▬▬▬🏁\n2️⃣ ${racers[1]} ▬▬▬▬▬▬▬▬▬🏁\n3️⃣ ${racers[2]} ▬▬▬▬▬▬▬▬▬🏁\n4️⃣ ${racers[3]} ▬▬▬▬▬▬▬▬▬🏁`)
        .setFooter({ text: 'La carrera está por comenzar...' });

      await interaction.reply({ embeds: [embed1] });
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Simular carrera
      const positions = [0, 0, 0, 0];
      for (let i = 0; i < 9; i++) {
        positions[Math.floor(Math.random() * 4)] += 1;
      }

      const winner = positions.indexOf(Math.max(...positions)) + 1;
      const won = winner === corredor;

      const track = positions.map((pos, idx) => {
        const progress = '▬'.repeat(9 - pos) + racers[idx] + '█'.repeat(pos);
        return `${idx + 1}️⃣ ${progress}🏁`;
      }).join('\n');

      const winnings = won ? apuesta * 3 : 0;
      const baseXP = won ? 60 : 0;
      let finalXP = 0;
      let hasBoost = false;
      userData.coins += winnings;
      userData.stats.gamesPlayed += 1;
      if (won) {
        const xpResult = addBattlePassXP(userData, baseXP);
        finalXP = xpResult.finalXP;
        hasBoost = xpResult.hasBoost;
        userData.stats.gamesWon += 1;
        userData.stats.totalWinnings += winnings;
      } else {
        userData.stats.gamesLost += 1;
        userData.stats.totalLosses += apuesta;
      }
      updateUser(interaction.user.id, userData);

      const embed2 = new EmbedBuilder()
        .setColor(won ? '#2ecc71' : '#e74c3c')
        .setTitle('🏇 Carrera de Emojis - ¡Resultado!')
        .setDescription(`**${interaction.user.username}** apostó al **${racers[corredor - 1]} ${racerNames[corredor - 1]}**\n\n${track}\n\n🏆 **Ganador: ${racers[winner - 1]} ${racerNames[winner - 1]}**`)
        .addFields(
          { name: won ? '💰 ¡Ganaste!' : '💸 Perdiste', value: `${won ? '+' : ''}${(winnings - apuesta).toLocaleString()} 🪙${won && hasBoost ? ' | +' + finalXP + ' ⭐ XP 🔥' : won ? ' | +' + finalXP + ' ⭐ XP' : ''}`, inline: true },
          { name: '💼 Nuevo Balance', value: `${userData.coins.toLocaleString()} 🪙`, inline: true },
          ...(won ? [{ name: '⭐ XP Ganado', value: `+${bpXP} XP`, inline: true }] : [])
        )
        .setFooter({ text: 'Ea$y Esports Racing' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed2] });

    } catch (error) {
      console.error('Error en race:', error);
      userData.coins += apuesta;
      updateUser(interaction.user.id, userData);
      await interaction.editReply({ content: '❌ Error en el juego. Apuesta devuelta.' });
    } finally {
      activeGames.delete(gameId);
    }
  }

  // RUSSIAN ROULETTE - Ruleta Rusa
  if (interaction.isChatInputCommand() && interaction.commandName === 'russianroulette') {
    const apuesta = interaction.options.getInteger('apuesta');
    const userData = getUser(interaction.user.id);

    if (userData.coins < apuesta) {
      return interaction.reply({ 
        content: `❌ No tienes suficientes monedas. Tienes: **${userData.coins.toLocaleString()}** 🪙`, 
        flags: 64 
      });
    }

    const gameId = `rr_${interaction.user.id}_${Date.now()}`;
    if (activeGames.has(gameId)) {
      return interaction.reply({ content: '❌ Ya tienes un juego activo.', flags: 64 });
    }

    activeGames.set(gameId, { userId: interaction.user.id, bet: apuesta });

    try {
      userData.coins -= apuesta;
      updateUser(interaction.user.id, userData);

      const embed1 = new EmbedBuilder()
        .setColor('#e74c3c')
        .setTitle('🎪 Ruleta Rusa')
        .setDescription(`**${interaction.user.username}** apostó **${apuesta.toLocaleString()}** 🪙\n\n🔫 Girando el tambor...\n\n⚠️ **30% de perder TODO**\n💰 **70% de ganar x5**`)
        .setFooter({ text: '¿Tendrás suerte?' });

      await interaction.reply({ embeds: [embed1] });
      await new Promise(resolve => setTimeout(resolve, 2500));

      const survived = Math.random() > 0.3; // 70% de ganar
      const winnings = survived ? apuesta * 5 : 0;
      const baseXP = survived ? 80 : 0;
      let finalXP = 0;
      let hasBoost = false;

      userData.coins += winnings;
      userData.stats.gamesPlayed += 1;
      if (survived) {
        const xpResult = addBattlePassXP(userData, baseXP);
        finalXP = xpResult.finalXP;
        hasBoost = xpResult.hasBoost;
        userData.stats.gamesWon += 1;
        userData.stats.totalWinnings += winnings;
      } else {
        userData.stats.gamesLost += 1;
        userData.stats.totalLosses += apuesta;
      }
      updateUser(interaction.user.id, userData);

      const embed2 = new EmbedBuilder()
        .setColor(survived ? '#2ecc71' : '#e74c3c')
        .setTitle('🎪 Ruleta Rusa')
        .setDescription(`**${interaction.user.username}** apostó **${apuesta.toLocaleString()}** 🪙\n\n${survived ? '✅ **¡CLICK!** Sobreviviste 🎉' : '💥 **¡BANG!** Perdiste todo 💀'}`)
        .addFields(
          { name: survived ? '💰 Ganaste' : '💸 Perdiste', value: `${survived ? '+' : ''}${(winnings - apuesta).toLocaleString()} 🪙${survived && hasBoost ? ' | +' + finalXP + ' ⭐ XP 🔥' : survived ? ' | +' + finalXP + ' ⭐ XP' : ''}`, inline: true },
          { name: '💼 Nuevo Balance', value: `${userData.coins.toLocaleString()} 🪙`, inline: true },
          ...(survived ? [{ name: '⭐ XP Ganado', value: `+${bpXP} XP`, inline: true }] : [])
        )
        .setFooter({ text: 'Alto riesgo, alta recompensa' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed2] });

    } catch (error) {
      console.error('Error en russian roulette:', error);
      userData.coins += apuesta;
      updateUser(interaction.user.id, userData);
      await interaction.editReply({ content: '❌ Error en el juego. Apuesta devuelta.' });
    } finally {
      activeGames.delete(gameId);
    }
  }

  // TRIVIA - Preguntas de Cultura General
  if (interaction.isChatInputCommand() && interaction.commandName === 'trivia') {
    const dificultad = interaction.options.getString('dificultad');
    const userData = getUser(interaction.user.id);

    const costs = { facil: 50, media: 150, dificil: 300 };
    const prizes = { facil: 150, media: 500, dificil: 1200 };
    const cost = costs[dificultad];
    const prize = prizes[dificultad];

    if (userData.coins < cost) {
      return interaction.reply({ 
        content: `❌ Necesitas **${cost}** 🪙 para jugar. Tienes: **${userData.coins.toLocaleString()}** 🪙`, 
        flags: 64 
      });
    }

    // Verificar si el usuario ya tiene una partida activa
    const activeCheck = hasActiveGame(interaction.user.id, 'trivia');
    if (activeCheck.hasGame) {
      return interaction.reply({ content: '❌ Ya tienes una partida de Trivia en curso. Termínala antes de empezar otra.', flags: 64 });
    }

    const gameId = `trivia_${interaction.user.id}_${Date.now()}`;

    activeGames.set(gameId, { userId: interaction.user.id, cost });

    try {
      userData.coins -= cost;
      updateUser(interaction.user.id, userData);

      // Banco de preguntas
      const triviaQuestions = {
        facil: [
          { q: '🌍 ¿Cuál es el país más grande del mundo?', a: ['Rusia', 'China', 'Canadá'], correct: 0 },
          { q: '🎨 ¿De qué color es el sol?', a: ['Amarillo', 'Rojo', 'Blanco'], correct: 2 },
          { q: '🐘 ¿Cuál es el animal más grande de la tierra?', a: ['Elefante', 'Ballena azul', 'Jirafa'], correct: 1 },
          { q: '🍕 ¿De dónde es originaria la pizza?', a: ['Italia', 'Francia', 'España'], correct: 0 },
          { q: '⚽ ¿Cuántos jugadores hay en un equipo de fútbol?', a: ['11', '10', '12'], correct: 0 }
        ],
        media: [
          { q: '🏛️ ¿En qué año cayó el muro de Berlín?', a: ['1989', '1991', '1985'], correct: 0 },
          { q: '🔬 ¿Qué elemento tiene el símbolo "Au"?', a: ['Oro', 'Plata', 'Platino'], correct: 0 },
          { q: '🌊 ¿Cuál es el océano más profundo?', a: ['Pacífico', 'Atlántico', 'Índico'], correct: 0 },
          { q: '🎬 ¿Quién dirigió "Titanic"?', a: ['James Cameron', 'Steven Spielberg', 'Martin Scorsese'], correct: 0 },
          { q: '🗼 ¿En qué ciudad está la Torre Eiffel?', a: ['París', 'Londres', 'Roma'], correct: 0 }
        ],
        dificil: [
          { q: '🧬 ¿Cuántos cromosomas tiene el ser humano?', a: ['46', '48', '44'], correct: 0 },
          { q: '🎵 ¿Quién compuso "Las Cuatro Estaciones"?', a: ['Vivaldi', 'Mozart', 'Bach'], correct: 0 },
          { q: '🏛️ ¿Qué emperador romano legalizó el cristianismo?', a: ['Constantino', 'Nerón', 'Augusto'], correct: 0 },
          { q: '🔭 ¿Qué planeta tiene la mayor gravedad?', a: ['Júpiter', 'Saturno', 'Neptuno'], correct: 0 },
          { q: '📚 ¿Quién escribió "1984"?', a: ['George Orwell', 'Aldous Huxley', 'Ray Bradbury'], correct: 0 }
        ]
      };

      const questions = triviaQuestions[dificultad];
      const question = questions[Math.floor(Math.random() * questions.length)];

      const answerButtons = new ActionRowBuilder().addComponents(
        ...question.a.map((answer, idx) => 
          new ButtonBuilder()
            .setCustomId(`trivia_answer_${interaction.user.id}_${Date.now()}_${idx}_${question.correct}`)
            .setLabel(answer)
            .setStyle(ButtonStyle.Secondary)
        )
      );

      const difficultyEmoji = { facil: '😊', media: '🤔', dificil: '🔥' };

      const embed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setTitle(`🎨 Trivia ${difficultyEmoji[dificultad]} ${dificultad.toUpperCase()}`)
        .setDescription(`**${interaction.user.username}** pagó **${cost}** 🪙\n\n${question.q}`)
        .addFields({ name: '💰 Premio', value: `${prize.toLocaleString()} 🪙`, inline: true })
        .setFooter({ text: 'Tienes 60 segundos para responder' });

      await interaction.reply({ embeds: [embed], components: [answerButtons] });

      // Timeout de 60 segundos
      setTimeout(() => {
        if (activeGames.has(gameId)) {
          activeGames.delete(gameId);
          interaction.editReply({ content: '⏰ Se acabó el tiempo. Perdiste la apuesta.', embeds: [], components: [] }).catch(() => {});
        }
      }, 60000);

    } catch (error) {
      console.error('Error en trivia:', error);
      userData.coins += cost;
      updateUser(interaction.user.id, userData);
      await interaction.editReply({ content: '❌ Error en el juego. Apuesta devuelta.' });
      activeGames.delete(gameId);
    }
  }

  // BINGO - Juego Multijugador
  if (interaction.isChatInputCommand() && interaction.commandName === 'bingo') {
    const apuesta = interaction.options.getInteger('apuesta');
    const userData = getUser(interaction.user.id);

    if (userData.coins < apuesta) {
      return interaction.reply({ 
        content: `❌ No tienes suficientes monedas. Tienes: **${userData.coins.toLocaleString()}** 🪙`, 
        flags: 64 
      });
    }

    // Verificar si el usuario ya está en un juego de Bingo
    const activeCheck = hasActiveGame(interaction.user.id, 'bingo');
    if (activeCheck.hasGame) {
      return interaction.reply({ content: '❌ Ya estás en una partida de Bingo. Espera a que termine.', flags: 64 });
    }

    const gameId = `bingo_${interaction.guild.id}_${Date.now()}`;
    
    // Buscar sala de bingo activa o crear una nueva
    let bingoRoom = null;
    for (const [key, game] of activeGames.entries()) {
      if (key.startsWith('bingo_') && game.status === 'waiting' && game.guildId === interaction.guild.id) {
        bingoRoom = key;
        break;
      }
    }

    if (!bingoRoom) {
      // Crear nueva sala
      activeGames.set(gameId, {
        guildId: interaction.guild.id,
        status: 'waiting',
        players: [{ id: interaction.user.id, name: interaction.user.username, bet: apuesta, card: generateBingoCard() }],
        pot: apuesta,
        startTime: Date.now()
      });

      userData.coins -= apuesta;
      updateUser(interaction.user.id, userData);

      const joinButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`bingo_join_${gameId}`)
          .setLabel('🎟️ Unirse al Bingo')
          .setStyle(ButtonStyle.Success)
      );

      const embed = new EmbedBuilder()
        .setColor('#e91e63')
        .setTitle('🎰 Sala de Bingo Abierta')
        .setDescription(`**${interaction.user.username}** inició una partida de Bingo!\n\n💰 **Apuesta por jugador:** ${apuesta.toLocaleString()} 🪙\n👥 **Jugadores:** 1/10\n🏆 **Pozo acumulado:** ${apuesta.toLocaleString()} 🪙\n\n*Se requieren mínimo 3 jugadores*\n*El juego iniciará automáticamente a los 60 segundos*`)
        .setFooter({ text: 'Haz click abajo para unirte' });

      await interaction.reply({ embeds: [embed], components: [joinButton] });

      // Auto-start después de 60 segundos si hay suficientes jugadores
      setTimeout(async () => {
        const game = activeGames.get(gameId);
        if (game && game.status === 'waiting') {
          if (game.players.length >= 3) {
            await startBingoGame(interaction, gameId);
          } else {
            // Cancelar y devolver apuestas
            for (const player of game.players) {
              const pData = getUser(player.id);
              pData.coins += player.bet;
              updateUser(player.id, pData);
            }
            activeGames.delete(gameId);
            await interaction.editReply({ 
              content: '❌ Bingo cancelado: no se alcanzó el mínimo de 3 jugadores. Apuestas devueltas.', 
              embeds: [], 
              components: [] 
            });
          }
        }
      }, 60000);

    } else {
      // Unirse a sala existente
      const game = activeGames.get(bingoRoom);
      
      if (game.players.some(p => p.id === interaction.user.id)) {
        return interaction.reply({ content: '❌ Ya estás en esta partida de Bingo.', flags: 64 });
      }

      if (game.players.length >= 10) {
        return interaction.reply({ content: '❌ Esta sala está llena. Intenta crear una nueva.', flags: 64 });
      }

      const requiredBet = game.players[0].bet;
      if (apuesta !== requiredBet) {
        return interaction.reply({ 
          content: `❌ La apuesta de esta sala es **${requiredBet.toLocaleString()}** 🪙`, 
          flags: 64 
        });
      }

      userData.coins -= apuesta;
      updateUser(interaction.user.id, userData);

      game.players.push({ 
        id: interaction.user.id, 
        name: interaction.user.username, 
        bet: apuesta, 
        card: generateBingoCard() 
      });
      game.pot += apuesta;

      const joinButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`bingo_join_${bingoRoom}`)
          .setLabel('🎟️ Unirse al Bingo')
          .setStyle(ButtonStyle.Success)
          .setDisabled(game.players.length >= 10)
      );

      const embed = new EmbedBuilder()
        .setColor('#e91e63')
        .setTitle('🎰 Sala de Bingo')
        .setDescription(`👥 **Jugadores:** ${game.players.length}/10\n💰 **Apuesta:** ${requiredBet.toLocaleString()} 🪙\n🏆 **Pozo:** ${game.pot.toLocaleString()} 🪙\n\n**Jugadores unidos:**\n${game.players.map(p => `• ${p.name}`).join('\n')}\n\n*Se requieren mínimo 3 jugadores*`)
        .setFooter({ text: `${interaction.user.username} se unió a la partida!` });

      await interaction.reply({ content: `✅ Te uniste al Bingo! Apuesta: **${apuesta.toLocaleString()}** 🪙`, flags: 64 });
      
      // Actualizar mensaje original
      const originalMessage = await interaction.channel.messages.fetch(interaction.channel.lastMessageId).catch(() => null);
      if (originalMessage) {
        await originalMessage.edit({ embeds: [embed], components: [joinButton] });
      }

      // Si hay 10 jugadores, iniciar inmediatamente
      if (game.players.length >= 10) {
        await startBingoGame(interaction, bingoRoom);
      }
    }
  }

  // Botón Unirse a Bingo
  if (interaction.isButton() && interaction.customId.startsWith('bingo_join_')) {
    const gameId = interaction.customId.replace('bingo_join_', '');
    const game = activeGames.get(gameId);

    if (!game || game.status !== 'waiting') {
      return interaction.reply({ content: '❌ Esta sala ya no está disponible.', flags: 64 });
    }

    if (game.players.some(p => p.id === interaction.user.id)) {
      return interaction.reply({ content: '❌ Ya estás en esta partida.', flags: 64 });
    }

    if (game.players.length >= 10) {
      return interaction.reply({ content: '❌ Esta sala está llena.', flags: 64 });
    }

    // PROTECCIÓN ANTI-SPAM: Evitar múltiples joins simultáneos
    if (game.processing) {
      return interaction.reply({ content: '⏳ Espera, alguien se está uniendo...', flags: 64 });
    }
    game.processing = true;

    const userData = getUser(interaction.user.id);
    const requiredBet = game.players[0].bet;

    if (userData.coins < requiredBet) {
      return interaction.reply({ 
        content: `❌ Necesitas **${requiredBet.toLocaleString()}** 🪙 para unirte.`, 
        flags: 64 
      });
    }

    userData.coins -= requiredBet;
    updateUser(interaction.user.id, userData);

    game.players.push({ 
      id: interaction.user.id, 
      name: interaction.user.username, 
      bet: requiredBet, 
      card: generateBingoCard() 
    });
    game.pot += requiredBet;

    const joinButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`bingo_join_${gameId}`)
        .setLabel('🎟️ Unirse al Bingo')
        .setStyle(ButtonStyle.Success)
        .setDisabled(game.players.length >= 10)
    );

    const embed = new EmbedBuilder()
      .setColor('#e91e63')
      .setTitle('🎰 Sala de Bingo')
      .setDescription(`👥 **Jugadores:** ${game.players.length}/10\n💰 **Apuesta:** ${requiredBet.toLocaleString()} 🪙\n🏆 **Pozo:** ${game.pot.toLocaleString()} 🪙\n\n**Jugadores unidos:**\n${game.players.map(p => `• ${p.name}`).join('\n')}\n\n*Se requieren mínimo 3 jugadores*`)
      .setFooter({ text: `${interaction.user.username} se unió!` });

    game.processing = false; // Desbloquear para el siguiente jugador
    await interaction.update({ embeds: [embed], components: [joinButton] });

    if (game.players.length >= 10) {
      await startBingoGame(interaction, gameId);
    }
  }

  // Respuesta de Trivia
  if (interaction.isButton() && interaction.customId.startsWith('trivia_answer_')) {
    const parts = interaction.customId.split('_');
    // Format: trivia_answer_{userId}_{timestamp}_{idx}_{correct}
    const gameId = `trivia_${parts[2]}_${parts[3]}`;
    const selectedAnswer = parseInt(parts[4]);
    const correctAnswer = parseInt(parts[5]);
    const game = activeGames.get(gameId);

    if (!game) {
      return interaction.reply({ content: '❌ Este juego ya expiró.', flags: 64 });
    }

    if (interaction.user.id !== game.userId) {
      return interaction.reply({ content: '❌ Esta pregunta no es para ti.', flags: 64 });
    }

    // PROTECCIÓN ANTI-SPAM: Evitar múltiples clics simultáneos
    if (game.processing) {
      return interaction.reply({ content: '⏳ Espera... procesando tu respuesta.', flags: 64 });
    }
    game.processing = true; // Bloquear mientras se procesa

    activeGames.delete(gameId); // El lock se elimina con el juego

    const userData = getUser(interaction.user.id);
    const won = selectedAnswer === correctAnswer;
    
    // Determinar premio basado en dificultad original
    const dificultad = game.cost === 50 ? 'facil' : game.cost === 150 ? 'media' : 'dificil';
    const prizes = { facil: 150, media: 500, dificil: 1200 };
    const prize = prizes[dificultad];
    
    const winnings = won ? prize : 0;
    const bpXPRewards = { facil: 30, media: 80, dificil: 200 };
    const baseXP = won ? bpXPRewards[dificultad] : 0;
    let finalXP = 0;
    let hasBoost = false;

    userData.coins += winnings;
    userData.stats.gamesPlayed += 1;
    if (won) {
      const xpResult = addBattlePassXP(userData, baseXP);
      finalXP = xpResult.finalXP;
      hasBoost = xpResult.hasBoost;
      userData.stats.gamesWon += 1;
      userData.stats.totalWinnings += winnings;
    } else {
      userData.stats.gamesLost += 1;
      userData.stats.totalLosses += game.cost;
    }
    updateUser(interaction.user.id, userData);

    const embed = new EmbedBuilder()
      .setColor(won ? '#2ecc71' : '#e74c3c')
      .setTitle(won ? '✅ ¡Correcto!' : '❌ Incorrecto')
      .setDescription(won ? `¡Excelente ${interaction.user.username}! Respondiste correctamente.` : `Lo siento ${interaction.user.username}, esa no era la respuesta correcta.`)
      .addFields(
        { name: won ? '💰 Ganaste' : '💸 Perdiste', value: `${won ? '+' : '-'}${(won ? winnings - game.cost : game.cost).toLocaleString()} 🪙`, inline: true },
        { name: '💼 Nuevo Balance', value: `${userData.coins.toLocaleString()} 🪙`, inline: true },
        ...(won ? [{ name: '⭐ XP Ganado', value: `+${finalXP} XP${hasBoost ? ' 🔥' : ''}`, inline: true }] : [])
      )
      .setFooter({ text: 'Ea$y Esports Trivia' })
      .setTimestamp();

    await interaction.update({ embeds: [embed], components: [] });
  }

  // ========== FASE 2: ECONOMÍA AVANZADA ==========
  
  // Sistema de precios de acciones (cambian cada hora basado en la hora actual)
  function getStockPrices() {
    const hour = new Date().getHours();
    const day = new Date().getDate();
    const seed = hour + day * 24; // Cambia cada hora
    
    const baseRandom = (id) => {
      let hash = 0;
      const str = id + seed;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash;
      }
      return Math.abs(hash % 100) / 100;
    };

    return {
      'ea$y': Math.floor(500 + baseRandom('easy') * 1000), // 500-1500
      'techcorp': Math.floor(800 + baseRandom('tech') * 1200), // 800-2000
      'foodchain': Math.floor(300 + baseRandom('food') * 700), // 300-1000
      'automax': Math.floor(1000 + baseRandom('auto') * 2000) // 1000-3000
    };
  }

  // Datos de negocios disponibles
  const businessesData = [
    { id: 'lemonade', name: '🍋 Puesto de Limonada', cost: 5000, income: 50, time: 1 },
    { id: 'food_truck', name: '🌮 Food Truck', cost: 25000, income: 300, time: 2 },
    { id: 'cafe', name: '☕ Café', cost: 75000, income: 1000, time: 3 },
    { id: 'restaurant', name: '🍽️ Restaurante', cost: 200000, income: 3000, time: 4 },
    { id: 'gym', name: '🏋️ Gimnasio', cost: 500000, income: 8000, time: 6 },
    { id: 'nightclub', name: '🎪 Club Nocturno', cost: 1500000, income: 25000, time: 8 },
    { id: 'casino', name: '🎰 Casino', cost: 5000000, income: 100000, time: 12 }
  ];

  // COMPRAR NEGOCIO
  if (interaction.isChatInputCommand() && interaction.commandName === 'comprar-negocio') {
    const businessId = interaction.options.getString('negocio');
    const userData = getUser(interaction.user.id);
    
    const business = businessesData.find(b => b.id === businessId);
    if (!business) {
      return interaction.reply({ content: '❌ Negocio no válido.', flags: 64 });
    }

    if (userData.coins < business.cost) {
      return interaction.reply({ 
        content: `❌ No tienes suficientes monedas. Necesitas: **${business.cost.toLocaleString()}** 🪙`, 
        flags: 64 
      });
    }

    // Verificar si ya tiene este negocio
    if (userData.businesses.some(b => b.id === businessId)) {
      return interaction.reply({ content: '❌ Ya tienes este negocio.', flags: 64 });
    }

    userData.coins -= business.cost;
    userData.businesses.push({
      id: businessId,
      name: business.name,
      income: business.income,
      time: business.time,
      purchaseDate: Date.now()
    });
    updateUser(interaction.user.id, userData);

    const embed = new EmbedBuilder()
      .setColor('#2ecc71')
      .setTitle('🏢 Negocio Comprado')
      .setDescription(`¡Felicitaciones **${interaction.user.username}**!\n\nCompraste: **${business.name}**`)
      .addFields(
        { name: '💰 Costo', value: `${business.cost.toLocaleString()} 🪙`, inline: true },
        { name: '📈 Ingreso', value: `${business.income.toLocaleString()} 🪙 cada ${business.time}h`, inline: true },
        { name: '💼 Balance', value: `${userData.coins.toLocaleString()} 🪙`, inline: true }
      )
      .setFooter({ text: 'Usa /cobrar-negocios para reclamar tus ganancias' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // MIS NEGOCIOS
  if (interaction.isChatInputCommand() && interaction.commandName === 'mis-negocios') {
    const userData = getUser(interaction.user.id);

    if (userData.businesses.length === 0) {
      return interaction.reply({ 
        content: '❌ No tienes ningún negocio. Usa `/comprar-negocio` para empezar.', 
        flags: 64 
      });
    }

    const now = Date.now();
    const timeSinceLastClaim = now - userData.lastBusinessClaim;
    
    let totalPending = 0;
    const businessList = userData.businesses.map(b => {
      const hoursPassed = Math.floor(timeSinceLastClaim / (1000 * 60 * 60));
      const cyclesComplete = Math.floor(hoursPassed / b.time);
      const pendingIncome = cyclesComplete * b.income;
      totalPending += pendingIncome;
      
      return `**${b.name}**\n💰 Genera: ${b.income.toLocaleString()} 🪙 cada ${b.time}h\n💸 Pendiente: ${pendingIncome.toLocaleString()} 🪙`;
    }).join('\n\n');

    const embed = new EmbedBuilder()
      .setColor('#3498db')
      .setTitle('🏢 Mis Negocios')
      .setDescription(`**${interaction.user.username}**, estos son tus negocios:\n\n${businessList}`)
      .addFields({ name: '💰 Total Pendiente', value: `${totalPending.toLocaleString()} 🪙` })
      .setFooter({ text: 'Usa /cobrar-negocios para reclamar tus ganancias' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // COBRAR NEGOCIOS
  if (interaction.isChatInputCommand() && interaction.commandName === 'cobrar-negocios') {
    const userData = getUser(interaction.user.id);

    if (userData.businesses.length === 0) {
      return interaction.reply({ 
        content: '❌ No tienes ningún negocio.', 
        flags: 64 
      });
    }

    const now = Date.now();
    const timeSinceLastClaim = now - (userData.lastBusinessClaim || userData.businesses[0].purchaseDate);
    const hoursPassed = Math.floor(timeSinceLastClaim / (1000 * 60 * 60));

    if (hoursPassed < 1) {
      const minutesLeft = 60 - Math.floor((timeSinceLastClaim % (1000 * 60 * 60)) / (1000 * 60));
      return interaction.reply({ 
        content: `⏰ Debes esperar **${minutesLeft} minutos** antes de cobrar nuevamente.`, 
        flags: 64 
      });
    }

    let totalEarned = 0;
    const earnings = userData.businesses.map(b => {
      const cyclesComplete = Math.floor(hoursPassed / b.time);
      const earned = cyclesComplete * b.income;
      totalEarned += earned;
      return `${b.name}: **${earned.toLocaleString()}** 🪙`;
    }).join('\n');

    userData.coins += totalEarned;
    userData.lastBusinessClaim = now;
    updateUser(interaction.user.id, userData);

    const embed = new EmbedBuilder()
      .setColor('#2ecc71')
      .setTitle('💰 Ganancias Cobradas')
      .setDescription(`**${interaction.user.username}** cobró sus negocios:\n\n${earnings}`)
      .addFields(
        { name: '💸 Total Ganado', value: `${totalEarned.toLocaleString()} 🪙`, inline: true },
        { name: '💼 Nuevo Balance', value: `${userData.coins.toLocaleString()} 🪙`, inline: true }
      )
      .setFooter({ text: `Tiempo transcurrido: ${hoursPassed} horas` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // COMPRAR ACCIONES
  if (interaction.isChatInputCommand() && interaction.commandName === 'comprar-acciones') {
    const company = interaction.options.getString('empresa');
    const amount = interaction.options.getInteger('cantidad');
    const userData = getUser(interaction.user.id);

    const stockPrices = getStockPrices();
    const price = stockPrices[company];
    const totalCost = price * amount;

    if (userData.coins < totalCost) {
      return interaction.reply({ 
        content: `❌ No tienes suficientes monedas. Necesitas: **${totalCost.toLocaleString()}** 🪙`, 
        flags: 64 
      });
    }

    userData.coins -= totalCost;
    if (!userData.stocks[company]) userData.stocks[company] = 0;
    userData.stocks[company] += amount;
    updateUser(interaction.user.id, userData);

    const companyNames = {
      'ea$y': '🎮 Ea$y Esports',
      'techcorp': '💻 TechCorp',
      'foodchain': '🍔 FoodChain',
      'automax': '🚗 AutoMax'
    };

    const embed = new EmbedBuilder()
      .setColor('#9b59b6')
      .setTitle('📈 Acciones Compradas')
      .setDescription(`**${interaction.user.username}** compró acciones!\n\n**Empresa:** ${companyNames[company]}\n**Cantidad:** ${amount} acciones\n**Precio unitario:** ${price.toLocaleString()} 🪙`)
      .addFields(
        { name: '💸 Total Pagado', value: `${totalCost.toLocaleString()} 🪙`, inline: true },
        { name: '💼 Balance', value: `${userData.coins.toLocaleString()} 🪙`, inline: true },
        { name: '📊 Total en esta empresa', value: `${userData.stocks[company]} acciones`, inline: true }
      )
      .setFooter({ text: 'Los precios cambian cada hora' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // VENDER ACCIONES
  if (interaction.isChatInputCommand() && interaction.commandName === 'vender-acciones') {
    const company = interaction.options.getString('empresa');
    const amount = interaction.options.getInteger('cantidad');
    const userData = getUser(interaction.user.id);

    if (!userData.stocks[company] || userData.stocks[company] < amount) {
      return interaction.reply({ 
        content: `❌ No tienes suficientes acciones de esta empresa.`, 
        flags: 64 
      });
    }

    const stockPrices = getStockPrices();
    const price = stockPrices[company];
    const totalEarned = price * amount;

    userData.coins += totalEarned;
    userData.stocks[company] -= amount;
    if (userData.stocks[company] === 0) delete userData.stocks[company];
    updateUser(interaction.user.id, userData);

    const companyNames = {
      'ea$y': '🎮 Ea$y Esports',
      'techcorp': '💻 TechCorp',
      'foodchain': '🍔 FoodChain',
      'automax': '🚗 AutoMax'
    };

    const embed = new EmbedBuilder()
      .setColor('#e67e22')
      .setTitle('📉 Acciones Vendidas')
      .setDescription(`**${interaction.user.username}** vendió acciones!\n\n**Empresa:** ${companyNames[company]}\n**Cantidad:** ${amount} acciones\n**Precio unitario:** ${price.toLocaleString()} 🪙`)
      .addFields(
        { name: '💰 Total Recibido', value: `${totalEarned.toLocaleString()} 🪙`, inline: true },
        { name: '💼 Nuevo Balance', value: `${userData.coins.toLocaleString()} 🪙`, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // VER ACCIONES (Mercado)
  if (interaction.isChatInputCommand() && interaction.commandName === 'ver-acciones') {
    const userData = getUser(interaction.user.id);
    const stockPrices = getStockPrices();

    const companyNames = {
      'ea$y': '🎮 Ea$y Esports',
      'techcorp': '💻 TechCorp',
      'foodchain': '🍔 FoodChain',
      'automax': '🚗 AutoMax'
    };

    const marketList = Object.entries(stockPrices).map(([id, price]) => {
      const owned = userData.stocks[id] || 0;
      const value = owned * price;
      return `**${companyNames[id]}**\n💰 Precio: ${price.toLocaleString()} 🪙\n📊 Tienes: ${owned} acciones (${value.toLocaleString()} 🪙)`;
    }).join('\n\n');

    const totalValue = Object.entries(userData.stocks).reduce((sum, [company, amount]) => {
      return sum + (amount * stockPrices[company]);
    }, 0);

    const embed = new EmbedBuilder()
      .setColor('#3498db')
      .setTitle('📈 Mercado de Acciones')
      .setDescription(`**Precios actuales:**\n\n${marketList}`)
      .addFields({ name: '💼 Valor Total de tus Acciones', value: `${totalValue.toLocaleString()} 🪙` })
      .setFooter({ text: 'Los precios cambian cada hora • Usa /comprar-acciones o /vender-acciones' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // PROPIEDADES - Sistema de prestigio
  const propertiesData = [
    { id: 'bicycle', name: '🚲 Bicicleta', cost: 1000, emoji: '🚲', category: 'Vehículo' },
    { id: 'motorcycle', name: '🏍️ Motocicleta', cost: 15000, emoji: '🏍️', category: 'Vehículo' },
    { id: 'car', name: '🚗 Auto', cost: 50000, emoji: '🚗', category: 'Vehículo' },
    { id: 'sportscar', name: '🏎️ Auto Deportivo', cost: 250000, emoji: '🏎️', category: 'Vehículo' },
    { id: 'apartment', name: '🏢 Apartamento', cost: 100000, emoji: '🏢', category: 'Propiedad' },
    { id: 'house', name: '🏠 Casa', cost: 500000, emoji: '🏠', category: 'Propiedad' },
    { id: 'mansion', name: '🏰 Mansión', cost: 2000000, emoji: '🏰', category: 'Propiedad' },
    { id: 'yacht', name: '🛥️ Yate', cost: 5000000, emoji: '🛥️', category: 'Lujo' },
    { id: 'helicopter', name: '🚁 Helicóptero', cost: 10000000, emoji: '🚁', category: 'Lujo' },
    { id: 'island', name: '🏝️ Isla Privada', cost: 50000000, emoji: '🏝️', category: 'Lujo' }
  ];

  // COMPRAR PROPIEDAD
  if (interaction.isChatInputCommand() && interaction.commandName === 'comprar-propiedad') {
    const propertyId = interaction.options.getString('propiedad');
    const userData = getUser(interaction.user.id);
    
    const property = propertiesData.find(p => p.id === propertyId);
    if (!property) {
      return interaction.reply({ content: '❌ Propiedad no válida.', flags: 64 });
    }

    if (userData.coins < property.cost) {
      return interaction.reply({ 
        content: `❌ No tienes suficientes monedas. Necesitas: **${property.cost.toLocaleString()}** 🪙`, 
        flags: 64 
      });
    }

    if (userData.properties.includes(propertyId)) {
      return interaction.reply({ content: '❌ Ya tienes esta propiedad.', flags: 64 });
    }

    userData.coins -= property.cost;
    userData.properties.push(propertyId);
    updateUser(interaction.user.id, userData);

    const embed = new EmbedBuilder()
      .setColor('#f39c12')
      .setTitle('🏆 Propiedad Adquirida')
      .setDescription(`¡Felicitaciones **${interaction.user.username}**!\n\n${property.emoji} Compraste: **${property.name}**`)
      .addFields(
        { name: '💰 Costo', value: `${property.cost.toLocaleString()} 🪙`, inline: true },
        { name: '📁 Categoría', value: property.category, inline: true },
        { name: '💼 Balance', value: `${userData.coins.toLocaleString()} 🪙`, inline: true }
      )
      .setFooter({ text: 'Las propiedades son items de prestigio que puedes mostrar' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // MIS PROPIEDADES
  if (interaction.isChatInputCommand() && interaction.commandName === 'mis-propiedades') {
    const userData = getUser(interaction.user.id);

    if (userData.properties.length === 0) {
      return interaction.reply({ 
        content: '❌ No tienes propiedades. Usa `/comprar-propiedad` para adquirir una.', 
        flags: 64 
      });
    }

    const ownedProperties = userData.properties.map(propId => {
      const prop = propertiesData.find(p => p.id === propId);
      return `${prop.emoji} **${prop.name}** - ${prop.category}`;
    }).join('\n');

    const totalValue = userData.properties.reduce((sum, propId) => {
      const prop = propertiesData.find(p => p.id === propId);
      return sum + prop.cost;
    }, 0);

    const embed = new EmbedBuilder()
      .setColor('#f39c12')
      .setTitle('🏆 Mis Propiedades')
      .setDescription(`**${interaction.user.username}**, estas son tus propiedades:\n\n${ownedProperties}`)
      .addFields({ name: '💰 Valor Total', value: `${totalValue.toLocaleString()} 🪙` })
      .setFooter({ text: `Total de propiedades: ${userData.properties.length}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // CRIPTO - Sistema de trading realista (estilo Altcoin)
  function getCryptoPrice() {
    const now = Date.now();
    const hour = new Date().getHours();
    const minute = new Date().getMinutes();
    const day = new Date().getDate();
    
    // Precio base que cambia cada minuto (5,000 - 150,000)
    const seed = hour * 60 + minute + day * 1440;
    const baseRandom = Math.abs(Math.sin(seed) * 10000) % 100;
    let price = Math.floor(5000 + baseRandom * 1450); // 5,000 - 150,000
    
    // Tendencia diaria (alcista o bajista según el día)
    const trendSeed = day * 7;
    const trend = Math.sin(trendSeed) * 0.15; // ±15% de tendencia
    price = Math.floor(price * (1 + trend));
    
    // Eventos aleatorios (5% de probabilidad cada minuto)
    const eventSeed = Math.abs(Math.sin(seed * 2) * 10000) % 100;
    let eventMessage = null;
    
    if (eventSeed < 2) { // 2% Pump masivo
      price = Math.floor(price * 1.4); // +40%
      eventMessage = '🚀 ¡PUMP! Ballenas comprando EasyCoin';
    } else if (eventSeed < 4) { // 2% Crash
      price = Math.floor(price * 0.7); // -30%
      eventMessage = '💥 ¡CRASH! Venta masiva en el mercado';
    } else if (eventSeed < 6) { // 2% Noticia positiva
      price = Math.floor(price * 1.2); // +20%
      eventMessage = '📰 Noticia: Ea$y Esports adoptará EasyCoin oficialmente';
    } else if (eventSeed < 8) { // 2% FUD
      price = Math.floor(price * 0.85); // -15%
      eventMessage = '⚠️ FUD: Rumores de regulación cripto';
    } else if (eventSeed < 9) { // 1% Elon Tweet
      price = Math.floor(price * 1.5); // +50%
      eventMessage = '🐦 Elon tuiteó sobre EasyCoin';
    }
    
    // Asegurar que no baje del mínimo ni supere el máximo
    price = Math.max(5000, Math.min(150000, price));
    
    return { price, event: eventMessage };
  }

  // COMPRAR CRIPTO
  if (interaction.isChatInputCommand() && interaction.commandName === 'comprar-cripto') {
    const amount = interaction.options.getInteger('cantidad');
    const userData = getUser(interaction.user.id);

    const cryptoData = getCryptoPrice();
    const price = cryptoData.price;
    const totalCost = price * amount;

    if (userData.coins < totalCost) {
      return interaction.reply({ 
        content: `❌ No tienes suficientes monedas. Necesitas: **${totalCost.toLocaleString()}** 🪙`, 
        flags: 64 
      });
    }

    const confirmEmbed = new EmbedBuilder()
      .setColor('#f39c12')
      .setTitle('₿ Confirmar Compra de EasyCoin')
      .setDescription(`**Precio ACTUAL:** ${price.toLocaleString()} 🪙 por EasyCoin${cryptoData.event ? '\n\n' + cryptoData.event : ''}\n\n**Vas a comprar:** ${amount} EasyCoins\n**Total a pagar:** ${totalCost.toLocaleString()} 🪙`)
      .addFields(
        { name: '💼 Tu Balance', value: `${userData.coins.toLocaleString()} 🪙`, inline: true },
        { name: '💸 Después de comprar', value: `${(userData.coins - totalCost).toLocaleString()} 🪙`, inline: true },
        { name: '₿ Tendrás', value: `${userData.crypto.easycoins + amount} ₿`, inline: true }
      )
      .setFooter({ text: '⚠️ El precio puede cambiar después de esta confirmación' })
      .setTimestamp();

    const confirmButton = new ButtonBuilder()
      .setCustomId(`confirm_buy_crypto_${amount}`)
      .setLabel('✅ Confirmar Compra')
      .setStyle(ButtonStyle.Success);

    const cancelButton = new ButtonBuilder()
      .setCustomId('cancel_buy_crypto')
      .setLabel('❌ Cancelar')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

    await interaction.reply({ embeds: [confirmEmbed], components: [row] });
  }

  // CONFIRMAR COMPRA CRIPTO
  if (interaction.isButton() && interaction.customId.startsWith('confirm_buy_crypto_')) {
    const amount = parseInt(interaction.customId.split('_')[3]);
    const gameId = `crypto_buy_${interaction.user.id}_${amount}`;
    
    // PROTECCIÓN ANTI-SPAM: Usar gameId temporal para evitar doble compra
    if (activeGames.has(gameId)) {
      return interaction.reply({ content: '⏳ Espera... procesando tu compra anterior.', flags: 64 });
    }
    activeGames.set(gameId, { userId: interaction.user.id, processing: true });

    const userData = getUser(interaction.user.id);

    const cryptoData = getCryptoPrice();
    const price = cryptoData.price;
    const totalCost = price * amount;

    if (userData.coins < totalCost) {
      activeGames.delete(gameId);
      return interaction.update({ 
        content: `❌ Ya no tienes suficientes monedas. El precio cambió a **${price.toLocaleString()}** 🪙 y necesitas: **${totalCost.toLocaleString()}** 🪙`, 
        embeds: [],
        components: []
      });
    }

    userData.coins -= totalCost;
    userData.crypto.easycoins += amount;
    updateUser(interaction.user.id, userData);

    const embed = new EmbedBuilder()
      .setColor('#16a085')
      .setTitle('✅ EasyCoin Comprado')
      .setDescription(`**${interaction.user.username}** compró criptomonedas!\n\n**Cantidad:** ${amount} EasyCoins\n**Precio final:** ${price.toLocaleString()} 🪙 por EasyCoin${cryptoData.event ? '\n\n' + cryptoData.event : ''}`)
      .addFields(
        { name: '💸 Total Pagado', value: `${totalCost.toLocaleString()} 🪙`, inline: true },
        { name: '💼 Nuevo Balance', value: `${userData.coins.toLocaleString()} 🪙`, inline: true },
        { name: '₿ Total EasyCoins', value: `${userData.crypto.easycoins} ₿`, inline: true }
      )
      .setFooter({ text: '⚡ Precio cambia cada minuto | Rango: 5K-150K 🪙' })
      .setTimestamp();

    activeGames.delete(gameId); // Eliminar lock
    await interaction.update({ embeds: [embed], components: [] });
  }

  // CANCELAR COMPRA CRIPTO
  if (interaction.isButton() && interaction.customId === 'cancel_buy_crypto') {
    await interaction.update({ 
      content: '❌ Compra cancelada. Usa `/mercado-cripto` para ver el precio actual.', 
      embeds: [], 
      components: [] 
    });
  }

  // VENDER CRIPTO
  if (interaction.isChatInputCommand() && interaction.commandName === 'vender-cripto') {
    const amount = interaction.options.getInteger('cantidad');
    const userData = getUser(interaction.user.id);

    if (userData.crypto.easycoins < amount) {
      return interaction.reply({ 
        content: `❌ No tienes suficientes EasyCoins. Tienes: **${userData.crypto.easycoins}** ₿`, 
        flags: 64 
      });
    }

    const cryptoData = getCryptoPrice();
    const price = cryptoData.price;
    const totalEarned = price * amount;

    const confirmEmbed = new EmbedBuilder()
      .setColor('#f39c12')
      .setTitle('₿ Confirmar Venta de EasyCoin')
      .setDescription(`**Precio ACTUAL:** ${price.toLocaleString()} 🪙 por EasyCoin${cryptoData.event ? '\n\n' + cryptoData.event : ''}\n\n**Vas a vender:** ${amount} EasyCoins\n**Total a recibir:** ${totalEarned.toLocaleString()} 🪙`)
      .addFields(
        { name: '₿ Tus EasyCoins', value: `${userData.crypto.easycoins} ₿`, inline: true },
        { name: '₿ Después de vender', value: `${userData.crypto.easycoins - amount} ₿`, inline: true },
        { name: '💰 Tendrás', value: `${(userData.coins + totalEarned).toLocaleString()} 🪙`, inline: true }
      )
      .setFooter({ text: '⚠️ El precio puede cambiar después de esta confirmación' })
      .setTimestamp();

    const confirmButton = new ButtonBuilder()
      .setCustomId(`confirm_sell_crypto_${amount}`)
      .setLabel('✅ Confirmar Venta')
      .setStyle(ButtonStyle.Success);

    const cancelButton = new ButtonBuilder()
      .setCustomId('cancel_sell_crypto')
      .setLabel('❌ Cancelar')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

    await interaction.reply({ embeds: [confirmEmbed], components: [row] });
  }

  // CONFIRMAR VENTA CRIPTO
  if (interaction.isButton() && interaction.customId.startsWith('confirm_sell_crypto_')) {
    const amount = parseInt(interaction.customId.split('_')[3]);
    const gameId = `crypto_sell_${interaction.user.id}_${amount}`;
    
    // PROTECCIÓN ANTI-SPAM: Usar gameId temporal para evitar doble venta
    if (activeGames.has(gameId)) {
      return interaction.reply({ content: '⏳ Espera... procesando tu venta anterior.', flags: 64 });
    }
    activeGames.set(gameId, { userId: interaction.user.id, processing: true });

    const userData = getUser(interaction.user.id);

    if (userData.crypto.easycoins < amount) {
      activeGames.delete(gameId);
      return interaction.update({ 
        content: `❌ Ya no tienes suficientes EasyCoins. Tienes: **${userData.crypto.easycoins}** ₿`, 
        embeds: [],
        components: []
      });
    }

    const cryptoData = getCryptoPrice();
    const price = cryptoData.price;
    const totalEarned = price * amount;

    userData.coins += totalEarned;
    userData.crypto.easycoins -= amount;
    updateUser(interaction.user.id, userData);

    const embed = new EmbedBuilder()
      .setColor('#27ae60')
      .setTitle('✅ EasyCoin Vendido')
      .setDescription(`**${interaction.user.username}** vendió criptomonedas!\n\n**Cantidad:** ${amount} EasyCoins\n**Precio final:** ${price.toLocaleString()} 🪙 por EasyCoin${cryptoData.event ? '\n\n' + cryptoData.event : ''}`)
      .addFields(
        { name: '💰 Total Recibido', value: `${totalEarned.toLocaleString()} 🪙`, inline: true },
        { name: '💼 Nuevo Balance', value: `${userData.coins.toLocaleString()} 🪙`, inline: true },
        { name: '₿ EasyCoins restantes', value: `${userData.crypto.easycoins} ₿`, inline: true }
      )
      .setFooter({ text: '⚡ Precio cambia cada minuto | Rango: 5K-150K 🪙' })
      .setTimestamp();

    activeGames.delete(gameId); // Eliminar lock
    await interaction.update({ embeds: [embed], components: [] });
  }

  // CANCELAR VENTA CRIPTO
  if (interaction.isButton() && interaction.customId === 'cancel_sell_crypto') {
    await interaction.update({ 
      content: '❌ Venta cancelada. Usa `/mercado-cripto` para ver el precio actual.', 
      embeds: [], 
      components: [] 
    });
  }

  // MERCADO CRIPTO
  if (interaction.isChatInputCommand() && interaction.commandName === 'mercado-cripto') {
    const userData = getUser(interaction.user.id);
    const cryptoData = getCryptoPrice();
    const price = cryptoData.price;
    const portfolioValue = userData.crypto.easycoins * price;

    // Simular gráfica de tendencia (últimos 60 minutos)
    const trend = [];
    for (let i = 5; i >= 0; i--) {
      const pastMinutes = (new Date().getHours() * 60 + new Date().getMinutes()) - i * 10;
      const pastDay = Math.floor((Date.now() - i * 10 * 60 * 1000) / (1000 * 60 * 60 * 24));
      const pastTrend = Math.sin(pastDay * 0.5) * 0.15;
      const pastVolatility = Math.abs(Math.sin(pastMinutes * 17) * Math.cos(pastMinutes * 13));
      const pastPrice = Math.floor(50000 + (50000 * pastVolatility) + (100000 * pastTrend));
      trend.push(pastPrice);
    }
    
    const trendEmoji = trend[5] > trend[0] ? '📈' : trend[5] < trend[0] ? '📉' : '➡️';
    const trendText = trend.map((p, i) => i === 5 ? `**${(p/1000).toFixed(1)}K**` : `${(p/1000).toFixed(1)}K`).join(' → ');
    
    // Calcular 24h high/low simulado
    const high24h = Math.max(...trend);
    const low24h = Math.min(...trend);

    const embed = new EmbedBuilder()
      .setColor(trendEmoji === '📈' ? '#27ae60' : trendEmoji === '📉' ? '#e74c3c' : '#95a5a6')
      .setTitle('₿ Mercado de EasyCoin')
      .setDescription(`**Precio actual:** ${price.toLocaleString()} 🪙 ${trendEmoji}${cryptoData.event ? '\n\n' + cryptoData.event : ''}\n\n**Tendencia (últimos 60 min):**\n${trendText}`)
      .addFields(
        { name: '📊 24h High', value: `${high24h.toLocaleString()} 🪙`, inline: true },
        { name: '📊 24h Low', value: `${low24h.toLocaleString()} 🪙`, inline: true },
        { name: '📊 Variación 24h', value: `${((high24h - low24h) / low24h * 100).toFixed(1)}%`, inline: true },
        { name: '₿ Tus EasyCoins', value: `${userData.crypto.easycoins} ₿`, inline: true },
        { name: '💰 Valor del Portafolio', value: `${portfolioValue.toLocaleString()} 🪙`, inline: true },
        { name: '💼 Balance en Wallet', value: `${userData.coins.toLocaleString()} 🪙`, inline: true }
      )
      .setFooter({ text: '⚠️ Alta volatilidad - Rango: 5K-150K 🪙 | Precio cambia cada minuto' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // ========== FASE 3: SISTEMA RPG ==========
  
  // Datos de clases RPG
  const classesData = {
    warrior: {
      name: 'Guerrero',
      emoji: '⚔️',
      description: 'Maestro del combate cuerpo a cuerpo',
      stats: { atk: 20, def: 15, magic: 5, speed: 8, luck: 7 },
      hp: 150,
      mp: 30
    },
    mage: {
      name: 'Mago',
      emoji: '🔮',
      description: 'Domina las artes arcanas',
      stats: { atk: 8, def: 7, magic: 25, speed: 10, luck: 10 },
      hp: 80,
      mp: 120
    },
    rogue: {
      name: 'Ladrón',
      emoji: '🗡️',
      description: 'Ágil y preciso con alta probabilidad crítica',
      stats: { atk: 15, def: 10, magic: 8, speed: 20, luck: 20 },
      hp: 100,
      mp: 50
    }
  };

  // Datos de equipamiento
  const equipmentData = {
    weapons: [
      { id: 'wood_sword', name: '🗡️ Espada de Madera', cost: 500, stats: { atk: 5 } },
      { id: 'iron_sword', name: '⚔️ Espada de Hierro', cost: 2500, stats: { atk: 15 } },
      { id: 'steel_sword', name: '🗡️ Espada de Acero', cost: 10000, stats: { atk: 30 } },
      { id: 'magic_staff', name: '🪄 Bastón Mágico', cost: 3000, stats: { magic: 20 } },
      { id: 'arcane_staff', name: '🔮 Bastón Arcano', cost: 12000, stats: { magic: 40 } },
      { id: 'dagger', name: '🔪 Daga Rápida', cost: 2000, stats: { speed: 10, luck: 10 } },
      { id: 'legendary_blade', name: '⚡ Hoja Legendaria', cost: 50000, stats: { atk: 50, speed: 20 } }
    ],
    armor: [
      { id: 'leather_armor', name: '🛡️ Armadura de Cuero', cost: 800, stats: { def: 10 } },
      { id: 'iron_armor', name: '🛡️ Armadura de Hierro', cost: 4000, stats: { def: 25 } },
      { id: 'magic_robe', name: '👘 Túnica Mágica', cost: 5000, stats: { magic: 15, mp: 30 } },
      { id: 'dragon_armor', name: '🐉 Armadura de Dragón', cost: 60000, stats: { def: 50, hp: 50 } }
    ],
    accessories: [
      { id: 'lucky_charm', name: '🍀 Amuleto de Suerte', cost: 1500, stats: { luck: 15 } },
      { id: 'speed_boots', name: '👟 Botas de Velocidad', cost: 3500, stats: { speed: 20 } },
      { id: 'power_ring', name: '💍 Anillo de Poder', cost: 8000, stats: { atk: 20, magic: 20 } }
    ]
  };

  // ELEGIR CLASE
  if (interaction.isChatInputCommand() && interaction.commandName === 'elegir-clase') {
    const classId = interaction.options.getString('clase');
    const userData = getUser(interaction.user.id);

    if (userData.rpg.class) {
      return interaction.reply({ 
        content: `❌ Ya eres un **${classesData[userData.rpg.class].emoji} ${classesData[userData.rpg.class].name}**. No puedes cambiar de clase.`, 
        flags: 64 
      });
    }

    const selectedClass = classesData[classId];
    userData.rpg.class = classId;
    userData.rpg.stats = { ...selectedClass.stats };
    userData.rpg.maxHp = selectedClass.hp;
    userData.rpg.hp = selectedClass.hp;
    userData.rpg.maxMp = selectedClass.mp;
    userData.rpg.mp = selectedClass.mp;
    updateUser(interaction.user.id, userData);

    const embed = new EmbedBuilder()
      .setColor('#9b59b6')
      .setTitle('⚔️ Clase Seleccionada')
      .setDescription(`**${interaction.user.username}** ahora es un **${selectedClass.emoji} ${selectedClass.name}**!\n\n*${selectedClass.description}*`)
      .addFields(
        { name: '❤️ HP', value: `${selectedClass.hp}`, inline: true },
        { name: '💙 MP', value: `${selectedClass.mp}`, inline: true },
        { name: '⚡ Nivel', value: '1', inline: true },
        { name: '📊 Stats Base', value: `ATK: ${selectedClass.stats.atk} | DEF: ${selectedClass.stats.def}\nMAGIC: ${selectedClass.stats.magic} | SPD: ${selectedClass.stats.speed}\nLUCK: ${selectedClass.stats.luck}`, inline: false }
      )
      .setFooter({ text: 'Usa /comprar-equipo para mejorar tus stats' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // PERFIL RPG
  if (interaction.isChatInputCommand() && interaction.commandName === 'perfil-rpg') {
    const userData = getUser(interaction.user.id);

    if (!userData.rpg.class) {
      return interaction.reply({ 
        content: '❌ No has elegido una clase. Usa `/elegir-clase` primero.', 
        flags: 64 
      });
    }

    const classInfo = classesData[userData.rpg.class];
    const totalStats = { ...userData.rpg.stats };

    // Calcular stats de equipamiento
    const equipment = userData.rpg.equipment;
    if (equipment.weapon) {
      const weapon = [...equipmentData.weapons, ...equipmentData.armor, ...equipmentData.accessories].find(e => e.id === equipment.weapon);
      if (weapon) {
        Object.keys(weapon.stats).forEach(stat => {
          totalStats[stat] = (totalStats[stat] || 0) + weapon.stats[stat];
        });
      }
    }
    if (equipment.armor) {
      const armor = [...equipmentData.weapons, ...equipmentData.armor, ...equipmentData.accessories].find(e => e.id === equipment.armor);
      if (armor) {
        Object.keys(armor.stats).forEach(stat => {
          totalStats[stat] = (totalStats[stat] || 0) + armor.stats[stat];
        });
      }
    }
    if (equipment.accessory) {
      const accessory = [...equipmentData.weapons, ...equipmentData.armor, ...equipmentData.accessories].find(e => e.id === equipment.accessory);
      if (accessory) {
        Object.keys(accessory.stats).forEach(stat => {
          totalStats[stat] = (totalStats[stat] || 0) + accessory.stats[stat];
        });
      }
    }

    const xpNeeded = userData.rpg.level * 100;
    const equipList = [
      equipment.weapon ? `Arma: ${[...equipmentData.weapons].find(e => e.id === equipment.weapon)?.name || 'Ninguna'}` : 'Arma: Ninguna',
      equipment.armor ? `Armadura: ${[...equipmentData.armor].find(e => e.id === equipment.armor)?.name || 'Ninguna'}` : 'Armadura: Ninguna',
      equipment.accessory ? `Accesorio: ${[...equipmentData.accessories].find(e => e.id === equipment.accessory)?.name || 'Ninguno'}` : 'Accesorio: Ninguno'
    ].join('\n');

    const embed = new EmbedBuilder()
      .setColor('#9b59b6')
      .setTitle(`${classInfo.emoji} Perfil RPG - ${interaction.user.username}`)
      .setDescription(`**Clase:** ${classInfo.name}\n**Nivel:** ${userData.rpg.level} (${userData.rpg.xp}/${xpNeeded} XP)`)
      .addFields(
        { name: '❤️ HP', value: `${userData.rpg.hp}/${userData.rpg.maxHp}`, inline: true },
        { name: '💙 MP', value: `${userData.rpg.mp}/${userData.rpg.maxMp}`, inline: true },
        { name: '🏆 Bosses', value: `${userData.rpg.bossesDefeated}`, inline: true },
        { name: '📊 Stats Totales', value: `ATK: ${totalStats.atk} | DEF: ${totalStats.def}\nMAGIC: ${totalStats.magic} | SPD: ${totalStats.speed}\nLUCK: ${totalStats.luck}`, inline: false },
        { name: '⚔️ Equipamiento', value: equipList, inline: false }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // COMPRAR EQUIPO
  if (interaction.isChatInputCommand() && interaction.commandName === 'comprar-equipo') {
    const itemId = interaction.options.getString('item');
    const userData = getUser(interaction.user.id);

    if (!userData.rpg.class) {
      return interaction.reply({ 
        content: '❌ Necesitas elegir una clase primero. Usa `/elegir-clase`.', 
        flags: 64 
      });
    }

    const allItems = [...equipmentData.weapons, ...equipmentData.armor, ...equipmentData.accessories];
    const item = allItems.find(i => i.id === itemId);

    if (!item) {
      return interaction.reply({ content: '❌ Item no válido.', flags: 64 });
    }

    if (userData.coins < item.cost) {
      return interaction.reply({ 
        content: `❌ No tienes suficientes monedas. Necesitas: **${item.cost.toLocaleString()}** 🪙`, 
        flags: 64 
      });
    }

    if (userData.rpg.inventory.includes(itemId)) {
      return interaction.reply({ content: '❌ Ya tienes este item.', flags: 64 });
    }

    userData.coins -= item.cost;
    userData.rpg.inventory.push(itemId);
    updateUser(interaction.user.id, userData);

    const statsText = Object.entries(item.stats).map(([stat, value]) => `${stat.toUpperCase()}: +${value}`).join(' | ');

    const embed = new EmbedBuilder()
      .setColor('#2ecc71')
      .setTitle('⚔️ Equipo Comprado')
      .setDescription(`**${interaction.user.username}** compró:\n\n${item.name}\n\n**Bonus:** ${statsText}`)
      .addFields(
        { name: '💰 Costo', value: `${item.cost.toLocaleString()} 🪙`, inline: true },
        { name: '💼 Balance', value: `${userData.coins.toLocaleString()} 🪙`, inline: true }
      )
      .setFooter({ text: 'Usa /equipar para usarlo' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // EQUIPAR ITEM
  if (interaction.isChatInputCommand() && interaction.commandName === 'equipar') {
    const itemId = interaction.options.getString('item');
    const userData = getUser(interaction.user.id);

    if (!userData.rpg.inventory.includes(itemId)) {
      return interaction.reply({ content: '❌ No tienes este item.', flags: 64 });
    }

    const allItems = [...equipmentData.weapons, ...equipmentData.armor, ...equipmentData.accessories];
    const item = allItems.find(i => i.id === itemId);

    let slot = '';
    if (equipmentData.weapons.includes(item)) slot = 'weapon';
    else if (equipmentData.armor.includes(item)) slot = 'armor';
    else if (equipmentData.accessories.includes(item)) slot = 'accessory';

    userData.rpg.equipment[slot] = itemId;
    updateUser(interaction.user.id, userData);

    const embed = new EmbedBuilder()
      .setColor('#3498db')
      .setTitle('⚔️ Equipo Equipado')
      .setDescription(`**${interaction.user.username}** equipó:\n\n${item.name}`)
      .setFooter({ text: 'Usa /perfil-rpg para ver tus stats actualizados' });

    await interaction.reply({ embeds: [embed] });
  }

  // MAZMORRA
  if (interaction.isChatInputCommand() && interaction.commandName === 'mazmorra') {
    const userData = getUser(interaction.user.id);

    if (!userData.rpg.class) {
      return interaction.reply({ 
        content: '❌ Necesitas elegir una clase. Usa `/elegir-clase`.', 
        flags: 64 
      });
    }

    const now = Date.now();
    const cooldown = 2 * 60 * 60 * 1000; // 2 horas
    if (now - userData.rpg.lastDungeon < cooldown) {
      const timeLeft = Math.ceil((cooldown - (now - userData.rpg.lastDungeon)) / 1000 / 60);
      return interaction.reply({ 
        content: `⏰ Debes esperar **${timeLeft} minutos** antes de entrar a otra mazmorra.`, 
        flags: 64 
      });
    }

    userData.rpg.lastDungeon = now;
    updateUser(interaction.user.id, userData);

    const embed1 = new EmbedBuilder()
      .setColor('#8b4513')
      .setTitle('🏰 Entrando a la Mazmorra')
      .setDescription(`**${interaction.user.username}** entra a una mazmorra oscura...\n\n*Explorando...*`)
      .setFooter({ text: 'Preparándose para la aventura' });

    await interaction.reply({ embeds: [embed1] });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Simular combates
    const encounters = Math.floor(Math.random() * 3) + 3; // 3-5 encuentros
    let totalXP = 0;
    let totalCoins = 0;
    let survived = true;

    for (let i = 0; i < encounters; i++) {
      const enemyPower = Math.floor(Math.random() * 50) + userData.rpg.level * 10;
      const playerPower = userData.rpg.stats.atk + userData.rpg.stats.magic + userData.rpg.stats.luck;
      
      if (playerPower > enemyPower) {
        const xp = Math.floor(Math.random() * 30) + 20;
        const coins = Math.floor(Math.random() * 500) + 200;
        totalXP += xp;
        totalCoins += coins;
      } else {
        survived = false;
        break;
      }
    }

    if (survived) {
      const baseXP = 50;
      userData.coins += totalCoins;
      userData.rpg.xp += totalXP;
      const xpResult = addBattlePassXP(userData, baseXP);
      const finalXP = xpResult.finalXP;
      const hasBoost = xpResult.hasBoost;
      
      // Subir de nivel si es necesario
      const xpNeeded = userData.rpg.level * 100;
      if (userData.rpg.xp >= xpNeeded) {
        userData.rpg.level += 1;
        userData.rpg.xp -= xpNeeded;
        userData.rpg.stats.atk += 5;
        userData.rpg.stats.def += 3;
        userData.rpg.stats.magic += 3;
        userData.rpg.maxHp += 20;
        userData.rpg.hp = userData.rpg.maxHp;
      }
      
      updateUser(interaction.user.id, userData);

      const embed2 = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('🏆 Mazmorra Completada')
        .setDescription(`**${interaction.user.username}** sobrevivió a la mazmorra!\n\n**Encuentros:** ${encounters}\n**Resultado:** Victoria`)
        .addFields(
          { name: '⭐ XP RPG', value: `+${totalXP} XP`, inline: true },
          { name: '💰 Monedas', value: `+${totalCoins.toLocaleString()} 🪙`, inline: true },
          { name: '📊 Nivel', value: `${userData.rpg.level}`, inline: true },
          { name: '⭐ XP Pase', value: `+${finalXP} XP${hasBoost ? ' 🔥' : ''}`, inline: true }
        )
        .setFooter({ text: 'Puedes volver en 2 horas' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed2] });
    } else {
      const embed2 = new EmbedBuilder()
        .setColor('#e74c3c')
        .setTitle('💀 Derrota')
        .setDescription(`**${interaction.user.username}** fue derrotado en la mazmorra...\n\nHuiste antes de perder todo.`)
        .setFooter({ text: 'Entrena más y vuelve en 2 horas' });

      await interaction.editReply({ embeds: [embed2] });
    }
  }

  // BOSS FIGHT (Cooperativo)
  if (interaction.isChatInputCommand() && interaction.commandName === 'boss') {
    const userData = getUser(interaction.user.id);

    if (!userData.rpg.class) {
      return interaction.reply({ 
        content: '❌ Necesitas elegir una clase. Usa `/elegir-clase`.', 
        flags: 64 
      });
    }

    const gameId = `boss_${interaction.guild.id}_${Date.now()}`;
    
    // Buscar raid activa
    let bossRaid = null;
    for (const [key, game] of activeGames.entries()) {
      if (key.startsWith('boss_') && game.status === 'waiting' && game.guildId === interaction.guild.id) {
        bossRaid = key;
        break;
      }
    }

    if (!bossRaid) {
      // Crear nueva raid
      const bossHP = 500 + (Math.floor(Math.random() * 5) * 200); // 500-1300 HP
      activeGames.set(gameId, {
        guildId: interaction.guild.id,
        status: 'waiting',
        players: [{ id: interaction.user.id, name: interaction.user.username, data: userData }],
        bossHP: bossHP,
        bossMaxHP: bossHP,
        bossName: ['🐉 Dragón Ancestral', '👹 Demonio Oscuro', '💀 Rey Esqueleto', '🦖 Hidra'][Math.floor(Math.random() * 4)]
      });

      const joinButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`boss_join_${gameId}`)
          .setLabel('⚔️ Unirse a la Raid')
          .setStyle(ButtonStyle.Danger)
      );

      const embed = new EmbedBuilder()
        .setColor('#e74c3c')
        .setTitle('⚔️ Boss Raid Iniciada')
        .setDescription(`**${interaction.user.username}** desafió a un Boss!\n\n${activeGames.get(gameId).bossName}\n❤️ HP: ${bossHP}\n\n👥 **Jugadores:** 1/5\n*Se requieren mínimo 2 jugadores*\n*La raid inicia en 45 segundos*`)
        .setFooter({ text: 'Haz click abajo para unirte' });

      await interaction.reply({ embeds: [embed], components: [joinButton] });

      // Auto-start
      setTimeout(async () => {
        const game = activeGames.get(gameId);
        if (game && game.status === 'waiting') {
          if (game.players.length >= 2) {
            await startBossRaid(interaction, gameId);
          } else {
            activeGames.delete(gameId);
            await interaction.editReply({ 
              content: '❌ Raid cancelada: no se alcanzó el mínimo de 2 jugadores.', 
              embeds: [], 
              components: [] 
            });
          }
        }
      }, 45000);

    } else {
      // Unirse a raid existente
      const game = activeGames.get(bossRaid);
      
      if (game.players.some(p => p.id === interaction.user.id)) {
        return interaction.reply({ content: '❌ Ya estás en esta raid.', flags: 64 });
      }

      if (game.players.length >= 5) {
        return interaction.reply({ content: '❌ Esta raid está llena.', flags: 64 });
      }

      game.players.push({ id: interaction.user.id, name: interaction.user.username, data: userData });

      await interaction.reply({ content: `✅ Te uniste a la raid del Boss!`, flags: 64 });

      if (game.players.length >= 5) {
        await startBossRaid(interaction, bossRaid);
      }
    }
  }

  // Unirse a Boss
  if (interaction.isButton() && interaction.customId.startsWith('boss_join_')) {
    const gameId = interaction.customId.replace('boss_join_', '');
    const game = activeGames.get(gameId);

    if (!game || game.status !== 'waiting') {
      return interaction.reply({ content: '❌ Esta raid ya no está disponible.', flags: 64 });
    }

    const userData = getUser(interaction.user.id);

    if (!userData.rpg.class) {
      return interaction.reply({ 
        content: '❌ Necesitas elegir una clase primero. Usa `/elegir-clase`.', 
        flags: 64 
      });
    }

    if (game.players.some(p => p.id === interaction.user.id)) {
      return interaction.reply({ content: '❌ Ya estás en esta raid.', flags: 64 });
    }

    if (game.players.length >= 5) {
      return interaction.reply({ content: '❌ Esta raid está llena.', flags: 64 });
    }

    // PROTECCIÓN ANTI-SPAM: Evitar múltiples joins simultáneos
    if (game.processing) {
      return interaction.reply({ content: '⏳ Espera, alguien se está uniendo...', flags: 64 });
    }
    game.processing = true;

    game.players.push({ id: interaction.user.id, name: interaction.user.username, data: userData });

    const joinButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`boss_join_${gameId}`)
        .setLabel('⚔️ Unirse a la Raid')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(game.players.length >= 5)
    );

    const embed = new EmbedBuilder()
      .setColor('#e74c3c')
      .setTitle('⚔️ Boss Raid')
      .setDescription(`${game.bossName}\n❤️ HP: ${game.bossHP}\n\n👥 **Jugadores:** ${game.players.length}/5\n\n**Raid:**\n${game.players.map(p => `• ${p.name} (Lv ${p.data.rpg.level})`).join('\n')}`)
      .setFooter({ text: `${interaction.user.username} se unió!` });

    game.processing = false; // Desbloquear para el siguiente jugador
    await interaction.update({ embeds: [embed], components: [joinButton] });

    if (game.players.length >= 5) {
      await startBossRaid(interaction, gameId);
    }
  }

  // Función auxiliar para iniciar Boss Raid
  async function startBossRaid(interaction, gameId) {
    const game = activeGames.get(gameId);
    if (!game || game.status !== 'waiting') return;

    game.status = 'fighting';

    const embed = new EmbedBuilder()
      .setColor('#f39c12')
      .setTitle('⚔️ ¡Boss Raid en Progreso!')
      .setDescription(`${game.bossName}\n❤️ HP: ${game.bossHP}/${game.bossMaxHP}\n\n**El combate ha comenzado...**`)
      .setFooter({ text: 'Luchando contra el boss' });

    await interaction.channel.send({ embeds: [embed] });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Simular combate
    let bossHP = game.bossHP;
    const totalPlayerPower = game.players.reduce((sum, p) => {
      return sum + p.data.rpg.stats.atk + p.data.rpg.stats.magic;
    }, 0);

    const damageDealt = totalPlayerPower * (3 + Math.random() * 2);
    bossHP -= damageDealt;

    if (bossHP <= 0) {
      // Victoria
      const reward = Math.floor(game.bossMaxHP * 5);
      const xpReward = Math.floor(game.bossMaxHP / 2);

      for (const player of game.players) {
        const pData = getUser(player.id);
        pData.coins += reward;
        pData.rpg.xp += xpReward;
        pData.rpg.bossesDefeated += 1;
        
        // Level up check
        const xpNeeded = pData.rpg.level * 100;
        if (pData.rpg.xp >= xpNeeded) {
          pData.rpg.level += 1;
          pData.rpg.xp -= xpNeeded;
          pData.rpg.stats.atk += 5;
          pData.rpg.stats.def += 3;
          pData.rpg.maxHp += 20;
          pData.rpg.hp = pData.rpg.maxHp;
        }
        
        updateUser(player.id, pData);
      }

      const baseXP = 100;
      
      // Dar XP de pase de batalla a todos los participantes
      let maxFinalXP = 0;
      let anyBoost = false;
      for (const player of game.players) {
        const pData = getUser(player.id);
        const xpResult = addBattlePassXP(pData, baseXP);
        maxFinalXP = Math.max(maxFinalXP, xpResult.finalXP);
        anyBoost = anyBoost || xpResult.hasBoost;
        updateUser(player.id, pData);
      }

      const embed2 = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('🏆 ¡VICTORIA!')
        .setDescription(`¡El raid derrotó a **${game.bossName}**!\n\n**Recompensas por jugador:**\n💰 ${reward.toLocaleString()} 🪙\n⭐ ${xpReward} XP RPG\n⭐ ${baseXP}+ XP Pase${anyBoost ? ' 🔥' : ''}`)
        .addFields({ name: '👥 Participantes', value: game.players.map(p => p.name).join(', ') })
        .setTimestamp();

      await interaction.channel.send({ embeds: [embed2] });
    } else {
      // Derrota
      const embed2 = new EmbedBuilder()
        .setColor('#e74c3c')
        .setTitle('💀 Derrota')
        .setDescription(`El raid fue derrotado por **${game.bossName}**...\n\n❤️ HP restante del Boss: ${Math.floor(bossHP)}\n\nEl boss era demasiado fuerte.`)
        .setFooter({ text: 'Necesitan más jugadores o mejor equipo' });

      await interaction.channel.send({ embeds: [embed2] });
    }

    activeGames.delete(gameId);
  }

  // DUELAR RPG (PvP)
  if (interaction.isChatInputCommand() && interaction.commandName === 'duelar-rpg') {
    const opponent = interaction.options.getUser('oponente');
    const userData = getUser(interaction.user.id);
    const opponentData = getUser(opponent.id);

    if (opponent.id === interaction.user.id) {
      return interaction.reply({ content: '❌ No puedes duelo contra ti mismo.', flags: 64 });
    }

    if (opponent.bot) {
      return interaction.reply({ content: '❌ No puedes duelar contra bots.', flags: 64 });
    }

    if (!userData.rpg.class) {
      return interaction.reply({ 
        content: '❌ Necesitas elegir una clase. Usa `/elegir-clase`.', 
        flags: 64 
      });
    }

    if (!opponentData.rpg.class) {
      return interaction.reply({ 
        content: '❌ Tu oponente no tiene una clase RPG.', 
        flags: 64 
      });
    }

    const gameId = `rpgduel_${interaction.user.id}_${opponent.id}_${Date.now()}`;
    activeGames.set(gameId, {
      challenger: interaction.user.id,
      opponent: opponent.id
    });

    const acceptButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`rpgduel_accept_${gameId}`)
        .setLabel('⚔️ Aceptar Duelo')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`rpgduel_decline_${gameId}`)
        .setLabel('❌ Rechazar')
        .setStyle(ButtonStyle.Secondary)
    );

    const embed = new EmbedBuilder()
      .setColor('#e74c3c')
      .setTitle('⚔️ Desafío RPG')
      .setDescription(`**${interaction.user.username}** desafió a **${opponent.username}** a un duelo RPG!\n\n**${interaction.user.username}:** ${classesData[userData.rpg.class].emoji} Lv${userData.rpg.level}\n**${opponent.username}:** ${classesData[opponentData.rpg.class].emoji} Lv${opponentData.rpg.level}`)
      .setFooter({ text: `${opponent.username}, acepta o rechaza el duelo` });

    await interaction.reply({ content: `${opponent}`, embeds: [embed], components: [acceptButton] });

    // Timeout de 30 segundos
    setTimeout(() => {
      if (activeGames.has(gameId)) {
        activeGames.delete(gameId);
        interaction.editReply({ content: '⏰ El duelo expiró.', embeds: [], components: [] }).catch(() => {});
      }
    }, 30000);
  }

  // Aceptar/Rechazar duelo RPG
  if (interaction.isButton() && interaction.customId.startsWith('rpgduel_')) {
    const action = interaction.customId.split('_')[1];
    const gameId = interaction.customId.substring(interaction.customId.indexOf('_', 8) + 1);
    const game = activeGames.get(gameId);

    if (!game) {
      return interaction.reply({ content: '❌ Este duelo ya expiró.', flags: 64 });
    }

    if (interaction.user.id !== game.opponent) {
      return interaction.reply({ content: '❌ Este duelo no es para ti.', flags: 64 });
    }

    // PROTECCIÓN ANTI-SPAM
    if (game.processing) {
      return interaction.reply({ content: '⏳ Este duelo ya está siendo procesado.', flags: 64 });
    }
    game.processing = true;

    if (action === 'decline') {
      activeGames.delete(gameId);
      await interaction.update({ content: '❌ Duelo rechazado.', embeds: [], components: [] });
      return;
    }

    // Iniciar combate
    activeGames.delete(gameId);

    const p1Data = getUser(game.challenger);
    const p2Data = getUser(game.opponent);
    const p1 = await interaction.client.users.fetch(game.challenger);
    const p2 = await interaction.client.users.fetch(game.opponent);

    // Calcular poder total
    const p1Power = p1Data.rpg.stats.atk + p1Data.rpg.stats.magic + p1Data.rpg.stats.speed + p1Data.rpg.stats.luck;
    const p2Power = p2Data.rpg.stats.atk + p2Data.rpg.stats.magic + p2Data.rpg.stats.speed + p2Data.rpg.stats.luck;

    // Simular combate
    await interaction.update({ content: '⚔️ **¡El combate ha comenzado!**', embeds: [], components: [] });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const totalPower = p1Power + p2Power;
    const p1WinChance = p1Power / totalPower;
    const winner = Math.random() < p1WinChance ? game.challenger : game.opponent;
    const loser = winner === game.challenger ? game.opponent : game.challenger;

    const winnerData = getUser(winner);
    const loserData = getUser(loser);
    const winnerUser = winner === game.challenger ? p1 : p2;
    const loserUser = loser === game.challenger ? p1 : p2;

    // Recompensas
    const reward = 500 + Math.floor(Math.random() * 500);
    const xp = 50 + Math.floor(Math.random() * 50);
    const baseXP = 60;

    winnerData.coins += reward;
    winnerData.rpg.xp += xp;
    const xpResult = addBattlePassXP(winnerData, baseXP);
    const finalXP = xpResult.finalXP;
    const hasBoost = xpResult.hasBoost;
    updateUser(winner, winnerData);

    const embed = new EmbedBuilder()
      .setColor('#2ecc71')
      .setTitle('⚔️ Resultado del Duelo RPG')
      .setDescription(`**${winnerUser.username}** venció a **${loserUser.username}**!`)
      .addFields(
        { name: '🏆 Ganador', value: `${winnerUser.username} (${classesData[winnerData.rpg.class].emoji} Lv${winnerData.rpg.level})`, inline: true },
        { name: '💰 Recompensa', value: `${reward.toLocaleString()} 🪙 + ${xp} XP RPG + ${finalXP} XP Pase${hasBoost ? ' 🔥' : ''}`, inline: true }
      )
      .setFooter({ text: 'Buen combate' })
      .setTimestamp();

    await interaction.channel.send({ embeds: [embed] });
  }

  // ========== FASE 4: SISTEMA SOCIAL ==========
  
  // Sistema de clanes (almacenado en memoria)
  // CASARSE
  if (interaction.isChatInputCommand() && interaction.commandName === 'casarse') {
    const partner = interaction.options.getUser('pareja');
    const userData = getUser(interaction.user.id);
    const partnerData = getUser(partner.id);

    if (partner.id === interaction.user.id) {
      return interaction.reply({ content: '❌ No puedes casarte contigo mismo.', flags: 64 });
    }

    if (partner.bot) {
      return interaction.reply({ content: '❌ No puedes casarte con un bot.', flags: 64 });
    }

    if (userData.social.partner) {
      return interaction.reply({ content: '❌ Ya estás casado/a. Usa `/divorcio` primero.', flags: 64 });
    }

    if (partnerData.social.partner) {
      return interaction.reply({ content: '❌ Esa persona ya está casada.', flags: 64 });
    }

    const cost = 5000;
    if (userData.coins < cost) {
      return interaction.reply({ 
        content: `❌ Necesitas **${cost.toLocaleString()}** 🪙 para casarte.`, 
        flags: 64 
      });
    }

    const gameId = `marriage_${interaction.user.id}_${partner.id}_${Date.now()}`;
    activeGames.set(gameId, {
      proposer: interaction.user.id,
      partner: partner.id
    });

    const acceptButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`marriage_accept_${gameId}`)
        .setLabel('💍 Aceptar Propuesta')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`marriage_decline_${gameId}`)
        .setLabel('❌ Rechazar')
        .setStyle(ButtonStyle.Secondary)
    );

    const embed = new EmbedBuilder()
      .setColor('#e91e63')
      .setTitle('💍 Propuesta de Matrimonio')
      .setDescription(`**${interaction.user.username}** le propuso matrimonio a **${partner.username}**!\n\n💰 Costo: ${cost.toLocaleString()} 🪙\n\n**Beneficios:**\n• Compartir inventario RPG\n• Bonus del 10% en ganancias\n• Badge especial de pareja`)
      .setFooter({ text: `${partner.username}, acepta o rechaza la propuesta` });

    await interaction.reply({ content: `${partner}`, embeds: [embed], components: [acceptButton] });

    setTimeout(() => {
      if (activeGames.has(gameId)) {
        activeGames.delete(gameId);
        interaction.editReply({ content: '⏰ La propuesta expiró.', embeds: [], components: [] }).catch(() => {});
      }
    }, 60000);
  }

  // Aceptar/Rechazar matrimonio
  if (interaction.isButton() && interaction.customId.startsWith('marriage_')) {
    const action = interaction.customId.split('_')[1];
    const gameId = interaction.customId.substring(interaction.customId.indexOf('_', 9) + 1);
    const game = activeGames.get(gameId);

    if (!game) {
      return interaction.reply({ content: '❌ Esta propuesta ya expiró.', flags: 64 });
    }

    if (interaction.user.id !== game.partner) {
      return interaction.reply({ content: '❌ Esta propuesta no es para ti.', flags: 64 });
    }

    // PROTECCIÓN ANTI-SPAM
    if (game.processing) {
      return interaction.reply({ content: '⏳ Esta propuesta ya está siendo procesada.', flags: 64 });
    }
    game.processing = true;

    if (action === 'decline') {
      activeGames.delete(gameId);
      await interaction.update({ content: '💔 Propuesta rechazada.', embeds: [], components: [] });
      return;
    }

    // Aceptar
    activeGames.delete(gameId);
    
    const proposerData = getUser(game.proposer);
    const partnerData = getUser(game.partner);
    const proposer = await interaction.client.users.fetch(game.proposer);

    proposerData.coins -= 5000;
    proposerData.social.partner = game.partner;
    proposerData.social.marriageDate = Date.now();
    partnerData.social.partner = game.proposer;
    partnerData.social.marriageDate = Date.now();

    updateUser(game.proposer, proposerData);
    updateUser(game.partner, partnerData);

    const embed = new EmbedBuilder()
      .setColor('#e91e63')
      .setTitle('💍 ¡Matrimonio Celebrado!')
      .setDescription(`**${proposer.username}** y **${interaction.user.username}** ahora están casados! 🎉\n\n💑 Disfruten sus beneficios de pareja`)
      .setFooter({ text: 'Usa /pareja para ver tu relación' })
      .setTimestamp();

    await interaction.update({ embeds: [embed], components: [] });
  }

  // DIVORCIO
  if (interaction.isChatInputCommand() && interaction.commandName === 'divorcio') {
    const userData = getUser(interaction.user.id);

    if (!userData.social.partner) {
      return interaction.reply({ content: '❌ No estás casado/a.', flags: 64 });
    }

    const partnerData = getUser(userData.social.partner);
    const partner = await interaction.client.users.fetch(userData.social.partner);

    userData.social.partner = null;
    userData.social.marriageDate = null;
    partnerData.social.partner = null;
    partnerData.social.marriageDate = null;

    updateUser(interaction.user.id, userData);
    updateUser(userData.social.partner, partnerData);

    const embed = new EmbedBuilder()
      .setColor('#95a5a6')
      .setTitle('💔 Divorcio')
      .setDescription(`**${interaction.user.username}** y **${partner.username}** se han divorciado.`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // PAREJA
  if (interaction.isChatInputCommand() && interaction.commandName === 'pareja') {
    const target = interaction.options.getUser('usuario') || interaction.user;
    const userData = getUser(target.id);

    if (!userData.social.partner) {
      return interaction.reply({ 
        content: `❌ ${target.id === interaction.user.id ? 'No estás' : target.username + ' no está'} casado/a.`, 
        flags: 64 
      });
    }

    const partner = await interaction.client.users.fetch(userData.social.partner);
    const daysTogether = Math.floor((Date.now() - userData.social.marriageDate) / (1000 * 60 * 60 * 24));

    const embed = new EmbedBuilder()
      .setColor('#e91e63')
      .setTitle('💑 Relación')
      .setDescription(`**${target.username}** está casado/a con **${partner.username}**`)
      .addFields(
        { name: '📅 Tiempo juntos', value: `${daysTogether} días`, inline: true },
        { name: '💍 Desde', value: `<t:${Math.floor(userData.social.marriageDate / 1000)}:D>`, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // REGALAR
  if (interaction.isChatInputCommand() && interaction.commandName === 'regalar') {
    const recipient = interaction.options.getUser('usuario');
    const amount = interaction.options.getInteger('cantidad');
    const userData = getUser(interaction.user.id);

    if (recipient.id === interaction.user.id) {
      return interaction.reply({ content: '❌ No puedes regalarte a ti mismo.', flags: 64 });
    }

    if (recipient.bot) {
      return interaction.reply({ content: '❌ No puedes regalar a bots.', flags: 64 });
    }

    if (amount < 1) {
      return interaction.reply({ content: '❌ Debes regalar al menos 1 moneda.', flags: 64 });
    }

    if (userData.coins < amount) {
      return interaction.reply({ 
        content: `❌ No tienes suficientes monedas. Tienes: **${userData.coins.toLocaleString()}** 🪙`, 
        flags: 64 
      });
    }

    const recipientData = getUser(recipient.id);

    userData.coins -= amount;
    recipientData.coins += amount;
    updateUser(interaction.user.id, userData);
    updateUser(recipient.id, recipientData);

    const embed = new EmbedBuilder()
      .setColor('#f39c12')
      .setTitle('🎁 Regalo Enviado')
      .setDescription(`**${interaction.user.username}** le regaló **${amount.toLocaleString()}** 🪙 a **${recipient.username}**!`)
      .addFields(
        { name: '💼 Tu Balance', value: `${userData.coins.toLocaleString()} 🪙`, inline: true },
        { name: '🎁 Receptor', value: recipient.username, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // CREAR CLAN
  if (interaction.isChatInputCommand() && interaction.commandName === 'crear-clan') {
    const clanName = interaction.options.getString('nombre');
    const clanTag = interaction.options.getString('tag');
    const userData = getUser(interaction.user.id);
    const clans = loadClans();

    if (userData.social.clan) {
      return interaction.reply({ content: '❌ Ya estás en un clan. Usa `/salir-clan` primero.', flags: 64 });
    }

    const cost = 10000;
    if (userData.coins < cost) {
      return interaction.reply({ 
        content: `❌ Necesitas **${cost.toLocaleString()}** 🪙 para crear un clan.`, 
        flags: 64 
      });
    }

    // Verificar si el tag ya existe
    if (Object.values(clans).some(c => c.tag === clanTag)) {
      return interaction.reply({ content: '❌ Ese tag ya está en uso.', flags: 64 });
    }

    const clanId = `clan_${Date.now()}`;
    clans[clanId] = {
      name: clanName,
      tag: clanTag,
      leader: interaction.user.id,
      members: [interaction.user.id],
      bank: 0,
      createdAt: Date.now(),
      level: 1,
      xp: 0
    };

    userData.coins -= cost;
    userData.social.clan = clanId;
    updateUser(interaction.user.id, userData);
    saveClans(clans);

    const embed = new EmbedBuilder()
      .setColor('#3498db')
      .setTitle('🏰 Clan Creado')
      .setDescription(`**${interaction.user.username}** creó el clan **[${clanTag}] ${clanName}**!`)
      .addFields(
        { name: '💰 Costo', value: `${cost.toLocaleString()} 🪙`, inline: true },
        { name: '👥 Miembros', value: '1', inline: true },
        { name: '⭐ Nivel', value: '1', inline: true }
      )
      .setFooter({ text: 'Usa /invitar-clan para invitar miembros' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // UNIRSE A CLAN (Por invitación)
  if (interaction.isChatInputCommand() && interaction.commandName === 'invitar-clan') {
    const target = interaction.options.getUser('usuario');
    const userData = getUser(interaction.user.id);
    const targetData = getUser(target.id);
    const clans = loadClans();

    if (!userData.social.clan) {
      return interaction.reply({ content: '❌ No estás en un clan.', flags: 64 });
    }

    const clan = clans[userData.social.clan];
    if (clan.leader !== interaction.user.id) {
      return interaction.reply({ content: '❌ Solo el líder puede invitar miembros.', flags: 64 });
    }

    if (targetData.social.clan) {
      return interaction.reply({ content: '❌ Esa persona ya está en un clan.', flags: 64 });
    }

    if (clan.members.length >= 20) {
      return interaction.reply({ content: '❌ El clan está lleno (máximo 20 miembros).', flags: 64 });
    }

    const gameId = `clan_invite_${target.id}_${Date.now()}`;
    activeGames.set(gameId, {
      clanId: userData.social.clan,
      inviter: interaction.user.id,
      target: target.id
    });

    const acceptButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`clan_accept_${gameId}`)
        .setLabel('🏰 Unirse al Clan')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`clan_decline_${gameId}`)
        .setLabel('❌ Rechazar')
        .setStyle(ButtonStyle.Secondary)
    );

    const embed = new EmbedBuilder()
      .setColor('#3498db')
      .setTitle('🏰 Invitación a Clan')
      .setDescription(`**${interaction.user.username}** te invitó a unirte al clan **[${clan.tag}] ${clan.name}**!\n\n👥 Miembros: ${clan.members.length}/20\n⭐ Nivel: ${clan.level}\n💰 Banco: ${clan.bank.toLocaleString()} 🪙`)
      .setFooter({ text: `${target.username}, acepta o rechaza` });

    await interaction.reply({ content: `${target}`, embeds: [embed], components: [acceptButton] });

    setTimeout(() => {
      if (activeGames.has(gameId)) {
        activeGames.delete(gameId);
        interaction.editReply({ content: '⏰ La invitación expiró.', embeds: [], components: [] }).catch(() => {});
      }
    }, 60000);
  }

  // Aceptar/Rechazar clan
  if (interaction.isButton() && interaction.customId.startsWith('clan_')) {
    const action = interaction.customId.split('_')[1];
    const gameId = interaction.customId.substring(interaction.customId.indexOf('_', 5) + 1);
    const game = activeGames.get(gameId);

    if (!game) {
      return interaction.reply({ content: '❌ Esta invitación ya expiró.', flags: 64 });
    }

    if (interaction.user.id !== game.target) {
      return interaction.reply({ content: '❌ Esta invitación no es para ti.', flags: 64 });
    }

    // PROTECCIÓN ANTI-SPAM
    if (game.processing) {
      return interaction.reply({ content: '⏳ Esta invitación ya está siendo procesada.', flags: 64 });
    }
    game.processing = true;

    if (action === 'decline') {
      activeGames.delete(gameId);
      await interaction.update({ content: '❌ Invitación rechazada.', embeds: [], components: [] });
      return;
    }

    // Aceptar
    activeGames.delete(gameId);
    const clans = loadClans();
    const clan = clans[game.clanId];
    const targetData = getUser(game.target);

    clan.members.push(game.target);
    targetData.social.clan = game.clanId;
    updateUser(game.target, targetData);
    saveClans(clans);

    const embed = new EmbedBuilder()
      .setColor('#2ecc71')
      .setTitle('🏰 ¡Te uniste al clan!')
      .setDescription(`**${interaction.user.username}** se unió a **[${clan.tag}] ${clan.name}**!\n\n👥 Miembros: ${clan.members.length}/20`)
      .setTimestamp();

    await interaction.update({ embeds: [embed], components: [] });
  }

  // INFO DEL CLAN
  if (interaction.isChatInputCommand() && interaction.commandName === 'clan-info') {
    const userData = getUser(interaction.user.id);
    const clans = loadClans();

    if (!userData.social.clan) {
      return interaction.reply({ content: '❌ No estás en un clan.', flags: 64 });
    }

    const clan = clans[userData.social.clan];
    const leader = await interaction.client.users.fetch(clan.leader);
    const membersList = await Promise.all(
      clan.members.slice(0, 10).map(async id => {
        const user = await interaction.client.users.fetch(id);
        return user.username;
      })
    );

    const embed = new EmbedBuilder()
      .setColor('#3498db')
      .setTitle(`🏰 [${clan.tag}] ${clan.name}`)
      .setDescription(`**Líder:** ${leader.username}\n**Creado:** <t:${Math.floor(clan.createdAt / 1000)}:R>`)
      .addFields(
        { name: '👥 Miembros', value: `${clan.members.length}/20`, inline: true },
        { name: '⭐ Nivel', value: `${clan.level}`, inline: true },
        { name: '💰 Banco', value: `${clan.bank.toLocaleString()} 🪙`, inline: true },
        { name: '📝 Miembros', value: membersList.join(', ') + (clan.members.length > 10 ? '...' : ''), inline: false }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // DEPOSITAR EN CLAN
  if (interaction.isChatInputCommand() && interaction.commandName === 'depositar-clan') {
    const amount = interaction.options.getInteger('cantidad');
    const userData = getUser(interaction.user.id);
    const clans = loadClans();

    if (!userData.social.clan) {
      return interaction.reply({ content: '❌ No estás en un clan.', flags: 64 });
    }

    if (userData.coins < amount) {
      return interaction.reply({ 
        content: `❌ No tienes suficientes monedas. Tienes: **${userData.coins.toLocaleString()}** 🪙`, 
        flags: 64 
      });
    }

    const clan = clans[userData.social.clan];
    userData.coins -= amount;
    clan.bank += amount;
    clan.xp += Math.floor(amount / 100);

    // Level up clan
    const xpNeeded = clan.level * 1000;
    if (clan.xp >= xpNeeded) {
      clan.level += 1;
      clan.xp -= xpNeeded;
    }

    updateUser(interaction.user.id, userData);
    saveClans(clans);

    const embed = new EmbedBuilder()
      .setColor('#2ecc71')
      .setTitle('💰 Depósito al Clan')
      .setDescription(`**${interaction.user.username}** depositó **${amount.toLocaleString()}** 🪙 al banco del clan!`)
      .addFields(
        { name: '🏰 Clan', value: `[${clan.tag}] ${clan.name}`, inline: true },
        { name: '💰 Banco Total', value: `${clan.bank.toLocaleString()} 🪙`, inline: true },
        { name: '⭐ Nivel', value: `${clan.level}`, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // SALIR DEL CLAN
  if (interaction.isChatInputCommand() && interaction.commandName === 'salir-clan') {
    const userData = getUser(interaction.user.id);
    const clans = loadClans();

    if (!userData.social.clan) {
      return interaction.reply({ content: '❌ No estás en un clan.', flags: 64 });
    }

    const clan = clans[userData.social.clan];
    
    if (clan.leader === interaction.user.id) {
      return interaction.reply({ 
        content: '❌ Eres el líder. Debes transferir el liderazgo o disolver el clan primero.', 
        flags: 64 
      });
    }

    clan.members = clan.members.filter(id => id !== interaction.user.id);
    userData.social.clan = null;
    updateUser(interaction.user.id, userData);
    saveClans(clans);

    const embed = new EmbedBuilder()
      .setColor('#95a5a6')
      .setTitle('👋 Abandonaste el clan')
      .setDescription(`**${interaction.user.username}** salió de **[${clan.tag}] ${clan.name}**`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // REPUTACIÓN (+rep)
  if (interaction.isChatInputCommand() && interaction.commandName === 'rep') {
    const target = interaction.options.getUser('usuario');
    const type = interaction.options.getString('tipo');
    const userData = getUser(interaction.user.id);
    const targetData = getUser(target.id);

    if (target.id === interaction.user.id) {
      return interaction.reply({ content: '❌ No puedes darte reputación a ti mismo.', flags: 64 });
    }

    if (target.bot) {
      return interaction.reply({ content: '❌ No puedes dar reputación a bots.', flags: 64 });
    }

    const now = Date.now();
    const cooldown = 24 * 60 * 60 * 1000; // 24 horas
    if (now - userData.social.lastRepDate < cooldown) {
      const timeLeft = Math.ceil((cooldown - (now - userData.social.lastRepDate)) / 1000 / 60 / 60);
      return interaction.reply({ 
        content: `⏰ Debes esperar **${timeLeft} horas** antes de dar más reputación.`, 
        flags: 64 
      });
    }

    if (userData.social.repsGiven.includes(target.id)) {
      return interaction.reply({ 
        content: '❌ Ya le diste reputación a este usuario anteriormente.', 
        flags: 64 
      });
    }

    const repChange = type === 'positiva' ? 1 : -1;
    targetData.social.reputation += repChange;
    userData.social.repsGiven.push(target.id);
    userData.social.lastRepDate = now;

    updateUser(interaction.user.id, userData);
    updateUser(target.id, targetData);

    const embed = new EmbedBuilder()
      .setColor(type === 'positiva' ? '#2ecc71' : '#e74c3c')
      .setTitle(`${type === 'positiva' ? '⭐' : '💢'} Reputación ${type === 'positiva' ? 'Positiva' : 'Negativa'}`)
      .setDescription(`**${interaction.user.username}** le dio reputación ${type} a **${target.username}**`)
      .addFields({ name: '📊 Reputación total', value: `${targetData.social.reputation}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // PERFIL SOCIAL
  if (interaction.isChatInputCommand() && interaction.commandName === 'perfil-social') {
    const target = interaction.options.getUser('usuario') || interaction.user;
    const userData = getUser(target.id);
    const clans = loadClans();

    let partnerText = 'Soltero/a';
    if (userData.social.partner) {
      const partner = await interaction.client.users.fetch(userData.social.partner);
      const daysTogether = Math.floor((Date.now() - userData.social.marriageDate) / (1000 * 60 * 60 * 24));
      partnerText = `💍 ${partner.username} (${daysTogether} días)`;
    }

    let clanText = 'Sin clan';
    if (userData.social.clan) {
      const clan = clans[userData.social.clan];
      clanText = `🏰 [${clan.tag}] ${clan.name}`;
    }

    const embed = new EmbedBuilder()
      .setColor('#9b59b6')
      .setTitle(`💫 Perfil Social - ${target.username}`)
      .addFields(
        { name: '💑 Pareja', value: partnerText, inline: false },
        { name: '🏰 Clan', value: clanText, inline: false },
        { name: '⭐ Reputación', value: `${userData.social.reputation}`, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // ========== FASE 5: SISTEMA DE RECOMPENSAS ==========
  
  // COMPRAR CAJA
  if (interaction.isChatInputCommand() && interaction.commandName === 'comprar-caja') {
    const boxType = interaction.options.getString('tipo');
    const userData = getUser(interaction.user.id);

    const boxPrices = {
      common: 1000,
      rare: 5000,
      legendary: 25000
    };

    const cost = boxPrices[boxType];

    if (userData.coins < cost) {
      return interaction.reply({ 
        content: `❌ No tienes suficientes monedas. Necesitas: **${cost.toLocaleString()}** 🪙`, 
        flags: 64 
      });
    }

    userData.coins -= cost;
    userData.boxes[boxType] += 1;
    updateUser(interaction.user.id, userData);

    const boxEmojis = {
      common: '📦',
      rare: '🎁',
      legendary: '💎'
    };

    const embed = new EmbedBuilder()
      .setColor('#f39c12')
      .setTitle('🎁 Caja Comprada')
      .setDescription(`**${interaction.user.username}** compró una caja ${boxEmojis[boxType]} **${boxType.toUpperCase()}**!`)
      .addFields(
        { name: '💰 Costo', value: `${cost.toLocaleString()} 🪙`, inline: true },
        { name: '💼 Balance', value: `${userData.coins.toLocaleString()} 🪙`, inline: true },
        { name: '📦 Cajas', value: `${userData.boxes.common} 📦 | ${userData.boxes.rare} 🎁 | ${userData.boxes.legendary} 💎`, inline: false }
      )
      .setFooter({ text: 'Usa /abrir-caja para abrirla' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // ABRIR CAJA
  if (interaction.isChatInputCommand() && interaction.commandName === 'abrir-caja') {
    const boxType = interaction.options.getString('tipo');
    const userData = getUser(interaction.user.id);

    if (userData.boxes[boxType] < 1) {
      return interaction.reply({ 
        content: `❌ No tienes cajas de tipo **${boxType}**. Usa \`/comprar-caja\`.`, 
        flags: 64 
      });
    }

    userData.boxes[boxType] -= 1;

    const boxEmojis = {
      common: '📦',
      rare: '🎁',
      legendary: '💎'
    };

    const embed1 = new EmbedBuilder()
      .setColor('#f39c12')
      .setTitle('🎁 Abriendo Caja...')
      .setDescription(`${boxEmojis[boxType]} **${interaction.user.username}** está abriendo una caja **${boxType.toUpperCase()}**...\n\n✨ *Revelando contenido...*`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed1] });
    await new Promise(resolve => setTimeout(resolve, 2500));

    // Sistema de recompensas según rareza
    const rewards = {
      common: [
        { type: 'coins', amount: () => Math.floor(Math.random() * 1000) + 500, emoji: '🪙', name: 'Monedas' },
        { type: 'bpxp', amount: () => 50, emoji: '⭐', name: 'XP Pase Batalla' }
      ],
      rare: [
        { type: 'coins', amount: () => Math.floor(Math.random() * 5000) + 2500, emoji: '🪙', name: 'Monedas' },
        { type: 'bpxp', amount: () => 150, emoji: '⭐', name: 'XP Pase Batalla' },
        { type: 'box', amount: () => 1, emoji: '📦', name: 'Caja Común' }
      ],
      legendary: [
        { type: 'coins', amount: () => Math.floor(Math.random() * 25000) + 15000, emoji: '🪙', name: 'Monedas' },
        { type: 'bpxp', amount: () => 500, emoji: '⭐', name: 'XP Pase Batalla' },
        { type: 'box', amount: () => 1, emoji: '🎁', name: 'Caja Rara' },
        { type: 'rpgxp', amount: () => 200, emoji: '⚔️', name: 'XP RPG' }
      ]
    };

    const possibleRewards = rewards[boxType];
    const numRewards = boxType === 'common' ? 2 : boxType === 'rare' ? 3 : 4;
    const selectedRewards = [];

    for (let i = 0; i < numRewards; i++) {
      const reward = possibleRewards[Math.floor(Math.random() * possibleRewards.length)];
      const amount = reward.amount();
      selectedRewards.push({ ...reward, amount });

      // Aplicar recompensas
      if (reward.type === 'coins') {
        userData.coins += amount;
      } else if (reward.type === 'bpxp') {
        // Usar addBattlePassXP para aplicar boost correctamente
        const xpResult = addBattlePassXP(userData, amount);
        selectedRewards[selectedRewards.length - 1].amount = xpResult.finalXP; // Actualizar el amount mostrado
        if (xpResult.hasBoost) {
          selectedRewards[selectedRewards.length - 1].name += ' 🔥';
        }
      } else if (reward.type === 'box') {
        userData.boxes.common += amount;
      } else if (reward.type === 'rpgxp' && userData.rpg.class) {
        userData.rpg.xp += amount;
      }
    }

    // Guardar antes de calcular nivel para que se vea el XP
    updateUser(interaction.user.id, userData);

    // Check BP level up (sin reducir XP automáticamente)
    const xpPerTier = 15000;
    let leveledUp = false;
    while (userData.battlePass.xp >= xpPerTier && userData.battlePass.tier < 10) {
      userData.battlePass.tier += 1;
      userData.battlePass.xp -= xpPerTier;
      leveledUp = true;
    }

    if (leveledUp) {
      updateUser(interaction.user.id, userData);
    }

    const rewardsList = selectedRewards.map(r => `${r.emoji} **${r.amount.toLocaleString()}** ${r.name}`).join('\n');

    const embed2 = new EmbedBuilder()
      .setColor('#2ecc71')
      .setTitle(`🎉 Caja ${boxType.toUpperCase()} Abierta!`)
      .setDescription(`**${interaction.user.username}** recibió:\n\n${rewardsList}`)
      .addFields({ name: '💼 Nuevo Balance', value: `${userData.coins.toLocaleString()} 🪙` })
      .setFooter({ text: `Cajas restantes: ${userData.boxes.common} 📦 | ${userData.boxes.rare} 🎁 | ${userData.boxes.legendary} 💎` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed2] });
  }

  // PASE BATALLA
  if (interaction.isChatInputCommand() && interaction.commandName === 'pase-batalla') {
    const userData = getUser(interaction.user.id);

    const tiers = [
      { tier: 0, reward: '🎁 Caja Común', coins: 0, icon: '📦', color: '#95a5a6' },
      { tier: 1, reward: '💰 2,500 Monedas', coins: 2500, icon: '💰', color: '#f1c40f' },
      { tier: 2, reward: '🎁 Caja Rara + 1,000 🪙', coins: 1000, icon: '🎁', color: '#3498db' },
      { tier: 3, reward: '� 5,000 Monedas', coins: 5000, icon: '💎', color: '#9b59b6' },
      { tier: 4, reward: '⚔️ Boost XP 2x (24h)', coins: 0, icon: '⚡', color: '#e67e22' },
      { tier: 5, reward: '💰 10,000 Monedas + Caja', coins: 10000, icon: '🏆', color: '#f39c12' },
      { tier: 6, reward: '💎 Caja Legendaria + 5K', coins: 5000, icon: '💎', color: '#8e44ad' },
      { tier: 7, reward: '🌟 20,000 Monedas', coins: 20000, icon: '🌟', color: '#f1c40f' },
      { tier: 8, reward: '🎁 3x Cajas Raras + 10K', coins: 10000, icon: '🎉', color: '#3498db' },
      { tier: 9, reward: '💰 50,000 Monedas', coins: 50000, icon: '💵', color: '#2ecc71' },
      { tier: 10, reward: '👑 GRAN PREMIO: 100K + 3 Legendarias', coins: 100000, icon: '👑', color: '#e74c3c' }
    ];

    const xpPerTier = 15000;
    const currentXP = userData.battlePass.xp;
    const percentage = Math.min((currentXP / xpPerTier) * 100, 100);
    
    // Barra de progreso animada más visual
    const filledBlocks = Math.floor(percentage / 10);
    const emptyBlocks = 10 - filledBlocks;
    const progressEmojis = ['🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '🟫', '⬜', '⬛', '🟢'];
    const progressColor = progressEmojis[Math.min(filledBlocks, 9)];
    const progressBar = `${'█'.repeat(filledBlocks)}${'░'.repeat(emptyBlocks)}`;
    
    // Mostrar solo los próximos 5 tiers para no saturar
    const startTier = Math.max(0, userData.battlePass.tier - 1);
    const endTier = Math.min(10, userData.battlePass.tier + 4);
    const visibleTiers = tiers.slice(startTier, endTier + 1);

    const tiersList = visibleTiers.map(t => {
      const claimed = userData.battlePass.claimed.includes(t.tier);
      const unlocked = userData.battlePass.tier >= t.tier;
      const isCurrent = userData.battlePass.tier === t.tier;
      
      let status = claimed ? '✅' : unlocked ? '🎁' : '🔒';
      let prefix = isCurrent ? '➤ ' : '   ';
      
      return `${prefix}${status} **Tier ${t.tier}:** ${t.icon} ${t.reward}`;
    }).join('\n');

    // Calcular próxima recompensa
    const nextTier = userData.battlePass.tier + 1;
    const nextReward = nextTier <= 10 ? tiers[nextTier] : null;
    const xpNeeded = nextTier <= 10 ? xpPerTier - currentXP : 0;

    const embed = new EmbedBuilder()
      .setColor(tiers[userData.battlePass.tier]?.color || '#9b59b6')
      .setTitle('🎖️ Pase de Batalla - Temporada 1')
      .setDescription(`╔══════════════════════════╗
║   **${interaction.user.username}**
║
║   **Tier:** ${userData.battlePass.tier}/10 ${tiers[userData.battlePass.tier].icon}
║   **XP:** ${currentXP}/${xpPerTier} (${percentage.toFixed(0)}%)
║   ${progressBar}
║
╚══════════════════════════╝`)
      .addFields(
        { 
          name: '🎯 Progreso Actual', 
          value: nextReward 
            ? `**Próximo:** Tier ${nextTier} - ${nextReward.icon} ${nextReward.reward}\n**Necesitas:** ${xpNeeded} XP más` 
            : '**¡Pase Completado!** 🎊', 
          inline: false 
        },
        { name: '🎁 Tiers Disponibles', value: tiersList, inline: false }
      )
      .setFooter({ text: '💡 Juega para ganar XP • Usa /reclamar-tier <número> para cobrar recompensas' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // RECLAMAR TIER
  if (interaction.isChatInputCommand() && interaction.commandName === 'reclamar-tier') {
    const tier = interaction.options.getInteger('tier');
    const userData = getUser(interaction.user.id);

    if (tier > userData.battlePass.tier) {
      return interaction.reply({ 
        content: `❌ No has alcanzado el Tier ${tier}. Tu tier actual es ${userData.battlePass.tier}.`, 
        flags: 64 
      });
    }

    if (userData.battlePass.claimed.includes(tier)) {
      return interaction.reply({ 
        content: `❌ Ya reclamaste las recompensas del Tier ${tier}.`, 
        flags: 64 
      });
    }

    userData.battlePass.claimed.push(tier);

    // Recompensas mejoradas según tier
    const rewards = {
      0: { coins: 0, boxes: { common: 1 }, msg: '📦 Caja Común', icon: '📦', color: '#95a5a6' },
      1: { coins: 2500, msg: '💰 2,500 Monedas', icon: '💰', color: '#f1c40f' },
      2: { coins: 1000, boxes: { rare: 1 }, msg: '🎁 Caja Rara + 1,000 🪙', icon: '🎁', color: '#3498db' },
      3: { coins: 5000, msg: '� 5,000 Monedas', icon: '💎', color: '#9b59b6' },
      4: { coins: 2000, boost: true, msg: '⚡ Boost XP 2x (24h) + 2,000 🪙', icon: '⚡', color: '#e67e22' },
      5: { coins: 10000, boxes: { rare: 1 }, msg: '🏆 10,000 Monedas + Caja Rara', icon: '🏆', color: '#f39c12' },
      6: { coins: 5000, boxes: { legendary: 1 }, msg: '💎 Caja Legendaria + 5,000 🪙', icon: '💎', color: '#8e44ad' },
      7: { coins: 20000, msg: '🌟 20,000 Monedas', icon: '🌟', color: '#f1c40f' },
      8: { coins: 10000, boxes: { rare: 3 }, msg: '� 3x Cajas Raras + 10,000 🪙', icon: '🎉', color: '#3498db' },
      9: { coins: 50000, msg: '� 50,000 Monedas', icon: '💵', color: '#2ecc71' },
      10: { coins: 100000, boxes: { legendary: 3 }, title: '👑 Campeón', msg: '👑 100,000 Monedas + 3 Legendarias + Título', icon: '👑', color: '#e74c3c' }
    };

    const reward = rewards[tier];
    
    if (reward.coins) userData.coins += reward.coins;
    if (reward.boxes) {
      if (reward.boxes.common) userData.boxes.common += reward.boxes.common;
      if (reward.boxes.rare) userData.boxes.rare += reward.boxes.rare;
      if (reward.boxes.legendary) userData.boxes.legendary += reward.boxes.legendary;
    }
    if (reward.boost) {
      // Guardar boost temporal (24 horas)
      userData.battlePass.xpBoost = Date.now() + (24 * 60 * 60 * 1000);
    }
    if (reward.title) {
      if (!userData.social.titles) userData.social.titles = [];
      userData.social.titles.push(reward.title);
    }

    updateUser(interaction.user.id, userData);

    // Lista de recompensas detallada
    let rewardDetails = [];
    if (reward.coins) rewardDetails.push(`💰 **${reward.coins.toLocaleString()}** Monedas`);
    if (reward.boxes) {
      if (reward.boxes.common) rewardDetails.push(`📦 **${reward.boxes.common}** Caja${reward.boxes.common > 1 ? 's' : ''} Común${reward.boxes.common > 1 ? 'es' : ''}`);
      if (reward.boxes.rare) rewardDetails.push(`🎁 **${reward.boxes.rare}** Caja${reward.boxes.rare > 1 ? 's' : ''} Rara${reward.boxes.rare > 1 ? 's' : ''}`);
      if (reward.boxes.legendary) rewardDetails.push(`💎 **${reward.boxes.legendary}** Caja${reward.boxes.legendary > 1 ? 's' : ''} Legendaria${reward.boxes.legendary > 1 ? 's' : ''}`);
    }
    if (reward.boost) rewardDetails.push(`⚡ **Boost XP 2x** durante 24 horas`);
    if (reward.title) rewardDetails.push(`👑 Título: **${reward.title}**`);

    const embed = new EmbedBuilder()
      .setColor(reward.color || '#2ecc71')
      .setTitle(`${reward.icon} Tier ${tier} Reclamado!`)
      .setDescription(`╔══════════════════════════╗
║   **${interaction.user.username}**
║   
║   **Recompensas Recibidas:**
║   ${rewardDetails.join('\n║   ')}
║
╚══════════════════════════╝`)
      .addFields(
        { name: '💼 Nuevo Balance', value: `${userData.coins.toLocaleString()} 🪙`, inline: true },
        { name: '📦 Cajas', value: `${userData.boxes.common} 📦 | ${userData.boxes.rare} 🎁 | ${userData.boxes.legendary} 💎`, inline: true }
      )
      .setFooter({ text: tier === 10 ? '🎉 ¡Felicidades! Completaste el Pase de Batalla' : '💡 Sigue jugando para desbloquear más tiers' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // POKER (Texas Hold'em interactivo vs Bot)
  if (interaction.isChatInputCommand() && interaction.commandName === 'poker') {
    const bet = interaction.options.getInteger('apuesta');
    const userData = getUser(interaction.user.id);

    if (userData.coins < bet) {
      return interaction.reply({ 
        content: `❌ No tienes suficientes monedas. Tienes: **${userData.coins.toLocaleString()}** 🪙`, 
        flags: 64 
      });
    }

    // Verificar si el usuario ya tiene una partida activa
    const activeCheck = hasActiveGame(interaction.user.id, 'poker');
    if (activeCheck.hasGame) {
      return interaction.reply({ content: '❌ Ya tienes una partida de Poker en curso. Termínala antes de empezar otra.', flags: 64 });
    }

    // Generar gameId único ANTES del try para que esté disponible en catch y setTimeout
    const gameId = `poker_${interaction.user.id}_${Date.now()}`;

    try {
      userData.coins -= bet;
      updateUser(interaction.user.id, userData);

      // Crear baraja
      const suits = ['♠️', '♥️', '♣️', '♦️'];
      const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
      const deck = [];
      for (const suit of suits) {
        for (const value of values) {
          deck.push({ suit, value, numValue: values.indexOf(value) + 2 });
        }
      }

      // Mezclar
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }

      // Repartir cartas
      const playerCards = [deck.pop(), deck.pop()];
      const botCards = [deck.pop(), deck.pop()];
      const community = [deck.pop(), deck.pop(), deck.pop(), deck.pop(), deck.pop()];

      // Guardar estado del juego
      activeGames.set(gameId, { 
        userId: interaction.user.id, 
        bet,
        playerCards,
        botCards,
        community,
        deck,
        pot: bet * 2,
        stage: 'preflop'
      });

      const playerCardsStr = playerCards.map(c => `${c.value}${c.suit}`).join(' ');

      // Botones iniciales
      const actionButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`poker_call_${gameId}`)
          .setLabel('✅ Ver (Call)')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`poker_raise_${gameId}`)
          .setLabel(`💰 Subir ${Math.floor(bet * 0.5)}🪙`)
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`poker_fold_${gameId}`)
          .setLabel('❌ Retirarse (Fold)')
          .setStyle(ButtonStyle.Danger)
      );

      const embed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setTitle('🃏 Poker - Texas Hold\'em')
        .setDescription(`**${interaction.user.username}** apostó **${bet.toLocaleString()}** 🪙\n\n**📋 Pre-Flop**\n\n**🎴 Tu mano:**\n${playerCardsStr}\n\n**🤖 Bot:** 🎴 🎴 *(ocultas)*\n\n**💰 Pozo:** ${(bet * 2).toLocaleString()} 🪙`)
        .addFields(
          { name: '📊 Tu Apuesta', value: `${bet.toLocaleString()} 🪙`, inline: true },
          { name: '🏦 Balance Actual', value: `${userData.coins.toLocaleString()} 🪙`, inline: true }
        )
        .setFooter({ text: '¿Qué deseas hacer? Tienes 45 segundos' });

      await interaction.reply({ embeds: [embed], components: [actionButtons] });

      // Timeout de 45 segundos
      setTimeout(() => {
        if (activeGames.has(gameId)) {
          activeGames.delete(gameId);
          interaction.editReply({ 
            content: '⏰ Se acabó el tiempo. Te retiraste automáticamente.', 
            embeds: [], 
            components: [] 
          }).catch(() => {});
        }
      }, 45000);

    } catch (error) {
      console.error('Error en poker:', error);
      userData.coins += bet;
      updateUser(interaction.user.id, userData);
      await interaction.reply({ content: '❌ Error en el juego. Apuesta devuelta.' });
      activeGames.delete(gameId);
    }
  }

  // Botones de Poker - CALL
  if (interaction.isButton() && interaction.customId.startsWith('poker_call_')) {
    const gameId = interaction.customId.replace('poker_call_', '');
    const game = activeGames.get(gameId);

    if (!game) {
      return interaction.reply({ content: '❌ Este juego ya expiró.', flags: 64 });
    }

    if (interaction.user.id !== game.userId) {
      return interaction.reply({ content: '❌ Este juego no es tuyo.', flags: 64 });
    }

    // PROTECCIÓN ANTI-SPAM
    if (game.processing) {
      return interaction.reply({ content: '⏳ Espera... procesando.', flags: 64 });
    }
    game.processing = true;

    // Revelar el Flop (3 cartas comunitarias)
    const communityFlop = game.community.slice(0, 3);
    const communityStr = communityFlop.map(c => `${c.value}${c.suit}`).join(' ');
    const playerCardsStr = game.playerCards.map(c => `${c.value}${c.suit}`).join(' ');

    game.stage = 'flop';
    activeGames.set(gameId, game);

    const actionButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`poker_turn_${gameId}`)
        .setLabel('➡️ Ver Turn')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`poker_fold_${gameId}`)
        .setLabel('❌ Retirarse')
        .setStyle(ButtonStyle.Danger)
    );

    const embed = new EmbedBuilder()
      .setColor('#3498db')
      .setTitle('🃏 Poker - Flop')
      .setDescription(`**📋 The Flop**\n\n**🌟 Comunitarias:**\n${communityStr}\n\n**🎴 Tu mano:**\n${playerCardsStr}\n\n**🤖 Bot:** 🎴 🎴 *(ocultas)*\n\n**💰 Pozo:** ${game.pot.toLocaleString()} 🪙`)
      .setFooter({ text: '¿Continuar al Turn?' });

    game.processing = false; // Desbloquear
    await interaction.update({ embeds: [embed], components: [actionButtons] });
  }

  // Botones de Poker - TURN
  if (interaction.isButton() && interaction.customId.startsWith('poker_turn_')) {
    const gameId = interaction.customId.replace('poker_turn_', '');
    const game = activeGames.get(gameId);

    if (!game) {
      return interaction.reply({ content: '❌ Este juego ya expiró.', flags: 64 });
    }

    if (interaction.user.id !== game.userId) {
      return interaction.reply({ content: '❌ Este juego no es tuyo.', flags: 64 });
    }

    // PROTECCIÓN ANTI-SPAM
    if (game.processing) {
      return interaction.reply({ content: '⏳ Espera... procesando.', flags: 64 });
    }
    game.processing = true;

    // Revelar el Turn (4ta carta)
    const communityTurn = game.community.slice(0, 4);
    const communityStr = communityTurn.map(c => `${c.value}${c.suit}`).join(' ');
    const playerCardsStr = game.playerCards.map(c => `${c.value}${c.suit}`).join(' ');

    game.stage = 'turn';
    activeGames.set(gameId, game);

    const actionButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`poker_river_${gameId}`)
        .setLabel('➡️ Ver River')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`poker_fold_${gameId}`)
        .setLabel('❌ Retirarse')
        .setStyle(ButtonStyle.Danger)
    );

    const embed = new EmbedBuilder()
      .setColor('#e67e22')
      .setTitle('🃏 Poker - Turn')
      .setDescription(`**📋 The Turn**\n\n**🌟 Comunitarias:**\n${communityStr}\n\n**🎴 Tu mano:**\n${playerCardsStr}\n\n**🤖 Bot:** 🎴 🎴 *(ocultas)*\n\n**💰 Pozo:** ${game.pot.toLocaleString()} 🪙`)
      .setFooter({ text: '¿Continuar al River?' });

    game.processing = false; // Desbloquear
    await interaction.update({ embeds: [embed], components: [actionButtons] });
  }

  // Botones de Poker - RIVER (Showdown)
  if (interaction.isButton() && interaction.customId.startsWith('poker_river_')) {
    const gameId = interaction.customId.replace('poker_river_', '');
    const game = activeGames.get(gameId);

    if (!game) {
      return interaction.reply({ content: '❌ Este juego ya expiró.', flags: 64 });
    }

    if (interaction.user.id !== game.userId) {
      return interaction.reply({ content: '❌ Este juego no es tuyo.', flags: 64 });
    }

    // PROTECCIÓN ANTI-SPAM
    if (game.processing) {
      return interaction.reply({ content: '⏳ Espera... procesando.', flags: 64 });
    }
    game.processing = true;

    // Evaluar manos
    const evaluateHand = (cards, community) => {
      const allCards = [...cards, ...community].sort((a, b) => b.numValue - a.numValue);
      const values = allCards.map(c => c.numValue);
      const suits = allCards.map(c => c.suit);

      // Flush (5 cartas del mismo palo)
      const suitCounts = {};
      suits.forEach(s => suitCounts[s] = (suitCounts[s] || 0) + 1);
      const hasFlush = Object.values(suitCounts).some(count => count >= 5);
      if (hasFlush) return { score: 6, name: 'Flush', high: Math.max(...values) };

      // Straight (5 cartas consecutivas)
      const uniqueValues = [...new Set(values)].sort((a, b) => b - a);
      for (let i = 0; i <= uniqueValues.length - 5; i++) {
        if (uniqueValues[i] - uniqueValues[i + 4] === 4) {
          return { score: 5, name: 'Straight', high: uniqueValues[i] };
        }
      }

      // Three of a kind (Trio)
      const valueCounts = {};
      values.forEach(v => valueCounts[v] = (valueCounts[v] || 0) + 1);
      const trips = Object.entries(valueCounts).filter(([_, count]) => count === 3);
      if (trips.length > 0) {
        return { score: 4, name: 'Trío', high: parseInt(trips[0][0]) };
      }

      // Two pair (Doble par)
      const pairs = Object.entries(valueCounts).filter(([_, count]) => count === 2);
      if (pairs.length >= 2) {
        const pairValues = pairs.map(([v]) => parseInt(v));
        return { score: 3, name: 'Doble Par', high: Math.max(...pairValues) };
      }

      // One pair (Par)
      if (pairs.length === 1) {
        return { score: 2, name: 'Par', high: parseInt(pairs[0][0]) };
      }

      // High card
      return { score: 1, name: 'Carta Alta', high: Math.max(...values) };
    };

    const playerHand = evaluateHand(game.playerCards, game.community);
    const botHand = evaluateHand(game.botCards, game.community);

    let winner = null;
    if (playerHand.score > botHand.score) {
      winner = 'player';
    } else if (botHand.score > playerHand.score) {
      winner = 'bot';
    } else {
      winner = playerHand.high >= botHand.high ? 'player' : 'bot';
    }

    const userData = getUser(interaction.user.id);
    const winnings = winner === 'player' ? game.pot : 0;
    const baseXP = winner === 'player' ? 70 : 0;
    let finalXP = 0;
    let hasBoost = false;
    userData.coins += winnings;
    userData.stats.gamesPlayed += 1;
    if (winner === 'player') {
      const xpResult = addBattlePassXP(userData, baseXP);
      finalXP = xpResult.finalXP;
      hasBoost = xpResult.hasBoost;
      userData.stats.gamesWon += 1;
      userData.stats.totalWinnings += winnings;
    } else {
      userData.stats.gamesLost += 1;
      userData.stats.totalLosses += game.bet;
    }
    updateUser(interaction.user.id, userData);

    const playerCardsStr = game.playerCards.map(c => `${c.value}${c.suit}`).join(' ');
    const botCardsStr = game.botCards.map(c => `${c.value}${c.suit}`).join(' ');
    const communityStr = game.community.map(c => `${c.value}${c.suit}`).join(' ');

    const embed = new EmbedBuilder()
      .setColor(winner === 'player' ? '#2ecc71' : '#e74c3c')
      .setTitle('🃏 Poker - Showdown!')
      .setDescription(`**📋 The River - Resultado Final**\n\n**🌟 Comunitarias:**\n${communityStr}\n\n**🎴 Tu mano:** ${playerCardsStr}\n*${playerHand.name}*\n\n**🤖 Bot:** ${botCardsStr}\n*${botHand.name}*\n\n${winner === 'player' ? '🎉 **¡GANASTE!**' : '💔 **El Bot Ganó**'}`)
      .addFields(
        { name: winner === 'player' ? '💰 Ganaste' : '💸 Perdiste', value: `${winner === 'player' ? '+' : '-'}${(winner === 'player' ? winnings - game.bet : game.bet).toLocaleString()} 🪙${winner === 'player' && hasBoost ? ' | +' + finalXP + ' ⭐ XP 🔥' : winner === 'player' ? ' | +' + finalXP + ' ⭐ XP' : ''}`, inline: true },
        { name: '🏦 Nuevo Balance', value: `${userData.coins.toLocaleString()} 🪙`, inline: true },
        { name: '💰 Pozo Total', value: `${game.pot.toLocaleString()} 🪙`, inline: true },
        ...(bpXP > 0 ? [{ name: '⭐ XP Ganado', value: `+${bpXP} XP`, inline: true }] : [])
      )
      .setFooter({ text: 'Ea$y Esports Poker' })
      .setTimestamp();

    await interaction.update({ embeds: [embed], components: [] });
    activeGames.delete(gameId); // El lock se elimina con el juego
  }

  // Botones de Poker - RAISE
  if (interaction.isButton() && interaction.customId.startsWith('poker_raise_')) {
    const gameId = interaction.customId.replace('poker_raise_', '');
    const game = activeGames.get(gameId);

    if (!game) {
      return interaction.reply({ content: '❌ Este juego ya expiró.', flags: 64 });
    }

    if (interaction.user.id !== game.userId) {
      return interaction.reply({ content: '❌ Este juego no es tuyo.', flags: 64 });
    }

    // PROTECCIÓN ANTI-SPAM
    if (game.processing) {
      return interaction.reply({ content: '⏳ Espera... procesando.', flags: 64 });
    }
    game.processing = true;

    const userData = getUser(interaction.user.id);
    const raiseAmount = Math.floor(game.bet * 0.5);

    if (userData.coins < raiseAmount) {
      return interaction.reply({ 
        content: `❌ No tienes suficientes monedas para subir. Necesitas ${raiseAmount} 🪙`, 
        flags: 64 
      });
    }

    userData.coins -= raiseAmount;
    game.pot += raiseAmount * 2; // El bot también sube
    game.stage = 'flop';
    activeGames.set(gameId, game);
    updateUser(interaction.user.id, userData);

    // Revelar Flop después de subir
    const communityFlop = game.community.slice(0, 3);
    const communityStr = communityFlop.map(c => `${c.value}${c.suit}`).join(' ');
    const playerCardsStr = game.playerCards.map(c => `${c.value}${c.suit}`).join(' ');

    const actionButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`poker_turn_${gameId}`)
        .setLabel('➡️ Ver Turn')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`poker_fold_${gameId}`)
        .setLabel('❌ Retirarse')
        .setStyle(ButtonStyle.Danger)
    );

    const embed = new EmbedBuilder()
      .setColor('#f39c12')
      .setTitle('🃏 Poker - ¡Subiste la apuesta!')
      .setDescription(`**📋 The Flop**\n\nSubiste **${raiseAmount.toLocaleString()}** 🪙. El bot igualó.\n\n**🌟 Comunitarias:**\n${communityStr}\n\n**🎴 Tu mano:**\n${playerCardsStr}\n\n**🤖 Bot:** 🎴 🎴 *(ocultas)*\n\n**💰 Pozo:** ${game.pot.toLocaleString()} 🪙`)
      .addFields(
        { name: '💸 Apostado Total', value: `${(game.bet + raiseAmount).toLocaleString()} 🪙`, inline: true },
        { name: '🏦 Balance Actual', value: `${userData.coins.toLocaleString()} 🪙`, inline: true }
      )
      .setFooter({ text: '¿Continuar al Turn?' });

    game.processing = false; // Desbloquear
    await interaction.update({ embeds: [embed], components: [actionButtons] });
  }

  // Botones de Poker - FOLD
  if (interaction.isButton() && interaction.customId.startsWith('poker_fold_')) {
    const gameId = interaction.customId.replace('poker_fold_', '');
    const game = activeGames.get(gameId);

    if (!game) {
      return interaction.reply({ content: '❌ Este juego ya expiró.', flags: 64 });
    }

    if (interaction.user.id !== game.userId) {
      return interaction.reply({ content: '❌ Este juego no es tuyo.', flags: 64 });
    }

    // PROTECCIÓN ANTI-SPAM
    if (game.processing) {
      return interaction.reply({ content: '⏳ Espera... procesando.', flags: 64 });
    }
    game.processing = true;

    const userData = getUser(interaction.user.id);
    userData.stats.gamesPlayed += 1;
    userData.stats.gamesLost += 1;
    userData.stats.totalLosses += game.bet;
    updateUser(interaction.user.id, userData);

    const embed = new EmbedBuilder()
      .setColor('#95a5a6')
      .setTitle('🃏 Poker - Te Retiraste')
      .setDescription(`${interaction.user.username} decidió retirarse.\n\n**💸 Perdiste:** ${game.bet.toLocaleString()} 🪙\n**🏦 Balance:** ${userData.coins.toLocaleString()} 🪙`)
      .setFooter({ text: 'Ea$y Esports Poker' })
      .setTimestamp();

    await interaction.update({ embeds: [embed], components: [] });
    activeGames.delete(gameId); // El lock se elimina con el juego
  }

  // ========== GUÍA PARA USUARIOS ==========
  if (interaction.isChatInputCommand() && interaction.commandName === 'guia-usuarios') {
    await interaction.reply('📖 **Enviando guía completa de comandos para usuarios...**');

    // Embed 1: Tickets
    const embed1 = new EmbedBuilder()
      .setColor('#2ecc71')
      .setTitle('🎫 Sistema de Tickets')
      .addFields(
        { name: '📝 Crear Ticket de Reclutamiento', value: 'Click en "📝 Postularme" en el panel\n**Info:** Nombre, Edad, Activision ID, Rol/KD, Disponibilidad, Presentación\n**Límite:** 1 ticket por usuario', inline: false },
        { name: '🐛 Crear Ticket de Soporte', value: '**Reporte de Bug** o **Duda/Consulta**\n⚠️ Auto-cierre a las 48h sin respuesta tuya', inline: false }
      );

    // Embed 2: Economía Básica
    const embed2 = new EmbedBuilder()
      .setColor('#f1c40f')
      .setTitle('💰 Economía Básica')
      .addFields(
        { name: '`/balance [@usuario]`', value: 'Ver monedas, banco, inventario y estadísticas de juegos', inline: false },
        { name: '`/daily`', value: '**Recompensa:** 100 🪙\n**Cooldown:** 24 horas', inline: true },
        { name: '`/leaderboard`', value: 'Top 10 usuarios más ricos', inline: true },
        { name: '`/give @usuario cantidad`', value: '**Comisión:** 5%\nEj: Enviar 1000 = cobran 1050', inline: false }
      );

    // Embed 3: Economía Avanzada
    const embed3 = new EmbedBuilder()
      .setColor('#e67e22')
      .setTitle('💼 Economía Avanzada')
      .addFields(
        { name: '`/work`', value: '**Ganancias:** 50-280 🪙\n**Trabajos:** Programador, Chef, Conductor, Profesor, Médico, Streamer\n**Cooldown:** 1 hora', inline: false },
        { name: '`/bank accion`', value: '**Ver Balance** - Tu dinero total\n**Depositar** - Guardar seguro\n**Retirar** - Sacar del banco', inline: false },
        { name: '`/loan accion`', value: '**Pedir:** 100-5,000 🪙 (10% interés, 7 días)\n**Ver estado** - Tu préstamo activo\n**Pagar** - Saldar deuda completa', inline: false }
      );

    // Embed 4: Juegos Casino (parte 1)
    const embed4 = new EmbedBuilder()
      .setColor('#9b59b6')
      .setTitle('🎮 Juegos de Casino (Parte 1)')
      .addFields(
        { name: '🪙 `/coinflip apuesta eleccion`', value: 'Cara o Cruz. **Premio:** x2', inline: true },
        { name: '🎲 `/dice apuesta`', value: 'Lanza 2 dados\n**Jackpot (12):** x5\n**10-11:** x2', inline: true },
        { name: '🃏 `/blackjack apuesta`', value: 'Llega a 21\n**Blackjack:** x2.5\n**Ganar:** x2', inline: true },
        { name: '🎰 `/roulette apuesta eleccion`', value: 'Rojo/Negro/Verde\n**Verde (0):** x14\n**Rojo/Negro:** x2', inline: true }
      );

    // Embed 5: Juegos Casino (parte 2)
    const embed5 = new EmbedBuilder()
      .setColor('#9b59b6')
      .setTitle('🎮 Juegos de Casino (Parte 2)')
      .addFields(
        { name: '✊ `/rps apuesta eleccion`', value: 'Piedra, Papel o Tijera\n**Ganar:** x2\n**Empate:** Recuperas apuesta', inline: false },
        { name: '🔢 `/guess apuesta`', value: 'Adivina número 1-100 (5 intentos)\n**1er intento:** x5\n**2do:** x4\n**3er:** x3\n**4to:** x2\n**5to:** x1', inline: false },
        { name: '📊 `/higher-lower apuesta`', value: 'Mayor o Menor\n**Racha:** Cada acierto = x1 más\nPuedes retirarte en cualquier momento', inline: false }
      );

    // Embed 6: Duelos
    const embed6 = new EmbedBuilder()
      .setColor('#e74c3c')
      .setTitle('⚔️ Sistema de Duelos')
      .setDescription('**Comando:** `/duel @oponente apuesta [juego]`')
      .addFields(
        { name: '🪙 Coinflip', value: 'Moneda al azar (por defecto)', inline: true },
        { name: '🎲 Dados', value: 'Lanza 2 dados, mayor suma gana', inline: true },
        { name: '🃏 Blackjack', value: '2 cartas, más cerca de 21', inline: true },
        { name: '✊ RPS', value: 'Piedra/Papel/Tijera', inline: true },
        { name: '🔢 Adivinanza', value: 'Más cerca del número gana', inline: true },
        { name: '📋 Funcionamiento', value: '1️⃣ Retas oponente\n2️⃣ 60s para aceptar\n3️⃣ Juego automático\n4️⃣ Ganador se lleva todo', inline: false }
      );

    // Embed 7: Tienda
    const embed7 = new EmbedBuilder()
      .setColor('#1abc9c')
      .setTitle('🛒 Tienda e Inventario')
      .addFields(
        { name: '`/shop`', value: 'Ver todos los items disponibles para comprar', inline: false },
        { name: '`/buy item:<nombre>`', value: '🍀 **Amuleto de la Suerte** - 5,000 🪙\n🛡️ **Escudo Protector** - 3,000 🪙\n💎 **Multiplicador x2** - 10,000 🪙\n⚡ **Boost Diario** - 2,000 🪙\n👑 **Título VIP** - 15,000 🪙', inline: false },
        { name: '`/inventory [@usuario]`', value: 'Ver tu inventario o el de otro usuario', inline: false }
      );

    // Embed 8: Entretenimiento
    const embed8 = new EmbedBuilder()
      .setColor('#f39c12')
      .setTitle('🎯 Entretenimiento')
      .addFields(
        { name: '`/daily-quest`', value: '**3 misiones diarias** aleatorias\n**Recompensas:** 80-200 🪙 cada una\n**Ejemplos:** Juega 3 partidas, Gana 2 juegos, Trabaja 2 veces\n⏰ Se renuevan cada 24h', inline: false },
        { name: '`/spin`', value: '**Ruleta de premios gratis**\n🎰 1 spin cada 24h\n💰 Premios: 50-1,000 🪙 o items\n**Probabilidades:**\n50🪙 (30%), 100🪙 (25%), 250🪙 (20%)\n500🪙 (15%), 1000🪙 (7%), Item (3%)', inline: false },
        { name: '`/streak`', value: '**Racha de días consecutivos**\n🔥 3 días = +50 🪙\n⚡ 7 días = +100 🪙\n💫 14 días = +250 🪙\n👑 30 días = +500 🪙\n⚠️ Se reinicia si faltas un día', inline: false }
      );

    // Embed 9: Tips
    const embed9 = new EmbedBuilder()
      .setColor('#3498db')
      .setTitle('💡 Tips y Consejos')
      .addFields(
        { name: '📈 Para Ganar Monedas', value: '✅ `/daily` todos los días\n✅ `/work` cada hora\n✅ Mantén tu racha activa\n✅ Completa misiones diarias\n✅ `/spin` gratis diario', inline: true },
        { name: '💰 Para Maximizar', value: '🏦 Guarda en el banco\n📊 Préstamos para inversión\n🛒 Compra items estratégicos\n⚔️ Duelos cuando tengas ventaja\n🎲 Apuestas bajas al inicio', inline: true }
      )
      .setFooter({ text: 'Usa /guia-staff para ver comandos de staff' });

    // Enviar todos los embeds
    await interaction.channel.send({ embeds: [embed1] });
    await interaction.channel.send({ embeds: [embed2] });
    await interaction.channel.send({ embeds: [embed3] });
    await interaction.channel.send({ embeds: [embed4] });
    await interaction.channel.send({ embeds: [embed5] });
    await interaction.channel.send({ embeds: [embed6] });
    await interaction.channel.send({ embeds: [embed7] });
    await interaction.channel.send({ embeds: [embed8] });
    await interaction.channel.send({ embeds: [embed9] });
  }

  // ========== FASE 6: SISTEMA DE ANUNCIOS PARA STAFF ==========
  
  if (interaction.isChatInputCommand() && interaction.commandName === 'anuncio') {
    const staffRoleIds = getStaffRoles();
    const hasStaffRole = interaction.member.roles.cache.some(role => staffRoleIds.includes(role.id));
    
    if (!hasStaffRole && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Este comando es solo para el Staff.', flags: 64 });
    }

    // Mostrar modal para crear anuncio
    const modal = new ModalBuilder()
      .setCustomId(`announcement_modal_${interaction.user.id}_${Date.now()}`)
      .setTitle('📢 Crear Anuncio');

    const titleInput = new TextInputBuilder()
      .setCustomId('announcement_title')
      .setLabel('Título del Anuncio')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ej: ¡Nuevo Torneo!')
      .setRequired(true)
      .setMaxLength(100);

    const descInput = new TextInputBuilder()
      .setCustomId('announcement_description')
      .setLabel('Descripción')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Escribe el contenido del anuncio...')
      .setRequired(true)
      .setMaxLength(2000);

    const colorInput = new TextInputBuilder()
      .setCustomId('announcement_color')
      .setLabel('Color (hex sin #, ej: 2ecc71)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('2ecc71')
      .setRequired(false)
      .setMaxLength(6);

    const imageInput = new TextInputBuilder()
      .setCustomId('announcement_image')
      .setLabel('URL de Imagen (opcional)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('https://example.com/image.png')
      .setRequired(false);

    const footerInput = new TextInputBuilder()
      .setCustomId('announcement_footer')
      .setLabel('Pie de Página (opcional)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ej: Ea$y Esports Staff')
      .setRequired(false)
      .setMaxLength(100);

    const row1 = new ActionRowBuilder().addComponents(titleInput);
    const row2 = new ActionRowBuilder().addComponents(descInput);
    const row3 = new ActionRowBuilder().addComponents(colorInput);
    const row4 = new ActionRowBuilder().addComponents(imageInput);
    const row5 = new ActionRowBuilder().addComponents(footerInput);

    modal.addComponents(row1, row2, row3, row4, row5);

    await interaction.showModal(modal);
  }

  // Procesar modal de anuncio
  if (interaction.isModalSubmit() && interaction.customId.startsWith('announcement_modal_')) {
    const title = interaction.fields.getTextInputValue('announcement_title');
    const description = interaction.fields.getTextInputValue('announcement_description');
    const colorInput = interaction.fields.getTextInputValue('announcement_color') || '3498db';
    const imageUrl = interaction.fields.getTextInputValue('announcement_image') || null;
    const footer = interaction.fields.getTextInputValue('announcement_footer') || null;

    // Validar color hex
    const color = colorInput.match(/^[0-9A-Fa-f]{6}$/) ? `#${colorInput}` : '#3498db';

    // Crear preview
    const previewEmbed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(description)
      .setTimestamp();

    if (imageUrl) {
      try {
        previewEmbed.setImage(imageUrl);
      } catch (e) {
        // URL inválida, ignorar
      }
    }

    if (footer) {
      previewEmbed.setFooter({ text: footer });
    }

    // Botones de confirmación
    const confirmButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`announcement_send_${interaction.user.id}_${Date.now()}`)
        .setLabel('📢 Enviar Anuncio')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`announcement_cancel_${interaction.user.id}`)
        .setLabel('❌ Cancelar')
        .setStyle(ButtonStyle.Danger)
    );

    // Guardar datos del embed en activeGames temporalmente
    const announcementId = `announcement_${interaction.user.id}_${Date.now()}`;
    activeGames.set(announcementId, {
      embed: previewEmbed,
      userId: interaction.user.id
    });

    await interaction.reply({ 
      content: '📢 **Vista previa del anuncio:**\n¿Deseas enviarlo al canal actual?', 
      embeds: [previewEmbed], 
      components: [confirmButtons],
      flags: 64 
    });

    // Auto-delete después de 2 minutos
    setTimeout(() => {
      if (activeGames.has(announcementId)) {
        activeGames.delete(announcementId);
      }
    }, 120000);
  }

  // Enviar o cancelar anuncio
  if (interaction.isButton() && interaction.customId.startsWith('announcement_')) {
    const action = interaction.customId.split('_')[1];
    
    if (action === 'cancel') {
      await interaction.update({ 
        content: '❌ Anuncio cancelado.', 
        embeds: [], 
        components: [] 
      });
      return;
    }

    if (action === 'send') {
      // Buscar el embed guardado
      let announcementData = null;
      for (const [key, value] of activeGames.entries()) {
        if (key.startsWith('announcement_') && value.userId === interaction.user.id) {
          announcementData = value;
          activeGames.delete(key);
          break;
        }
      }

      if (!announcementData) {
        return interaction.update({ 
          content: '❌ El anuncio expiró. Intenta de nuevo.', 
          embeds: [], 
          components: [] 
        });
      }

      // Enviar el anuncio al canal
      await interaction.channel.send({ embeds: [announcementData.embed] });

      await interaction.update({ 
        content: '✅ ¡Anuncio enviado exitosamente!', 
        embeds: [], 
        components: [] 
      });
    }
  }

  // ========== GUÍA PARA STAFF ==========
  if (interaction.isChatInputCommand() && interaction.commandName === 'guia-staff') {
    const staffRoleIds = getStaffRoles();
    const hasStaffRole = interaction.member.roles.cache.some(role => staffRoleIds.includes(role.id));
    
    if (!hasStaffRole && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Este comando es solo para el Staff.', flags: 64 });
    }

    await interaction.reply('👨‍💼 **Enviando guía completa de comandos para staff...**');

    // Embed 1: Gestión de Tickets
    const embedS1 = new EmbedBuilder()
      .setColor('#95a5a6')
      .setTitle('🎫 Gestión de Tickets')
      .addFields(
        { name: '`/panel-reclutamiento`', value: '🔒 **Admin only**\nCrea el panel de reclutamiento con botón de postulación', inline: false },
        { name: '`/panel-soporte`', value: '🔒 **Admin only**\nCrea el panel de soporte con botones de Bug y Dudas', inline: false },
        { name: 'Botón "✋ Reclamar"', value: 'Aparece en cada ticket nuevo\nReclama el ticket para atenderlo\nMuestra tu nombre en el ticket', inline: true },
        { name: 'Botón "🔒 Cerrar"', value: 'Cierra el ticket actual\nEnvía log al canal de logs\nElimina el canal en 5 segundos', inline: true },
        { name: '⏰ Auto-cierre', value: 'Los tickets se cierran automáticamente si el usuario no responde en 48 horas\nSe envía aviso 30 segundos antes', inline: false }
      );

    // Embed 2: Templates de Respuestas
    const embedS2 = new EmbedBuilder()
      .setColor('#3498db')
      .setTitle('📝 Templates de Respuestas')
      .setDescription('**Comando:** `/respuesta template:<tipo>`')
      .addFields(
        { name: '👋 Bienvenida', value: 'Saludo inicial al abrir ticket', inline: true },
        { name: '🔍 En revisión', value: 'Ticket siendo revisado', inline: true },
        { name: '📸 Necesita pruebas', value: 'Pedir evidencias adicionales', inline: true },
        { name: '✅ Resuelto', value: 'Problema solucionado', inline: true },
        { name: '❌ Rechazado', value: 'Solicitud rechazada', inline: true },
        { name: '⏱️ En espera', value: 'Esperando respuesta del usuario', inline: true },
        { name: '🔒 Cerrar ticket', value: 'Mensaje de cierre', inline: true }
      )
      .setFooter({ text: 'Usa estos templates para ahorrar tiempo' });

    // Embed 3: Gestión de Economía
    const embedS3 = new EmbedBuilder()
      .setColor('#f1c40f')
      .setTitle('💰 Gestión de Economía')
      .addFields(
        { name: '`/add-coins @usuario cantidad`', value: '**Función:** Agregar monedas a un usuario\n**Uso:** Recompensas, compensaciones, eventos especiales\n**Log:** El usuario recibe notificación', inline: false },
        { name: '`/remove-coins @usuario cantidad`', value: '**Función:** Quitar monedas a un usuario\n**Uso:** Sanciones, correcciones de bugs\n**Log:** El usuario recibe notificación', inline: false },
        { name: '💡 Buenas Prácticas', value: '• Usa add-coins para premiar buen comportamiento\n• Documenta las razones de cambios económicos\n• Revisa el balance antes de quitar monedas\n• Sé justo y consistente', inline: false }
      );

    // Embed 4: Sistema de Logs
    const embedS4 = new EmbedBuilder()
      .setColor('#e67e22')
      .setTitle('📊 Sistema de Logs')
      .addFields(
        { name: '🔔 Logs Automáticos', value: 'Todos los eventos importantes se registran en el canal de logs configurado', inline: false },
        { name: '📝 Qué se Registra', value: '• Apertura de tickets\n• Cierre de tickets (manual y automático)\n• Quién reclamó cada ticket\n• Tiempo de duración\n• Modificaciones de economía por staff', inline: false },
        { name: '🔍 Revisar Logs', value: 'Revisa el canal de logs regularmente para:\n• Monitorear actividad del servidor\n• Detectar problemas recurrentes\n• Evaluar desempeño del equipo', inline: false }
      );

    // Embed 5: Tips para Staff
    const embedS5 = new EmbedBuilder()
      .setColor('#2ecc71')
      .setTitle('✨ Tips para Staff')
      .addFields(
        { name: '🎯 Eficiencia', value: '• Reclama tickets rápidamente\n• Usa `/respuesta` para respuestas comunes\n• Mantén comunicación clara con el usuario\n• Cierra tickets cuando estén resueltos', inline: false },
        { name: '⚠️ Importante', value: '• Responde dentro de las 48h para evitar auto-cierre\n• Sé profesional y respetuoso siempre\n• No abuses de los comandos de economía\n• Documenta decisiones importantes', inline: false },
        { name: '📋 Recordatorios', value: '• Los tickets de reclutamiento requieren evidencias\n• Verifica identidad antes de dar información sensible\n• Mantén los tickets organizados\n• Consulta con otros staff si tienes dudas', inline: false }
      )
      .setFooter({ text: 'Gracias por ser parte del equipo ❤️' });

    // Enviar todos los embeds de staff
    await interaction.channel.send({ embeds: [embedS1] });
    await interaction.channel.send({ embeds: [embedS2] });
    await interaction.channel.send({ embeds: [embedS3] });
    await interaction.channel.send({ embeds: [embedS4] });
    await interaction.channel.send({ embeds: [embedS5] });
  }

  // ========== TEMPLATES DE RESPUESTAS (STAFF) ==========
  if (interaction.isChatInputCommand() && interaction.commandName === 'respuesta') {
    const staffRoleIds = getStaffRoles();
    const hasStaffRole = interaction.member.roles.cache.some(role => staffRoleIds.includes(role.id));
    
    if (!hasStaffRole && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Este comando es solo para el Staff.', flags: 64 });
    }

    const template = interaction.options.getString('template');
    
    const templates = {
      'bienvenida': '¡Hola! Gracias por contactarnos. Un miembro del staff te atenderá pronto. Por favor, describe tu problema o consulta con el mayor detalle posible.',
      'en_revision': 'Estamos revisando tu caso. Te responderemos lo antes posible con una solución.',
      'necesita_pruebas': 'Para continuar con tu solicitud, necesitamos que proporciones pruebas (capturas de pantalla, videos, etc.). Por favor, súbelas en este canal.',
      'resuelto': '✅ Tu caso ha sido resuelto. Si tienes alguna otra consulta, no dudes en abrir otro ticket. ¡Gracias!',
      'rechazado': '❌ Lamentablemente tu solicitud ha sido rechazada. Si tienes dudas sobre esta decisión, puedes contactar con un administrador.',
      'espera': 'Actualmente estamos experimentando un alto volumen de tickets. Agradecemos tu paciencia, te atenderemos lo antes posible.',
      'cierre': 'Vamos a proceder a cerrar este ticket. Si necesitas algo más, puedes abrir uno nuevo. ¡Gracias por tu comprensión!'
    };

    const response = templates[template];
    if (!response) {
      return interaction.reply({ content: '❌ Template no encontrado.', flags: 64 });
    }

    await interaction.reply({ content: response });
  }
});

// Guardar datos cuando el bot se cierra
process.on('SIGINT', () => {
  console.log('💾 Guardando datos antes de cerrar...');
  savePersistent();
  createBackup();
  console.log('✅ Datos guardados. Cerrando bot...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('💾 Guardando datos antes de cerrar...');
  savePersistent();
  createBackup();
  console.log('✅ Datos guardados. Cerrando bot...');
  process.exit(0);
});

// Capturar errores no manejados y guardar datos
process.on('uncaughtException', (error) => {
  console.error('❌ Error crítico:', error);
  savePersistent();
  createBackup();
  process.exit(1);
});

client.login(process.env.DISCORD_TOKEN);
