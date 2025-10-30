# 📘 Guía Completa - Ea$y Esports Bot

## 🤖 Descripción
Bot multifuncional para Ea$y Esports con sistema de tickets, economía avanzada, juegos de casino, duelos y entretenimiento.

---

# 👥 COMANDOS PARA USUARIOS

## 🎫 Sistema de Tickets

### Crear Ticket de Reclutamiento
- **Cómo usar:** Click en el botón "📝 Postularme" en el panel de reclutamiento
- **Qué hace:** Abre un formulario para postularte al equipo
- **Información requerida:**
  - Nombre y Edad
  - Activision ID
  - Rol y KD
  - Disponibilidad y Torneos
  - Presentación personal
- **Nota:** Solo puedes tener un ticket abierto a la vez

### Crear Ticket de Soporte
- **Tipos disponibles:**
  - 🐛 **Reporte de Bug** - Para reportar errores
  - ❓ **Duda/Consulta** - Para hacer preguntas
- **Cómo usar:** Click en el botón correspondiente del panel de soporte
- **Auto-cierre:** Si no respondes en 48 horas, el ticket se cierra automáticamente

---

## 💰 Sistema de Economía Básica

### `/balance [@usuario]`
- **Qué hace:** Muestra tus monedas o las de otro usuario
- **Info mostrada:** Monedas en mano, banco, inventario, estadísticas de juegos

### `/daily`
- **Qué hace:** Reclama 100 monedas gratis cada 24 horas
- **Cooldown:** 24 horas

### `/leaderboard`
- **Qué hace:** Muestra el top 10 de usuarios más ricos del servidor
- **Ordenado por:** Total de monedas (en mano + banco)

### `/give @usuario <cantidad>`
- **Qué hace:** Transfiere monedas a otro usuario
- **Comisión:** 5% del monto enviado
- **Ejemplo:** Si envías 1000 monedas, te cobran 1050 (1000 + 50 de comisión)
- **Restricciones:** No puedes enviarte a ti mismo ni a bots

---

## 💼 Economía Avanzada

### `/work`
- **Qué hace:** Trabaja para ganar monedas
- **Ganancias:** Entre 50 y 280 monedas (depende del trabajo asignado)
- **Trabajos disponibles:**
  - 💻 Programador (100-250 monedas)
  - 👨‍🍳 Chef (80-180 monedas)
  - 🚗 Conductor (70-150 monedas)
  - 👨‍🏫 Profesor (90-200 monedas)
  - 👨‍⚕️ Médico (120-280 monedas)
  - 🎮 Streamer (50-300 monedas)
- **Cooldown:** 1 hora

### `/bank accion:<Depositar/Retirar/Ver Balance> [cantidad]`
- **Ver Balance:** Muestra tu dinero en mano y en banco
- **Depositar:** Guarda monedas en tu banco (están seguras)
- **Retirar:** Saca monedas de tu banco
- **Beneficio:** El dinero en el banco está protegido

### `/loan accion:<Pedir préstamo/Ver estado/Pagar> [cantidad]`
- **Pedir préstamo:** 
  - Mínimo: 100 monedas
  - Máximo: 5,000 monedas
  - Interés: 10%
  - Plazo: 7 días
- **Ver estado:** Revisa tu préstamo activo y tiempo restante
- **Pagar:** Paga tu préstamo completo (no pagos parciales)
- **Restricción:** Solo puedes tener un préstamo a la vez

---

## 🎮 Juegos de Casino

### `/coinflip apuesta:<cantidad> eleccion:<Cara/Cruz>`
- **Cómo jugar:** Elige cara o cruz y apuesta
- **Premio:** Duplicas tu apuesta si aciertas
- **Probabilidad:** 50/50

### `/dice apuesta:<cantidad>`
- **Cómo jugar:** Lanzas 2 dados
- **Premios:**
  - Suma 12 (doble 6) = x5 tu apuesta (JACKPOT)
  - Suma 10-11 = x2 tu apuesta
  - Suma 7-9 = Recuperas tu apuesta
  - Suma 2-6 = Pierdes

### `/blackjack apuesta:<cantidad>`
- **Cómo jugar:** Llega lo más cerca de 21 sin pasarte
- **Botones:**
  - 👊 Hit - Pedir otra carta
  - 🛑 Stand - Plantarte con tu puntuación
- **Premios:**
  - Blackjack natural (21 con 2 cartas) = x2.5
  - Ganar = x2
  - Empate = Recuperas tu apuesta
  - Perder o pasarte de 21 = Pierdes

