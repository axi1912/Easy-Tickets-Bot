# 🚂 Configuración de Variables de Entorno en Railway

## Variables Requeridas para tu bot

Copia y pega estas variables exactamente en Railway:

### Variables OBLIGATORIAS:

```
DISCORD_TOKEN=tu_token_del_bot
CLIENT_ID=tu_client_id
GUILD_ID=tu_guild_id
```

### Variables para los TICKETS (IMPORTANTE - agregar estas):

```
CATEGORIA_RECLUTAMIENTO=1419941893361631252
CATEGORIA_SOPORTE=1431157269453869086
ROL_STAFF=tu_rol_staff_id
```

## 📝 Pasos para configurar en Railway:

1. Ve a tu proyecto en Railway: https://railway.app
2. Selecciona tu servicio del bot
3. Haz clic en la pestaña **"Variables"**
4. Agrega cada variable (copia el nombre exacto y su valor)
5. El bot se redesplegar automáticamente

## ⚠️ Importante:

- Reemplaza `tu_token_del_bot`, `tu_client_id`, `tu_guild_id` y `tu_rol_staff_id` con tus valores reales
- Las categorías YA están configuradas arriba con tus IDs correctos
- El `ROL_STAFF` es el ID del rol que puede ver los tickets (ejemplo: rol "Staff", "Administrador", etc.)

## ✅ Para obtener los IDs que faltan:

1. **Token del bot**: https://discord.com/developers/applications (sección Bot)
2. **Client ID**: En la misma página, pestaña "General Information"
3. **Guild ID**: Clic derecho en tu servidor > Copiar ID (activa modo desarrollador primero)
4. **Rol Staff ID**: Clic derecho en el rol > Copiar ID

Una vez agregadas todas las variables, los tickets funcionarán correctamente.

