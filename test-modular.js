// ==========================================
// SCRIPT DE PRUEBA LOCAL
// Prueba el sistema modular sin afectar Railway
// ==========================================

const CommandHandler = require('./handlers/commandHandler');

console.log('🧪 PROBANDO SISTEMA MODULAR...\n');

// Crear instancia del CommandHandler
const handler = new CommandHandler();

// Inicializar comandos
handler.initializeCommands();

// Verificar comandos cargados
const commands = handler.getAllCommands();

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