### `/roulette apuesta:<cantidad> eleccion:<Rojo/Negro/Verde>`
- **Cómo jugar:** Elige un color
- **Premios:**
  - Verde (0) = x14 (2.7% probabilidad)
  - Rojo o Negro = x2 (48.6% probabilidad cada uno)

### `/rps apuesta:<cantidad> eleccion:<Piedra/Papel/Tijera>`
- **Cómo jugar:** Clásico piedra, papel o tijera
- **Premio:** x2 si ganas
- **Empate:** Recuperas tu apuesta

### `/guess apuesta:<cantidad>`
- **Cómo jugar:** Adivina un número del 1 al 100
- **Intentos:** Máximo 5
- **Pistas:** Te dice si es mayor/menor y temperatura (caliente/frío)
- **Premios:**
  - 1er intento = x5
  - 2do intento = x4
  - 3er intento = x3
  - 4to intento = x2
  - 5to intento = x1

### `/higher-lower apuesta:<cantidad>`
- **Cómo jugar:** Carta inicial, debes adivinar si la siguiente es mayor o menor
- **Racha:** Cuantas más cartas aciertes, mayor el multiplicador
- **Premio:** x1 por cada acierto en racha
- **Puedes retirarte:** Botón "💰 Cobrar" para guardar tus ganancias

---

## ⚔️ Sistema de Duelos

### `/duel @oponente apuesta:<cantidad> [juego:<tipo>]`
- **Qué hace:** Reta a otro usuario a un duelo por monedas
- **Tipos de juego:**
  - 🪙 **Coinflip** (por defecto) - Lanzamiento de moneda al azar
  - 🎲 **Dados** - Cada jugador lanza 2 dados, mayor suma gana
  - 🃏 **Blackjack** - Reparten 2 cartas, más cerca de 21 gana
  - ✊ **Piedra/Papel/Tijera** - Clásico RPS
  - 🔢 **Adivinanza** - Número aleatorio 1-100, quien adivine más cerca gana
- **Cómo funciona:**
  1. Retas al oponente con una apuesta
  2. El oponente acepta o rechaza (60 segundos para decidir)
  3. Se juega el juego elegido automáticamente
  4. El ganador recibe las monedas del perdedor
- **Requisitos:** Ambos deben tener las monedas suficientes
- **Ejemplo:** `/duel @amigo apuesta:500 juego:Dados`

---

## 🛒 Tienda de Items

### `/shop`
- **Qué hace:** Muestra todos los items disponibles
- **Items:**
  - 🍀 **Amuleto de la Suerte** - 5,000 monedas
  - 🛡️ **Escudo Protector** - 3,000 monedas
  - 💎 **Multiplicador x2** - 10,000 monedas
  - ⚡ **Boost Diario** - 2,000 monedas
  - 👑 **Título VIP** - 15,000 monedas

### `/buy item:<nombre_del_item>`
- **Qué hace:** Compra un item de la tienda
- **Ejemplo:** `/buy item:lucky_charm`

### `/inventory [@usuario]`
- **Qué hace:** Muestra tu inventario o el de otro usuario
- **Info:** Lista de items comprados

---

## 🎯 Entretenimiento

### `/daily-quest`
- **Qué hace:** Muestra tus 3 misiones diarias
- **Misiones posibles:**
  - Juega 3 partidas en el casino (150 monedas)
  - Gana 2 partidas (200 monedas)
  - Trabaja 2 veces (100 monedas)
  - Transfiere monedas a otro usuario (120 monedas)
  - Reclama tu daily (80 monedas)
  - Gasta 500 monedas (180 monedas)
  - Participa en un duelo (150 monedas)
- **Recompensa:** Al completar las 3 misiones, recibes todas las recompensas
- **Renovación:** Se renuevan cada 24 horas

### `/spin`
- **Qué hace:** Gira la ruleta de premios gratis
- **Premios posibles:**
  - 💰 50 Monedas (30% probabilidad)
  - 💵 100 Monedas (25%)
  - 💎 250 Monedas (20%)
  - 🌟 500 Monedas (15%)
  - 👑 1,000 Monedas (7%)
  - 🎁 Item Aleatorio (3%)
- **Cooldown:** 24 horas (1 spin gratis al día)

