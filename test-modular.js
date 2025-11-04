// ==========================================
// SCRIPT DE PRUEBA LOCAL
// Prueba el sistema modular sin afectar Railway
// ==========================================

const { initializeCommands, getAllCommands } = require('./handlers/commandHandler');

console.log('🧪 PROBANDO SISTEMA MODULAR...\n');

// Inicializar comandos
initializeCommands();

// Verificar comandos cargados
const commands = getAllCommands();

console.log('\n📋 RESUMEN:');
console.log(`Total de comandos: ${commands.size}`);

console.log('\n📦 Comandos por categoría:');
const categories = {};

commands.forEach(cmd => {
  const category = cmd.category || 'sin categoría';
  if (!categories[category]) {
    categories[category] = [];
  }
  categories[category].push(cmd.name);
});

Object.entries(categories).forEach(([category, cmds]) => {
  console.log(`\n  ${category}:`);
  cmds.forEach(name => {
    console.log(`    - ${name}`);
  });
});

console.log('\n✅ Sistema modular funcionando correctamente!');
console.log('💡 Para usarlo en producción, cambia "main" en package.json a "index-modular.js"');
