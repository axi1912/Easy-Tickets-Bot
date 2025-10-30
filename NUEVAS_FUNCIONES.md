# 🎉 Nuevas Funcionalidades Implementadas

## 1. 📦 Sistema de Backup Automático

**¿Qué hace?**
- Crea copias de seguridad de `economy.json` y `tickets.json` cada hora
- Mantiene solo los últimos 10 backups de cada archivo
- Los backups se guardan en la carpeta `backups/` con timestamp

**Ventajas:**
- ✅ Protección contra pérdida de datos
- ✅ Totalmente automático, no requiere intervención
- ✅ No modifica nada visual en Discord

**Ubicación:** Los backups se crean en `./backups/economy_TIMESTAMP.json` y `./backups/tickets_TIMESTAMP.json`

---

## 2. 📝 Templates de Respuestas Rápidas para Staff

**Comando:** `/respuesta <template>`

**Templates disponibles:**
- 👋 **Bienvenida** - Mensaje inicial de bienvenida
- 🔍 **En revisión** - Caso está siendo revisado
- 📸 **Necesita pruebas** - Solicitar capturas/pruebas
- ✅ **Resuelto** - Caso resuelto exitosamente
- ❌ **Rechazado** - Solicitud rechazada
- ⏱️ **En espera** - Alto volumen de tickets
- 🔒 **Cerrar ticket** - Mensaje de cierre

**Cómo usar:**
1. El staff abre un ticket
2. Usa `/respuesta bienvenida` (o cualquier otro template)
3. El bot envía automáticamente el mensaje predefinido

**Ventajas:**
- ✅ Respuestas consistentes y profesionales
- ✅ Ahorra tiempo al staff
- ✅ Solo accesible para roles con permisos

---

## 3. 💸 Transferencias con Comisión (Mejorado)

**Comando:** `/give <usuario> <cantidad>`

**Cambios:**
- ✅ Ahora cobra una **comisión del 5%** en cada transferencia
- ✅ Muestra claramente el monto enviado, la comisión y el total cobrado
- ✅ Validaciones mejoradas

**Ejemplo:**
```
/give @Usuario 1000
```
- Monto enviado: 1000 🪙
- Comisión (5%): 50 🪙
- Total cobrado: 1050 🪙

**Ventajas:**
- ✅ Controla la economía del servidor
- ✅ Evita transferencias masivas sin costo
- ✅ Hace que los daily y juegos sean más valiosos

---

## 4. ⚔️ Sistema de Duelos

**Comando:** `/duel <oponente> <apuesta>`

**¿Cómo funciona?**
1. Usuario A reta a Usuario B con una apuesta
2. Usuario B tiene 60 segundos para aceptar o rechazar
3. Si acepta, se lanza una moneda virtual
4. El ganador se lleva las monedas del perdedor

**Características:**
- ✅ Sistema de aceptar/rechazar con botones
- ✅ Animación de lanzamiento de moneda
- ✅ Auto-cancelación tras 60 segundos
- ✅ Validaciones de saldo para ambos jugadores
- ✅ Actualiza estadísticas de victoria/derrota

**Ejemplo:**
```
/duel @Amigo 500
```
El ganador se lleva 500 🪙 del perdedor.

---

## 5. 🛒 Tienda de Items

### Comandos:
- `/shop` - Ver items disponibles
- `/buy <item>` - Comprar un item
- `/inventory [usuario]` - Ver inventario

### Items Disponibles:

| Item | Precio | Descripción |
|------|--------|-------------|
| 🍀 Amuleto de la Suerte | 5,000 🪙 | +10% probabilidad de ganar (24h) |
| 🛡️ Escudo Protector | 3,000 🪙 | Protege 50% de pérdidas (12h) |
| 💎 Multiplicador x2 | 10,000 🪙 | Duplica ganancias (1h) |
| ⚡ Boost Diario | 2,000 🪙 | Daily da 500 extra (7 días) |
| 👑 Título VIP | 15,000 🪙 | Título permanente "VIP" |

**Cómo comprar:**
```
/shop                    # Ver items
/buy lucky_charm         # Comprar amuleto
/inventory               # Ver tus items activos
```

**Características:**
- ✅ Items temporales con duración
- ✅ Items permanentes (títulos)
- ✅ Sistema de expiración automática
- ✅ Inventario compartible (puedes ver el de otros usuarios)

---

## 📊 Resumen de Cambios

**Archivos modificados:**
- ✅ `index.js` - Toda la lógica nueva
- ✅ `register.js` - Registro de nuevos comandos
- ✅ `.gitignore` - Excluir backups del repositorio

**Nuevos comandos agregados:**
1. `/duel` - Sistema de duelos
2. `/shop` - Ver tienda
3. `/buy` - Comprar items
4. `/inventory` - Ver inventario
5. `/respuesta` - Templates de staff

**Comandos modificados:**
1. `/give` - Ahora con comisión del 5%

---

## 🚀 Próximos Pasos

**Una vez desplegado en Railway:**
1. Los backups comenzarán automáticamente cada hora
2. Los nuevos comandos estarán disponibles
3. El staff puede usar `/respuesta` en tickets
4. Los usuarios pueden comprar items con `/shop`
5. Los duelos estarán activos con `/duel`

**Nota:** Railway registrará automáticamente los comandos cuando se despliegue. No necesitas hacer nada manual.

---

## 💡 Consejos de Uso

**Para Staff:**
- Usa `/respuesta` en canales de tickets para respuestas rápidas
- Los templates ayudan a mantener consistencia

**Para Usuarios:**
- Junta monedas con juegos y daily
- Compra items para ventajas temporales
- Reta a tus amigos con `/duel`
- Las transferencias tienen comisión, úsalas sabiamente

**Para Administradores:**
- Los backups están en `./backups/`
- Puedes restaurar manualmente si es necesario
- La comisión del 5% ayuda a balancear la economía

---

## 🔧 Configuración Adicional

**No se requiere configuración extra en Railway**. Todo está listo para funcionar.

Los únicos archivos que debes tener configurados en Railway son:
- `DISCORD_TOKEN`
- `CLIENT_ID`
- `GUILD_ID`
- `CATEGORIA_RECLUTAMIENTO=1419941893361631252`
- `CATEGORIA_SOPORTE=1431157269453869086`
- `ROL_STAFF=1241211764100698203`

¡Todo lo demás funciona automáticamente! 🎉
