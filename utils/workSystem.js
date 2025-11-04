// Sistema de trabajos - Datos y funciones
const getJobsData = (workLevel) => {
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
};

// Calcular XP necesario para siguiente nivel
const getXPForLevel = (level) => {
  return level * 200; // Nivel 1 = 200 XP, Nivel 2 = 400 XP, etc.
};

// Calcular pago base según nivel y turno
const calculatePay = (baseMin, baseMax, workLevel, shift) => {
  const levelBonus = 1 + (workLevel - 1) * 0.15; // +15% por nivel
  const shiftMultiplier = { '2h': 1, '4h': 2.2, '8h': 4.5 }[shift];
  
  const min = Math.floor(baseMin * levelBonus * shiftMultiplier);
  const max = Math.floor(baseMax * levelBonus * shiftMultiplier);
  
  return { min, max };
};

module.exports = {
  getJobsData,
  getXPForLevel,
  calculatePay
};
