// ==========================================
// SCRIPT DE INICIO PARA PRODUCCIÓN (RAILWAY)
// 1. Registra comandos en Discord API
// 2. Inicia el bot modular
// ==========================================

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 INICIANDO BOT EN MODO PRODUCCIÓN\n');
console.log('📝 Paso 1: Registrando comandos en Discord...\n');

// Ejecutar deploy-commands.js
const deployProcess = spawn('node', [path.join(__dirname, 'deploy-commands.js')], {
  stdio: 'inherit'
});

deployProcess.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Comandos registrados exitosamente');
    console.log('🤖 Paso 2: Iniciando bot...\n');
    
    // Iniciar el bot
    const botProcess = spawn('node', [path.join(__dirname, 'index-modular.js')], {
      stdio: 'inherit'
    });
    
    botProcess.on('close', (botCode) => {
      console.error(`❌ Bot terminó con código ${botCode}`);
      process.exit(botCode);
    });
    
  } else {
    console.error(`\n⚠️  Error al registrar comandos (código ${code})`);
    console.log('🤖 Iniciando bot de todos modos...\n');
    
    // Iniciar el bot incluso si falla el deploy (por si ya están registrados)
    const botProcess = spawn('node', [path.join(__dirname, 'index-modular.js')], {
      stdio: 'inherit'
    });
    
    botProcess.on('close', (botCode) => {
      console.error(`❌ Bot terminó con código ${botCode}`);
      process.exit(botCode);
    });
  }
});

// Manejar señales de terminación
process.on('SIGINT', () => {
  console.log('\n🛑 Recibida señal de terminación');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Recibida señal de terminación');
  process.exit(0);
});