### `/streak`
- **Qué hace:** Muestra tu racha de días consecutivos activos
- **Bonificaciones:**
  - 3 días = +50 monedas 🔥
  - 7 días = +100 monedas ⚡
  - 14 días = +250 monedas 💫
  - 30 días = +500 monedas 👑
- **Nota:** Si no entras un día, la racha se reinicia

---

## 📝 Comandos para Staff

### `/respuesta template:<nombre>`
- **Qué hace:** Envía una respuesta predefinida en tickets
- **Templates disponibles:**
  - 👋 **Bienvenida** - Saludo inicial al usuario
  - 🔍 **En revisión** - Ticket está siendo revisado
  - 📸 **Necesita pruebas** - Pedir evidencias adicionales
  - ✅ **Resuelto** - Problema solucionado
  - ❌ **Rechazado** - Solicitud rechazada
  - ⏱️ **En espera** - Esperando respuesta del usuario
  - 🔒 **Cerrar ticket** - Mensaje de cierre

---

# 👨‍💼 COMANDOS PARA STAFF/ADMINISTRADORES

## 🎫 Gestión de Tickets

### `/panel-reclutamiento`
- **Permisos:** Administrador
- **Qué hace:** Crea el panel de reclutamiento con el botón de postulación
- **Dónde usarlo:** En el canal de reclutamiento

### `/panel-soporte`
- **Permisos:** Administrador
- **Qué hace:** Crea el panel de soporte con botones de reporte y dudas
- **Dónde usarlo:** En el canal de soporte

### Botón "✋ Reclamar"
- **Dónde:** Aparece en cada ticket nuevo
- **Qué hace:** El staff reclama el ticket para atenderlo
- **Efecto:** Muestra quién está atendiendo el ticket

### Botón "🔒 Cerrar"
- **Dónde:** Aparece en cada ticket
- **Qué hace:** Cierra el ticket y elimina el canal
- **Log:** Se registra en el canal de logs
- **Tiempo:** Canal se elimina después de 5 segundos

### Auto-cierre de Tickets
- **Qué hace:** Cierra automáticamente tickets inactivos
- **Tiempo:** 48 horas sin respuesta del usuario
- **Aviso:** 30 segundos antes de cerrar
- **Log:** Se registra como cierre automático

---

## 💰 Gestión de Economía

### `/add-coins @usuario cantidad:<número>`
- **Permisos:** Administrador
- **Qué hace:** Agrega monedas a un usuario
- **Uso:** Recompensas, compensaciones, eventos
- **Log:** Visible para el usuario

### `/remove-coins @usuario cantidad:<número>`
- **Permisos:** Administrador
- **Qué hace:** Quita monedas a un usuario
- **Uso:** Sanciones, correcciones
- **Log:** Visible para el usuario

---

# ⚙️ CONFIGURACIÓN DEL BOT

## Variables de Entorno Requeridas

```env
DISCORD_TOKEN=tu_token_del_bot
CLIENT_ID=id_de_tu_aplicacion
GUILD_ID=id_de_tu_servidor
CATEGORIA_RECLUTAMIENTO=id_categoria_reclutamiento
CATEGORIA_SOPORTE=id_categoria_soporte
ROL_STAFF=id_rol_staff
```

## Características Técnicas

### Sistema de Backup Automático
- **Frecuencia:** Cada 1 hora
- **Archivos respaldados:** `economy.json`, `tickets.json`
- **Ubicación:** Carpeta `backups/`
- **Retención:** Últimos 10 backups

### Sistema Anti-Bug en Juegos
- **Protección:** Lock system para evitar juegos duplicados
- **Try/Catch/Finally:** Limpieza garantizada de recursos
- **Auto-limpieza:** Elimina juegos abandonados

### Persistencia de Datos
- **Formato:** JSON
- **Archivos:**
  - `economy.json` - Datos de economía de usuarios
  - `tickets.json` - Información de tickets activos
- **Actualización:** En tiempo real

---

# 📊 ESTADÍSTICAS Y DATOS

## Datos Guardados por Usuario

### Economía
- Monedas en mano
- Monedas en banco
- Inventario de items
- Títulos desbloqueados
- Última vez que usó `/daily`
- Última vez que trabajó (`/work`)
- Última vez que usó `/spin`
- Última actividad (para racha)
- Racha de días consecutivos
- Préstamo activo (si tiene)
- Misiones diarias (progreso)

### Estadísticas de Juegos
- Partidas jugadas
- Partidas ganadas
- Partidas perdidas
- Total ganado
- Total perdido

---

