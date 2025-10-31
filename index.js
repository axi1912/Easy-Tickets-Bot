const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits, REST, Routes, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// Archivo de tickets
const TICKETS_FILE = './tickets.json';
const CANAL_LOGS = '1419826668708827146';

// Archivo de economía
const ECONOMY_FILE = './economy.json';

// Almacenar juegos activos en memoria
const activeGames = new Map();

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

    // Limpiar backups antiguos (mantener solo los últimos 10 de cada tipo)
    const files = fs.readdirSync(backupDir);
    const economyBackups = files.filter(f => f.startsWith('economy_')).sort().reverse();
    const ticketsBackups = files.filter(f => f.startsWith('tickets_')).sort().reverse();

    economyBackups.slice(10).forEach(file => fs.unlinkSync(`${backupDir}/${file}`));
    ticketsBackups.slice(10).forEach(file => fs.unlinkSync(`${backupDir}/${file}`));

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
  
  return economy[userId];
}

function updateUser(userId, data) {
  const economy = loadEconomy();
  economy[userId] = { ...economy[userId], ...data };
  saveEconomy(economy);
}

client.once('ready', async () => {
  console.log(`✅ Bot listo: ${client.user.tag}`);
  
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

        const userData = getUser(message.author.id);
        userData.coins += winnings - game.bet;
        userData.stats.gamesPlayed++;
        userData.stats.gamesWon++;
        userData.stats.totalWinnings += winnings - game.bet;
        updateUser(message.author.id, userData);

        const medals = ['', '🥇', '🥈', '🥉', '🎖️', '⭐'];
        const resultBox = `╔═══════════════════════╗\n║                                              ║\n║  ${medals[game.attempts]} **¡CORRECTO!** ${medals[game.attempts]}  ║\n║   El número era **${game.targetNumber}**   ║\n║                                              ║\n║  💰 **+${(winnings - game.bet).toLocaleString()} 🪙** (${multiplier}x)  ║\n║                                              ║\n╚═══════════════════════╝`;

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
          value: '> Las pruebas deben ser **claras y verificables**\n> Puedes subir imágenes directamente o compartir enlaces\n> El Staff revisará tu postulación una vez envíes las pruebas',
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
      components: [new ActionRowBuilder().addComponents(selectMenu)],
      flags: 64 
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

  // Tareas progresivas (1/3, 2/3, 3/3)
  if (interaction.isButton() && interaction.customId.startsWith('work_task')) {
    const parts = interaction.customId.split('_');
    const taskNum = parseInt(parts[0].replace('work_task', ''));
    const [, userId, jobId, shift, correctBonus, tasksCompleted] = parts.slice(1);
    
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ Este botón no es para ti.', flags: 64 });
    }

    const userData = getUser(interaction.user.id);
    const jobsData = getJobsData(userData.workLevel);
    const job = jobsData.find(j => j.id === jobId);
    const newTasksCompleted = parseInt(tasksCompleted) + 1;

    if (newTasksCompleted < 3) {
      // Más tareas pendientes
      const nextTask = taskNum + 1;
      const taskButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`work_task${nextTask}_${userId}_${jobId}_${shift}_${correctBonus}_${newTasksCompleted}`)
          .setLabel(`📋 Tarea ${nextTask}/3`)
          .setStyle(ButtonStyle.Primary)
      );

      const progressText = [
        newTasksCompleted >= 1 ? '✅ Tarea 1 completada' : '⏳ Tarea 1',
        newTasksCompleted >= 2 ? '✅ Tarea 2 completada' : newTasksCompleted === 1 ? '⏳ Iniciar tarea 2' : '🔒 Tarea 2 (Bloqueada)',
        newTasksCompleted >= 3 ? '✅ Tarea 3 completada' : '🔒 Tarea 3 (Bloqueada)'
      ].join('\n');

      const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle(`${job.emoji} ${job.name} - Tarea ${taskNum} Completada`)
        .setDescription('¡Bien hecho! Continúa con la siguiente tarea.')
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
    const correctMultiplier = parseInt(correctBonus) ? 1.15 : 1;
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
        { name: '📊 Desglose', value: `Pago base: ${randomPay}🪙\n${quality === 'perfect' ? 'Calidad +20%' : 'Rápido -10%'}\n${parseInt(correctBonus) ? 'Respuesta correcta +15%' : ''}\n${streakMultiplier > 1 ? `Racha ${userData.workStreak} días +${Math.floor((streakMultiplier - 1) * 100)}%` : ''}`, inline: false },
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

    if (selectedPrize.value === 'item') {
      const items = ['lucky_charm', 'shield', 'multiplier', 'daily_boost'];
      const randomItem = items[Math.floor(Math.random() * items.length)];
      userData.inventory.push(randomItem);
      selectedPrize.name = `🎁 ${randomItem.replace('_', ' ')}`;
    } else {
      userData.coins += selectedPrize.value;
    }

    userData.lastSpin = now;
    updateUser(interaction.user.id, userData);

    const resultEmbed = new EmbedBuilder()
      .setColor('#2ecc71')
      .setTitle('🎰 ¡Resultado de la Ruleta!')
      .setDescription(`${selectedPrize.emoji} **${selectedPrize.name}**`)
      .addFields(
        { name: '💰 Nuevo Balance', value: `${userData.coins.toLocaleString()} 🪙`, inline: true },
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
    for (let [existingGameId, game] of activeGames.entries()) {
      if (game.userId === interaction.user.id && game.game === 'blackjack') {
        return interaction.reply({ content: '❌ Ya tienes una partida de Blackjack en curso. Termínala antes de empezar otra.', flags: 64 });
      }
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

      // Animación de mezclar
      const shuffleFrames = [
        { text: '🎴 **MEZCLANDO**', color: '#2c3e50' },
        { text: '🃏 **MEZCLANDO**', color: '#34495e' },
        { text: '🎴 **REPARTIENDO**', color: '#2c3e50' },
        { text: '🃏 **REPARTIENDO**', color: '#34495e' }
      ];

      for (let i = 0; i < shuffleFrames.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 300));
        loadingEmbed.setColor(shuffleFrames[i].color);
        loadingEmbed.setDescription(`╔══════════════════════╗\n║                                          ║\n║       ${shuffleFrames[i].text}      ║\n║                                          ║\n╚══════════════════════╝`);
        try {
          await interaction.editReply({ embeds: [loadingEmbed] });
        } catch (err) {
          console.error('Error editReply during blackjack animation:', err);
        }
      }
    } catch (err) {
      console.error('Blackjack initial error:', err);
      return interaction.reply({ content: '❌ Error al iniciar el juego. Intenta de nuevo.', flags: 64 }).catch(() => {});
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

    const gameId = `${interaction.user.id}_${Date.now()}`;
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

    await interaction.editReply({ embeds: [embed], components: [buttons] });
  }

  // Botones de Blackjack
  if (interaction.isButton() && interaction.customId.startsWith('bj_')) {
    const parts = interaction.customId.split('_');
    const action = parts[1]; // 'hit' o 'stand'
    const gameId = parts.slice(2).join('_'); // resto es el gameId sin prefijo bj_
    const game = activeGames.get(gameId);

    if (!game) {
      return interaction.reply({ content: '❌ Este juego ya terminó.', flags: 64 });
    }

    if (game.userId !== interaction.user.id) {
      return interaction.reply({ content: '❌ Este no es tu juego.', flags: 64 });
    }

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
        activeGames.delete(gameId);

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
        icon = '🎉';
        resultBox = `╔═══════════════════════╗
║   � ¡VICTORIA! 🎊    ║
║                       ║
║   Ganancia: +${game.bet.toLocaleString()} 🪙   ║
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

      activeGames.delete(gameId);
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
        userData.coins += bet;
        userData.stats.gamesWon++;
        userData.stats.totalWinnings += bet;
        embed.setColor('#2ecc71')
          .setDescription(`╔═══════════════════╗\n║   🎉 **¡GANASTE!** 🎉    ║\n║  **+${bet.toLocaleString()} 🪙**  ║\n╚═══════════════════╝`);
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

      userData.coins += winnings;
      userData.stats.gamesPlayed++;
      
      if (winnings > 0) {
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
          { name: '💰 Apuesta', value: `**${bet.toLocaleString()}** 🪙`, inline: true }
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
        { name: '💰 Apuesta', value: `**${bet.toLocaleString()}** 🪙`, inline: false }
      );

    if (won) {
      userData.coins += winnings;
      userData.stats.gamesWon++;
      userData.stats.totalWinnings += winnings;
    } else {
      userData.coins += winnings;
      userData.stats.gamesLost++;
      userData.stats.totalLosses += Math.abs(winnings);
    }

    userData.stats.gamesPlayed++;
    updateUser(interaction.user.id, userData);

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
      winnings = bet * 2;
      userData.coins += bet;
      userData.stats.gamesWon++;
      userData.stats.totalWinnings += bet;
      result = `🎉 **¡VICTORIA!**`;
      color = '#2ecc71';
      resultBox = `╔═══════════════════╗\n║  🎉 **¡GANASTE!** 🎉   ║\n║   **+${bet.toLocaleString()} 🪙** (2x)   ║\n╚═══════════════════╝`;
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

    if (action === 'cashout') {
      const multipliers = [0, 2, 3, 5, 7, 10];
      const multiplier = multipliers[Math.min(game.streak, 5)];
      const winnings = game.bet * multiplier;

      const userData = getUser(interaction.user.id);
      userData.coins += winnings - game.bet;
      userData.stats.gamesPlayed++;
      userData.stats.gamesWon++;
      userData.stats.totalWinnings += winnings - game.bet;
      updateUser(interaction.user.id, userData);

      const streakMedals = ['', '✨', '⭐', '🌟', '💫', '💎'];
      const medal = streakMedals[Math.min(game.streak, 5)];

      const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('📊 Higher or Lower - ¡COBRADO!')
        .setDescription(`╔═══════════════════════╗\n║                                              ║\n║  ${medal} **¡PREMIO COBRADO!** ${medal}  ║\n║                                              ║\n║  💰 **+${(winnings - game.bet).toLocaleString()} 🪙**  ║\n║                                              ║\n╚═══════════════════════╝`)
        .addFields(
          { name: '🔥 Racha final', value: `**${game.streak}** ${medal}`, inline: true },
          { name: '💎 Multiplicador', value: `**${multiplier}x**`, inline: true },
          { name: '🏆 Ganancia', value: `**${(winnings - game.bet).toLocaleString()}** 🪙`, inline: true }
        )
        .setFooter({ text: `💰 Nuevo balance: ${userData.coins.toLocaleString()} 🪙 | ¡Excelente decisión!` });

      activeGames.delete(gameId);
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

        activeGames.delete(gameId);
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

        const challengerDice = [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1];
        const opponentDice = [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1];
        const challengerSum = challengerDice.reduce((a, b) => a + b, 0);
        const opponentSum = opponentDice.reduce((a, b) => a + b, 0);

        loadingEmbed.setDescription(`🎲 **Resultados:**\n\n${challenger.username}: [${challengerDice[0]}] [${challengerDice[1]}] = **${challengerSum}**\n${opponent.username}: [${opponentDice[0]}] [${opponentDice[1]}] = **${opponentSum}**`);
        await interaction.editReply({ embeds: [loadingEmbed] });
        await new Promise(resolve => setTimeout(resolve, 2000));

        if (challengerSum > opponentSum) {
          winner = duel.challenger;
          loser = duel.opponent;
        } else if (opponentSum > challengerSum) {
          winner = duel.opponent;
          loser = duel.challenger;
        } else {
          // Empate - ganador aleatorio
          winner = Math.random() < 0.5 ? duel.challenger : duel.opponent;
          loser = winner === duel.challenger ? duel.opponent : duel.challenger;
        }
        resultDetails = `${challenger.username}: **${challengerSum}** | ${opponent.username}: **${opponentSum}**`;

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
        const challengerChoice = choices[Math.floor(Math.random() * 3)];
        const opponentChoice = choices[Math.floor(Math.random() * 3)];

        loadingEmbed.setDescription(`✊ **Jugadas:**\n\n${challenger.username}: ${emojis[challengerChoice]} **${challengerChoice}**\n${opponent.username}: ${emojis[opponentChoice]} **${opponentChoice}**`);
        await interaction.editReply({ embeds: [loadingEmbed] });
        await new Promise(resolve => setTimeout(resolve, 2000));

        if (challengerChoice === opponentChoice) {
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
        resultDetails = `${emojis[challengerChoice]} vs ${emojis[opponentChoice]}`;

      } else if (gameType === 'guess') {
        loadingEmbed.setDescription('🔢 **Adivinando número (1-100)...**');
        await interaction.editReply({ embeds: [loadingEmbed] });
        await new Promise(resolve => setTimeout(resolve, 1500));

        const targetNumber = Math.floor(Math.random() * 100) + 1;
        const challengerGuess = Math.floor(Math.random() * 100) + 1;
        const opponentGuess = Math.floor(Math.random() * 100) + 1;
        const challengerDiff = Math.abs(targetNumber - challengerGuess);
        const opponentDiff = Math.abs(targetNumber - opponentGuess);

        loadingEmbed.setDescription(`🔢 **Número secreto: ${targetNumber}**\n\n${challenger.username}: **${challengerGuess}** (diferencia: ${challengerDiff})\n${opponent.username}: **${opponentGuess}** (diferencia: ${opponentDiff})`);
        await interaction.editReply({ embeds: [loadingEmbed] });
        await new Promise(resolve => setTimeout(resolve, 2000));

        if (challengerDiff < opponentDiff) {
          winner = duel.challenger;
          loser = duel.opponent;
        } else if (opponentDiff < challengerDiff) {
          winner = duel.opponent;
          loser = duel.challenger;
        } else {
          winner = Math.random() < 0.5 ? duel.challenger : duel.opponent;
          loser = winner === duel.challenger ? duel.opponent : duel.challenger;
        }
        resultDetails = `Número: **${targetNumber}** | ${challenger.username}: ${challengerGuess} | ${opponent.username}: ${opponentGuess}`;
      }

      // Actualizar datos de los jugadores
      const winnerData = getUser(winner);
      const loserData = getUser(loser);

      winnerData.coins += duel.bet;
      loserData.coins -= duel.bet;

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
          { name: '👑 Ganador', value: `${winnerUser}\n+${duel.bet.toLocaleString()} 🪙`, inline: true },
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

client.login(process.env.DISCORD_TOKEN);
