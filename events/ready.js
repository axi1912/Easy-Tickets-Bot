// Evento ready - Se ejecuta cuando el bot se conecta
module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    console.log(`✅ Bot iniciado como ${client.user.tag}`);
    console.log(`📊 Servidores: ${client.guilds.cache.size}`);
    console.log(`👥 Usuarios: ${client.users.cache.size}`);
    
    // Establecer estado del bot
    client.user.setPresence({
      activities: [{ name: '/help | Easy Esports', type: 0 }],
      status: 'online'
    });

    // Mostrar comandos cargados
    const commandCount = client.commands?.size || 0;
    console.log(`🎮 ${commandCount} comandos cargados`);
  }
};