# 🎨 PERSONALIZACIÓN

## Colores de Embeds
- 🟢 Verde (#2ecc71) - Éxito, ganancias
- 🔴 Rojo (#e74c3c) - Error, pérdidas, cierres
- 🔵 Azul (#3498db) - Información, economía
- 🟡 Amarillo (#f39c12) - Advertencias, procesos
- 🟣 Morado (#9b59b6) - Misiones, eventos
- 🟠 Naranja (#e67e22) - Préstamos, alertas

## Emojis Utilizados
- 💰 💵 💎 🪙 - Monedas y economía
- 🎮 🎲 🎰 🃏 - Juegos
- ⚔️ 🛡️ 🏆 - Duelos y competencia
- 📋 🎫 📝 - Tickets
- 🔥 ⚡ 💫 👑 - Niveles y logros
- ✅ ❌ ⚠️ - Estados

---

# 🆘 SOLUCIÓN DE PROBLEMAS

## "Ya tienes un ticket abierto"
**Causa:** Solo puedes tener un ticket a la vez
**Solución:** Espera a que el staff cierre tu ticket actual

## "No tienes suficientes monedas"
**Causa:** Intentas gastar más de lo que tienes
**Solución:** 
- Usa `/balance` para ver tu saldo
- Trabaja con `/work`
- Reclama `/daily`
- Retira del banco si tienes ahorros

## "Ya has trabajado recientemente"
**Causa:** Cooldown de 1 hora activo
**Solución:** Espera el tiempo indicado

## "Ya tienes un préstamo activo"
**Causa:** Solo puedes tener un préstamo a la vez
**Solución:** Paga tu préstamo actual con `/loan accion:Pagar`

## "Ya has usado la ruleta hoy"
**Causa:** Solo 1 spin gratis cada 24 horas
**Solución:** Vuelve mañana

## Ticket cerrado por inactividad
**Causa:** No respondiste en 48 horas
**Solución:** Abre un nuevo ticket y responde más rápido

---

# 📈 TIPS Y CONSEJOS

## Para Ganar Monedas Rápido
1. Reclama `/daily` todos los días
2. Usa `/work` cada hora
3. Mantén tu racha activa para bonos extras
4. Completa las misiones diarias
5. Usa `/spin` gratis cada día
6. Juega inteligentemente en el casino (apuestas bajas al inicio)

## Para Maximizar Ganancias
1. Guarda monedas en el banco (están protegidas)
2. Usa préstamos sabiamente para inversión
3. Compra items estratégicamente
4. Participa en duelos cuando tengas ventaja
5. No gastes todo en juegos de azar

## Para Staff
1. Reclama tickets rápidamente
2. Usa `/respuesta` para ahorrar tiempo
3. Revisa el canal de logs regularmente
4. Usa `/add-coins` para recompensar buenos usuarios
5. Monitorea tickets que están por auto-cerrarse

---

# 📜 CHANGELOG

## Versión Actual
- ✅ Sistema de tickets (reclutamiento y soporte)
- ✅ Economía básica (balance, daily, leaderboard, give)
- ✅ Economía avanzada (work, bank, loan)
- ✅ 7 juegos de casino
- ✅ 5 tipos de duelos
- ✅ Tienda de items
- ✅ Misiones diarias
- ✅ Ruleta de premios
- ✅ Sistema de rachas
- ✅ Templates de respuestas para staff
- ✅ Sistema de backup automático
- ✅ Auto-cierre de tickets por inactividad
- ✅ Sistema anti-bug en juegos
- ✅ Transferencias con comisión del 5%

---

# 👨‍💻 INFORMACIÓN TÉCNICA

## Tecnologías
- **Discord.js:** v14.14.1
- **Node.js:** v18+
- **Hosting:** Railway
- **Base de datos:** JSON (archivos locales)

## Comandos Totales
- **Usuarios:** 20+ comandos
- **Staff:** 4 comandos exclusivos
- **Interacciones:** Botones, modales, selects

## Performance
- **Uptime:** 24/7 en Railway
- **Backups:** Cada hora
- **Verificación de tickets:** Cada 30 minutos
- **Cooldowns optimizados**

---

# 📞 SOPORTE

Para reportar bugs o sugerir mejoras, abre un ticket de soporte en el servidor.

**Creado por:** axi1912
**Versión:** 2.0
**Última actualización:** Octubre 2025

---

© 2025 Ea$y Esports Bot - Todos los derechos reservados
