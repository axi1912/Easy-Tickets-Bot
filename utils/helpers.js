// ==========================================
// FUNCIONES AUXILIARES Y HELPERS
// ==========================================

const fs = require('fs');
const config = require('../config/constants');

// Cargar clanes
function loadClans() {
  if (!fs.existsSync(config.FILES.CLANS)) return {};
  try {
    return JSON.parse(fs.readFileSync(config.FILES.CLANS, 'utf8'));
  } catch (error) {
    console.error('Error al cargar clanes:', error);
    return {};
  }
}

// Guardar clanes
function saveClans(clans) {
  try {
    fs.writeFileSync(config.FILES.CLANS, JSON.stringify(clans, null, 2));
  } catch (error) {
    console.error('Error al guardar clanes:', error);
  }
}

// Cargar datos persistentes
function loadPersistent() {
  if (!fs.existsSync(config.FILES.PERSISTENT)) {
    return { activeGames: [], cooldowns: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(config.FILES.PERSISTENT, 'utf8'));
  } catch (error) {
    console.error('Error al cargar persistentes:', error);
    return { activeGames: [], cooldowns: {} };
  }
}

// Guardar datos persistentes
function savePersistent(data) {
  try {
    fs.writeFileSync(config.FILES.PERSISTENT, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error al guardar persistentes:', error);
  }
}

// Obtener roles del staff
function getStaffRoles() {
  return config.STAFF_ROLES;
}

// Agregar XP al Battle Pass con boost
function addBattlePassXP(userData, xp) {
  let finalXP = xp;
  
  // Verificar si tiene boost activo
  if (userData.battlepass && userData.battlepass.xpBoost && Date.now() < userData.battlepass.xpBoost) {
    finalXP = xp * 2; // Doble XP
  }
  
  if (!userData.battlepass) {
    userData.battlepass = {
      level: 0,
      xp: 0,
      premium: false,
      claimedTiers: [],
      xpBoost: null
    };
  }
  
  userData.battlepass.xp = (userData.battlepass.xp || 0) + finalXP;
  
  // Subir de nivel si es necesario
  while (userData.battlepass.xp >= config.BATTLEPASS.XP_PER_LEVEL && userData.battlepass.level < config.BATTLEPASS.MAX_LEVEL) {
    userData.battlepass.xp -= config.BATTLEPASS.XP_PER_LEVEL;
    userData.battlepass.level++;
  }
  
  return { 
    finalXP, 
    hasBoost: finalXP > xp,
    newLevel: userData.battlepass.level
  };
}

// Verificar si un usuario tiene un juego activo
function hasActiveGame(userId, gameType, activeGamesMap) {
  for (const [gameId, game] of activeGamesMap.entries()) {
    if (game.userId === userId) {
      if (gameType) {
        if (gameId.startsWith(gameType)) {
          return { hasGame: true, gameId };
        }
      } else {
        return { hasGame: true, gameId };
      }
    }
  }
  return { hasGame: false };
}

// Crear backup de archivos
function createBackup() {
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const backupDir = './backups';
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
  }
  
  try {
    // Backup de economía
    if (fs.existsSync(config.FILES.ECONOMY)) {
      fs.copyFileSync(
        config.FILES.ECONOMY,
        `${backupDir}/economy_${timestamp}.json`
      );
    }
    
    // Backup de persistentes
    if (fs.existsSync(config.FILES.PERSISTENT)) {
      fs.copyFileSync(
        config.FILES.PERSISTENT,
        `${backupDir}/persistent_${timestamp}.json`
      );
    }
    
    // Backup de tickets
    if (fs.existsSync(config.FILES.TICKETS)) {
      fs.copyFileSync(
        config.FILES.TICKETS,
        `${backupDir}/tickets_${timestamp}.json`
      );
    }
    
    console.log(`✅ Backup creado: ${timestamp}`);
    return true;
  } catch (error) {
    console.error('❌ Error al crear backup:', error);
    return false;
  }
}

// Formatear número con separadores de miles
function formatNumber(number) {
  return number.toLocaleString('es-ES');
}

// Calcular tiempo restante en formato legible
function formatTime(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// Generar ID único para juegos
function generateGameId(gameType, userId) {
  return `${gameType}_${userId}_${Date.now()}`;
}

// Calcular multiplicador de racha
function getStreakMultiplier(streak) {
  if (streak >= 30) return 2.0;
  if (streak >= 14) return 1.5;
  if (streak >= 7) return 1.25;
  if (streak >= 3) return 1.1;
  return 1.0;
}

module.exports = {
  loadClans,
  saveClans,
  loadPersistent,
  savePersistent,
  getStaffRoles,
  addBattlePassXP,
  hasActiveGame,
  createBackup,
  formatNumber,
  formatTime,
  generateGameId,
  getStreakMultiplier
};
