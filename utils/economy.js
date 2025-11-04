// ==========================================
// UTILIDADES DE ECONOMÍA
// ==========================================

const fs = require('fs');
const config = require('../config/constants');

// Cargar economía desde el archivo JSON
function loadEconomy() {
  if (!fs.existsSync(config.FILES.ECONOMY)) return {};
  try {
    return JSON.parse(fs.readFileSync(config.FILES.ECONOMY, 'utf8'));
  } catch (error) {
    console.error('Error al cargar economía:', error);
    return {};
  }
}

// Guardar economía en el archivo JSON
function saveEconomy(economy) {
  try {
    fs.writeFileSync(config.FILES.ECONOMY, JSON.stringify(economy, null, 2));
  } catch (error) {
    console.error('Error al guardar economía:', error);
  }
}

// Obtener datos de un usuario (crea usuario si no existe)
function getUser(userId) {
  const economy = loadEconomy();
  
  if (!economy[userId]) {
    economy[userId] = {
      coins: 0,
      bank: 0,
      bankLastUpdate: Date.now(),
      lastDaily: 0,
      lastWork: 0,
      lastSpin: 0,
      lastRep: 0,
      streak: 0,
      lastStreak: 0,
      reputation: 0,
      inventory: [],
      stats: {
        gamesPlayed: 0,
        gamesWon: 0,
        gamesLost: 0,
        totalWinnings: 0,
        totalLosses: 0
      },
      loan: null,
      businesses: [],
      stocks: {},
      properties: [],
      crypto: {},
      marriage: null,
      clan: null,
      rpg: {
        class: null,
        level: 1,
        xp: 0,
        hp: 100,
        maxHp: 100,
        attack: 10,
        defense: 5,
        equipment: {
          weapon: null,
          armor: null,
          accessory: null
        },
        inventory: []
      },
      battlepass: {
        level: 0,
        xp: 0,
        premium: false,
        claimedTiers: []
      },
      dailyQuests: {
        quests: [],
        lastReset: 0
      }
    };
    saveEconomy(economy);
  }
  
  return economy[userId];
}

// Actualizar datos de un usuario
function updateUser(userId, userData) {
  const economy = loadEconomy();
  economy[userId] = userData;
  saveEconomy(economy);
}

// Transferir monedas entre usuarios
function transferCoins(fromUserId, toUserId, amount, commission = 0) {
  const economy = loadEconomy();
  const fromUser = getUser(fromUserId);
  const toUser = getUser(toUserId);
  
  const totalCost = amount + commission;
  
  if (fromUser.coins < totalCost) {
    return { success: false, message: 'Fondos insuficientes' };
  }
  
  fromUser.coins -= totalCost;
  toUser.coins += amount;
  
  updateUser(fromUserId, fromUser);
  updateUser(toUserId, toUser);
  
  return { success: true };
}

// Agregar item al inventario
function addItemToInventory(userId, item) {
  const userData = getUser(userId);
  
  const existingItem = userData.inventory.find(i => i.name === item.name);
  if (existingItem) {
    existingItem.quantity = (existingItem.quantity || 1) + (item.quantity || 1);
  } else {
    userData.inventory.push({
      name: item.name,
      type: item.type,
      quantity: item.quantity || 1,
      effect: item.effect || null,
      obtainedAt: Date.now()
    });
  }
  
  updateUser(userId, userData);
  return true;
}

// Remover item del inventario
function removeItemFromInventory(userId, itemName, quantity = 1) {
  const userData = getUser(userId);
  
  const itemIndex = userData.inventory.findIndex(i => i.name === itemName);
  if (itemIndex === -1) return false;
  
  const item = userData.inventory[itemIndex];
  item.quantity = (item.quantity || 1) - quantity;
  
  if (item.quantity <= 0) {
    userData.inventory.splice(itemIndex, 1);
  }
  
  updateUser(userId, userData);
  return true;
}

// Verificar si usuario tiene un item
function hasItem(userId, itemName) {
  const userData = getUser(userId);
  return userData.inventory.some(i => i.name === itemName && (i.quantity || 1) > 0);
}

// Obtener top usuarios por monedas
function getTopUsers(limit = 10) {
  const economy = loadEconomy();
  return Object.entries(economy)
    .sort(([, a], [, b]) => b.coins - a.coins)
    .slice(0, limit);
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

  const shuffled = possibleQuests.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3).map((q, i) => ({ ...q, id: `quest_${i}` }));
}

module.exports = {
  loadEconomy,
  saveEconomy,
  getUser,
  updateUser,
  transferCoins,
  addItemToInventory,
  removeItemFromInventory,
  hasItem,
  getTopUsers,
  generateDailyQuests
};
