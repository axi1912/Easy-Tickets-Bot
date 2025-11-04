const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { loadClans, saveClans } = require('../../../utils/helpers');
const { getUser, updateUser } = require('../../../utils/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clan')
    .setDescription('🛡️ Sistema de clanes')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Crear un nuevo clan')
        .addStringOption(option =>
          option.setName('nombre')
            .setDescription('Nombre del clan')
            .setRequired(true)
            .setMinLength(3)
            .setMaxLength(20))
        .addStringOption(option =>
          option.setName('tag')
            .setDescription('Tag del clan (3-5 caracteres)')
            .setRequired(true)
            .setMinLength(3)
            .setMaxLength(5)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('join')
        .setDescription('Unirse a un clan')
        .addStringOption(option =>
          option.setName('nombre')
            .setDescription('Nombre del clan')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('leave')
        .setDescription('Salir de tu clan actual'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('info')
        .setDescription('Ver información de un clan')
        .addStringOption(option =>
          option.setName('nombre')
            .setDescription('Nombre del clan (tu clan por defecto)')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('members')
        .setDescription('Ver miembros de un clan')
        .addStringOption(option =>
          option.setName('nombre')
            .setDescription('Nombre del clan (tu clan por defecto)')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('Eliminar tu clan (solo líder)'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('invite')
        .setDescription('Invitar a alguien a tu clan')
        .addUserOption(option =>
          option.setName('usuario')
            .setDescription('Usuario a invitar')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('kick')
        .setDescription('Expulsar a un miembro (solo líder)')
        .addUserOption(option =>
          option.setName('usuario')
            .setDescription('Usuario a expulsar')
            .setRequired(true))),
  
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const clans = loadClans();
    const userData = getUser(interaction.user.id);

    // ========== CREATE CLAN ==========
    if (subcommand === 'create') {
      const name = interaction.options.getString('nombre');
      const tag = interaction.options.getString('tag').toUpperCase();
      const cost = 5000;

      if (userData.clan) {
        return interaction.reply({ content: '❌ Ya estás en un clan. Usa `/clan leave` primero.', flags: 64 });
      }

      if (userData.coins < cost) {
        return interaction.reply({ 
          content: `❌ Necesitas **${cost.toLocaleString()} 🪙** para crear un clan. Tienes: **${userData.coins.toLocaleString()} 🪙**`, 
          flags: 64 
        });
      }

      if (clans[name.toLowerCase()]) {
        return interaction.reply({ content: '❌ Ya existe un clan con ese nombre.', flags: 64 });
      }

      const tagExists = Object.values(clans).some(c => c.tag === tag);
      if (tagExists) {
        return interaction.reply({ content: '❌ Ya existe un clan con ese tag.', flags: 64 });
      }

      userData.coins -= cost;
      userData.clan = name.toLowerCase();
      updateUser(interaction.user.id, userData);

      clans[name.toLowerCase()] = {
        name: name,
        tag: tag,
        leader: interaction.user.id,
        members: [interaction.user.id],
        createdAt: Date.now(),
        level: 1,
        xp: 0,
        bank: 0,
        wins: 0,
        losses: 0
      };

      saveClans(clans);

      const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('🛡️ Clan Creado')
        .setDescription(`Has creado el clan **${name}** [${tag}]`)
        .addFields(
          { name: '👑 Líder', value: `<@${interaction.user.id}>`, inline: true },
          { name: '👥 Miembros', value: '1', inline: true },
          { name: '💰 Costo', value: `${cost.toLocaleString()} 🪙`, inline: true }
        )
        .setFooter({ text: 'Invita miembros con /clan invite' });

      await interaction.reply({ embeds: [embed] });
    }

    // ========== JOIN CLAN ==========
    else if (subcommand === 'join') {
      const name = interaction.options.getString('nombre').toLowerCase();

      if (userData.clan) {
        return interaction.reply({ content: '❌ Ya estás en un clan. Usa `/clan leave` primero.', flags: 64 });
      }

      const clan = clans[name];
      if (!clan) {
        return interaction.reply({ content: '❌ Ese clan no existe.', flags: 64 });
      }

      if (clan.members.length >= 20) {
        return interaction.reply({ content: '❌ Ese clan está lleno (máximo 20 miembros).', flags: 64 });
      }

      clan.members.push(interaction.user.id);
      userData.clan = name;
      updateUser(interaction.user.id, userData);
      saveClans(clans);

      const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('🛡️ Unido al Clan')
        .setDescription(`Te has unido a **${clan.name}** [${clan.tag}]`)
        .addFields(
          { name: '👥 Miembros', value: `${clan.members.length}/20`, inline: true },
          { name: '🏆 Nivel', value: `${clan.level}`, inline: true }
        );

      await interaction.reply({ embeds: [embed] });
    }

    // ========== LEAVE CLAN ==========
    else if (subcommand === 'leave') {
      if (!userData.clan) {
        return interaction.reply({ content: '❌ No estás en ningún clan.', flags: 64 });
      }

      const clan = clans[userData.clan];
      if (clan.leader === interaction.user.id) {
        return interaction.reply({ 
          content: '❌ Eres el líder del clan. Usa `/clan delete` para eliminar el clan o transfiere el liderazgo primero.', 
          flags: 64 
        });
      }

      clan.members = clan.members.filter(m => m !== interaction.user.id);
      userData.clan = null;
      updateUser(interaction.user.id, userData);
      saveClans(clans);

      await interaction.reply({ content: `✅ Has salido del clan **${clan.name}**.`, flags: 64 });
    }

    // ========== INFO ==========
    else if (subcommand === 'info') {
      const name = interaction.options.getString('nombre')?.toLowerCase() || userData.clan;

      if (!name) {
        return interaction.reply({ content: '❌ No estás en un clan y no especificaste ninguno.', flags: 64 });
      }

      const clan = clans[name];
      if (!clan) {
        return interaction.reply({ content: '❌ Ese clan no existe.', flags: 64 });
      }

      const leader = await interaction.client.users.fetch(clan.leader).catch(() => null);
      const winRate = clan.wins + clan.losses > 0 ? Math.floor((clan.wins / (clan.wins + clan.losses)) * 100) : 0;

      const embed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setTitle(`🛡️ ${clan.name} [${clan.tag}]`)
        .addFields(
          { name: '👑 Líder', value: leader ? leader.username : 'Desconocido', inline: true },
          { name: '👥 Miembros', value: `${clan.members.length}/20`, inline: true },
          { name: '🏆 Nivel', value: `${clan.level}`, inline: true },
          { name: '💰 Banco del Clan', value: `${clan.bank.toLocaleString()} 🪙`, inline: true },
          { name: '⚔️ Victorias', value: `${clan.wins}`, inline: true },
          { name: '💀 Derrotas', value: `${clan.losses}`, inline: true },
          { name: '📊 Win Rate', value: `${winRate}%`, inline: true },
          { name: '📅 Creado', value: `<t:${Math.floor(clan.createdAt / 1000)}:R>`, inline: true }
        );

      await interaction.reply({ embeds: [embed] });
    }

    // ========== MEMBERS ==========
    else if (subcommand === 'members') {
      const name = interaction.options.getString('nombre')?.toLowerCase() || userData.clan;

      if (!name) {
        return interaction.reply({ content: '❌ No estás en un clan y no especificaste ninguno.', flags: 64 });
      }

      const clan = clans[name];
      if (!clan) {
        return interaction.reply({ content: '❌ Ese clan no existe.', flags: 64 });
      }

      let memberList = '';
      for (let i = 0; i < clan.members.length; i++) {
        const memberId = clan.members[i];
        const isLeader = memberId === clan.leader;
        memberList += `${i + 1}. <@${memberId}> ${isLeader ? '👑' : ''}\n`;
      }

      const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle(`👥 Miembros de ${clan.name}`)
        .setDescription(memberList || 'Sin miembros')
        .setFooter({ text: `${clan.members.length}/20 miembros` });

      await interaction.reply({ embeds: [embed] });
    }

    // ========== DELETE ==========
    else if (subcommand === 'delete') {
      if (!userData.clan) {
        return interaction.reply({ content: '❌ No estás en ningún clan.', flags: 64 });
      }

      const clan = clans[userData.clan];
      if (clan.leader !== interaction.user.id) {
        return interaction.reply({ content: '❌ Solo el líder puede eliminar el clan.', flags: 64 });
      }

      // Remover clan de todos los miembros
      for (let memberId of clan.members) {
        const memberData = getUser(memberId);
        memberData.clan = null;
        updateUser(memberId, memberData);
      }

      delete clans[userData.clan];
      saveClans(clans);

      await interaction.reply({ content: `✅ El clan **${clan.name}** ha sido eliminado.` });
    }

    // ========== INVITE ==========
    else if (subcommand === 'invite') {
      const target = interaction.options.getUser('usuario');

      if (!userData.clan) {
        return interaction.reply({ content: '❌ No estás en ningún clan.', flags: 64 });
      }

      const clan = clans[userData.clan];
      const targetData = getUser(target.id);

      if (targetData.clan) {
        return interaction.reply({ content: '❌ Ese usuario ya está en un clan.', flags: 64 });
      }

      if (clan.members.length >= 20) {
        return interaction.reply({ content: '❌ Tu clan está lleno (máximo 20 miembros).', flags: 64 });
      }

      await interaction.reply({ 
        content: `📨 ${target}, has sido invitado a unirte al clan **${clan.name}** [${clan.tag}]. Usa \`/clan join ${clan.name}\` para unirte.` 
      });
    }

    // ========== KICK ==========
    else if (subcommand === 'kick') {
      const target = interaction.options.getUser('usuario');

      if (!userData.clan) {
        return interaction.reply({ content: '❌ No estás en ningún clan.', flags: 64 });
      }

      const clan = clans[userData.clan];
      if (clan.leader !== interaction.user.id) {
        return interaction.reply({ content: '❌ Solo el líder puede expulsar miembros.', flags: 64 });
      }

      if (target.id === interaction.user.id) {
        return interaction.reply({ content: '❌ No puedes expulsarte a ti mismo. Usa `/clan delete` para eliminar el clan.', flags: 64 });
      }

      if (!clan.members.includes(target.id)) {
        return interaction.reply({ content: '❌ Ese usuario no está en tu clan.', flags: 64 });
      }

      clan.members = clan.members.filter(m => m !== target.id);
      const targetData = getUser(target.id);
      targetData.clan = null;
      updateUser(target.id, targetData);
      saveClans(clans);

      await interaction.reply({ content: `✅ ${target} ha sido expulsado del clan **${clan.name}**.` });
    }
  }
};
