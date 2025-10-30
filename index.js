const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits, REST, Routes } = require('discord.js');
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

// Obtener o crear usuario de economía
function getUser(userId) {
  const economy = loadEconomy();
  if (!economy[userId]) {
    economy[userId] = {
      coins: 1000,
      lastDaily: 0,
      inventory: [],
      titles: [],
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
  return economy[userId];
}

function updateUser(userId, data) {
  const economy = loadEconomy();
  economy[userId] = { ...economy[userId], ...data };
  saveEconomy(economy);
}

client.once('ready', async () => {
  console.log(`✅ Bot listo: ${client.user.tag}`);
  
  // Registrar comandos llamando a register.js
  try {
    console.log('🔄 Ejecutando register.js para registrar comandos...');
    const { execSync } = require('child_process');
    execSync('node register.js', { stdio: 'inherit' });
    console.log('✅ Comandos registrados');
  } catch (error) {
    console.error('❌ Error registrando comandos:', error.message);
  }
  
  // Crear backup inicial
  createBackup();
  
  // Backup automático cada hora (3600000 ms)
  setInterval(() => {
    createBackup();
  }, 3600000);
});

// Manejar mensajes para el juego de adivinar el número
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

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
      status: 'open'
    };
    saveTickets(tickets);

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
    const ticket = tickets[interaction.channel.id];

    if (!ticket) {
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
      status: 'open'
    };
    saveTickets(tickets);

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

    const duelId = `duel_${interaction.user.id}_${Date.now()}`;
    activeGames.set(duelId, {
      game: 'duel',
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
        { name: '🎯 Modalidad', value: 'Cara o Cruz', inline: true },
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

      // Animación del duelo
      const loadingEmbed = new EmbedBuilder()
        .setColor('#f39c12')
        .setTitle('⚔️ Duelo en Progreso')
        .setDescription('🪙 **Lanzando moneda...**');

      await interaction.update({ embeds: [loadingEmbed], components: [] });

      await new Promise(resolve => setTimeout(resolve, 1000));
      loadingEmbed.setDescription('💫 **Girando...**').setColor('#e67e22');
      await interaction.editReply({ embeds: [loadingEmbed] });

      await new Promise(resolve => setTimeout(resolve, 1000));
      loadingEmbed.setDescription('✨ **Cayendo...**').setColor('#f1c40f');
      await interaction.editReply({ embeds: [loadingEmbed] });

      await new Promise(resolve => setTimeout(resolve, 500));

      // Determinar ganador
      const winner = Math.random() < 0.5 ? duel.challenger : duel.opponent;
      const loser = winner === duel.challenger ? duel.opponent : duel.challenger;
      
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
        .setDescription(`╔═══════════════════════╗\n║                                              ║\n║   🏆 **¡${winnerUser.username.toUpperCase()} GANA!** 🏆   ║\n║                                              ║\n╚═══════════════════════╝`)
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
