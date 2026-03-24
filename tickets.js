const {
  Client, EmbedBuilder, ButtonBuilder, ButtonStyle,
  ActionRowBuilder, ChannelType, PermissionsBitField, AttachmentBuilder
} = require('discord.js');

// ══════════════════════════════════════════
//   CONFIGURATION — SUPPORT
// ══════════════════════════════════════════
const TOKEN      = process.env.TOKEN;
const GUILD_ID   = '1432472817005236326';
const ROLE_CLAIM = '1432472817005236328';

// Salon où envoyer l'embed des tickets Support
const SALON_SUPPORT_EMBED = '1485888062423699466';

// Salon où envoyer l'embed des tickets Modérateur
const SALON_MOD_EMBED = '1485785710446510219';

// ── Rôles Staff (accès tickets Support) ──
const ROLES_STAFF = [
  '1432841223118262413',
  '1433053281327775845',
  '1432840939658940456',
  '1432840844754292766',
  '1433052694670475334',
  '1432839854911127625',
  '1432472817349431365',
  '1474093816398221463',
  '1474093820785332458',
  '1474133714391793784',
];

// ── Rôles Modérateurs (accès tickets Modérateur) ──
const ROLES_MOD = [
  '1432840715020407014',
  '1433053130827894844',
  '1432472817349431360',
  '1432472817349431361',
  '1432839854911127625',
  '1432472817349431365',
  '1474093816398221463',
  '1474093820785332458',
];

// ── Mentions dans les tickets Modérateur ──
const PING_ROLES_MOD = [
  '1432840715020407014',
  '1433053130827894844',
  '1432472817349431360',
];

// ── Rôles pouvant fermer / transférer les tickets Support ──
const ROLES_TRANSFER = [
  '1432840844754292766',
  '1433052694670475334',
  '1432839854911127625',
  '1432472817349431365',
  '1474093816398221463',
  '1474093820785332458',
  '1474133714391793784',
];

// ── Rôles pouvant utiliser !forcetransfertclaim ──
const ROLES_FORCE_TRANSFER = [
  '1432840844754292766',
  '1433052694670475334',
  '1432839854911127625',
  '1432472817349431365',
  '1474093816398221463',
  '1474093820785332458',
];

// ══════════════════════════════════════════
//   TYPES DE TICKETS — SUPPORT
// ══════════════════════════════════════════
const TICKET_TYPES_SUPPORT = {
  verif:    { label: '✅ Aide à la vérification', prefix: 'ticket-aide-verif',     categorie: '1486044912762749098', transcript: '1485786365726556220' },
  unban:    { label: '🔓 Aide débannissement',    prefix: 'ticket-aide-unban',     categorie: '1433829573623021770', transcript: '1485786433057722468' },
  question: { label: '💡 Aide question',          prefix: 'ticket-aide-question',  categorie: '1473993226406068316', transcript: '1485786483423187004' },
  signal:   { label: '📢 Aide au signalement',    prefix: 'ticket-aide-signal',    categorie: '1453777812472332381', transcript: '1485786528364888104' },
  autre:    { label: '🧩 Autre Aide',             prefix: 'ticket-aide-autre',     categorie: '1474726655967760577', transcript: '1485786561227526174' },
};

// ══════════════════════════════════════════
//   TYPES DE TICKETS — MODÉRATEUR
// ══════════════════════════════════════════
const TICKET_TYPES_MOD = {
  mod_unban:       { label: '🚫 Débannir',            prefix: 'ticket-unban',        categorie: '1486138898144034896', transcript: '1486139683326136462' },
  mod_report:      { label: '🚩 Signaler',             prefix: 'ticket-report',       categorie: '1486139067556040817', transcript: '1486139734529933483' },
  mod_reportbug:   { label: '🐞 Signaler bug',         prefix: 'ticket-report-bug',   categorie: '1486139175332745377', transcript: '1486139766436134992' },
  mod_reportstaff: { label: '👮 Signaler staff',       prefix: 'ticket-report-staff', categorie: '1486139424931578028', transcript: '1486139790075101355' },
  mod_autre:       { label: '🧩 Autre type de ticket', prefix: 'ticket-others',       categorie: '1486139523149856839', transcript: '1486139841233293454' },
};

// ── Fusion des deux pour la résolution rapide par type ──
const ALL_TICKET_TYPES = { ...TICKET_TYPES_SUPPORT, ...TICKET_TYPES_MOD };

// ── Compteurs ──
const ticketCounters = {
  verif: 0, unban: 0, question: 0, signal: 0, autre: 0,
  mod_unban: 0, mod_report: 0, mod_reportbug: 0, mod_reportstaff: 0, mod_autre: 0,
};

// channelId -> { type, creatorId, claimedBy, openedAt, timers, numero, ismod }
const ticketData = {};

// userId -> channelId (1 ticket Support par personne)
const userTickets = {};

// userId -> channelId (1 ticket Modérateur par personne)
const userTicketsMod = {};

// userId -> channelId (en attente de mention pour transfert)
const pendingTransfer = {};

// ══════════════════════════════════════════
//   CLIENT
// ══════════════════════════════════════════
const client = new Client({
  intents: [33283 | 512 | 32768 | 2],
});

// ══════════════════════════════════════════
//   UTILITAIRES
// ══════════════════════════════════════════
function padNum(n) {
  return String(n).padStart(4, '0');
}

// Discord n'accepte pas les emojis unicode dans les noms de salons.
// Préfixes texte : vert → jaune → orange → rouge → noir
function getColorPrefix(openedAt) {
  const min = (Date.now() - openedAt) / 60000;
  if (min < 5)             return 'vert';
  if (min < 15)            return 'jaune';
  if (min < 45)            return 'orange';
  if (min < 24 * 60 + 45) return 'rouge';
  return 'noir';
}

async function renameChannel(channel, data) {
  const type   = ALL_TICKET_TYPES[data.type];
  const num    = padNum(data.numero);
  const color  = getColorPrefix(data.openedAt);
  const status = data.claimedBy ? 'claim' : 'unclaim';
  const name   = status + '-' + color + '-' + type.prefix + '-' + num;
  await channel.setName(name).catch(e => console.error('❌ Rename échoué:', e.message));
}

function scheduleTimers(channel, data) {
  if (data.timers) data.timers.forEach(t => clearTimeout(t));
  data.timers = [];
  if (data.claimedBy) return;
  const times = [5 * 60000, 15 * 60000, 45 * 60000, (24 * 60 + 45) * 60000];
  times.forEach(ms => {
    const t = setTimeout(async () => {
      const current = ticketData[channel.id];
      if (!current || current.claimedBy) return;
      await renameChannel(channel, current);
    }, ms);
    data.timers.push(t);
  });
}

async function makeTranscript(channel) {
  const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
  if (!messages) return 'Impossible de récupérer les messages.';
  const sorted = [...messages.values()].reverse();
  return sorted.map(m => {
    const time = m.createdAt.toLocaleString('fr-FR');
    return '[' + time + '] ' + m.author.tag + ' : ' + (m.content || '[embed/fichier]');
  }).join('\n');
}

async function sendTransferEmbed(channel, ticketName, newOwnerId, initiatorId, forced = false) {
  const now     = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const embed = new EmbedBuilder()
    .setTitle('🔄  Transfert de Propriété')
    .setColor(0x5865f2)
    .setDescription('> La prise en charge de ce ticket a été transférée avec succès.\n\u200b')
    .addFields(
      { name: '🎫  Ticket concerné',    value: '`' + ticketName + '`',                                              inline: true },
      { name: '👤  Nouveau responsable', value: '<@' + newOwnerId + '>',                                             inline: true },
      { name: '\u200b',                  value: '\u200b',                                                             inline: true },
      { name: '🛠️  Initié par',         value: '<@' + initiatorId + '>' + (forced ? '  *(transfert forcé)*' : ''), inline: true },
      { name: '📅  Date & heure',        value: dateStr + ' à ' + timeStr,                                           inline: true },
    )
    .setFooter({ text: 'Support — Topia FR RP  •  Toute demande doit passer par un ticket.' })
    .setTimestamp();

  await channel.send({ embeds: [embed] });
}

// ── Création de ticket générique (support ou mod) ──
async function createTicket(interaction, type, typeInfo, rolesAccess, pingRolesIds, ismod) {
  const { member, guild } = interaction;
  const store = ismod ? userTicketsMod : userTickets;

  if (store[member.id]) {
    const existing = guild.channels.cache.get(store[member.id]);
    if (existing) {
      return interaction.reply({
        content: '❌ Tu as déjà un ticket ouvert : ' + existing.toString() + '\nFerme-le avant d\'en ouvrir un nouveau !',
        ephemeral: true,
      });
    }
    delete store[member.id];
  }

  await interaction.deferReply({ ephemeral: true });

  ticketCounters[type]++;
  const numero = ticketCounters[type];
  const num    = padNum(numero);
  const channelName = 'unclaim-vert-' + typeInfo.prefix + '-' + num;

  const permissionOverwrites = [
    { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    {
      id: member.id,
      allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
    },
  ];
  rolesAccess.forEach(roleId => {
    permissionOverwrites.push({
      id: roleId,
      allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
    });
  });

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: typeInfo.categorie,
    permissionOverwrites,
  }).catch(e => { console.error('❌ Création ticket:', e.code, e.message); return null; });

  if (!channel) {
    return interaction.editReply({ content: '❌ Impossible de créer le ticket. Contacte un administrateur.' });
  }

  store[member.id] = channel.id;
  ticketData[channel.id] = {
    type, creatorId: member.id, claimedBy: null,
    openedAt: Date.now(), timers: [], numero, ismod,
  };
  scheduleTimers(channel, ticketData[channel.id]);

  const embedTicket = new EmbedBuilder()
    .setTitle('🎫 Ticket Créé')
    .setColor(ismod ? 0xef4444 : 0x22c55e)
    .setDescription(
      'Bienvenue <@' + member.id + '> !\n\n' +
      '> Veuillez patienter, un membre ' + (ismod ? 'de la modération' : 'du staff') + ' prendra en charge votre demande dans les meilleurs délais.\n\n' +
      '**Catégorie :** ' + typeInfo.label + '\n' +
      '**Ticket n° :** ' + num
    )
    .setFooter({ text: ismod ? 'Modération — Topia FR RP' : 'Support — Topia FR RP' })
    .setTimestamp();

  const rowTicket = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('claim_ticket').setLabel('📩 Réclamer ce ticket').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('unclaim_ticket').setLabel('📩 Ne plus réclamer').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('transfer_ticket').setLabel('📩 Transférer la propriété').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('close_ticket').setLabel('❌ Fermer ce ticket').setStyle(ButtonStyle.Danger),
  );

  const pingContent = '<@' + member.id + '> ' + pingRolesIds.map(r => '<@&' + r + '>').join(' ');
  await channel.send({ content: pingContent, embeds: [embedTicket], components: [rowTicket] });
  return interaction.editReply({ content: '✅ Ton ticket a été créé : ' + channel.toString() });
}

// ══════════════════════════════════════════
//   BOT PRÊT
// ══════════════════════════════════════════
client.once('ready', () => {
  console.log('✅ [TICKETS] Bot connecté en tant que : ' + client.user.tag);
});

// ══════════════════════════════════════════
//   COMMANDES TEXTE
// ══════════════════════════════════════════
client.on('messageCreate', async function(message) {
  if (message.author.bot) return;
  if (!message.guild || message.guild.id !== GUILD_ID) return;

  // ── !ticketssupport ──
  if (message.content === '!ticketssupport') {
    if (message.author.id !== message.guild.ownerId) {
      return message.reply({ content: '❌ Seul le propriétaire du serveur 👑 peut utiliser cette commande !' });
    }
    await message.delete().catch(() => {});

    const salon = message.guild.channels.cache.get(SALON_SUPPORT_EMBED);
    if (!salon) return;

    const embed = new EmbedBuilder()
      .setTitle('🎫 Ouvrir un ticket Support')
      .setColor(0x5865f2)
      .setDescription(
        'Notre équipe de support est à votre disposition pour toute demande d\'assistance.\n\n' +
        'Veuillez sélectionner la catégorie correspondant à votre problème en cliquant sur le bouton approprié ci-dessous.\n' +
        'Un membre de notre staff prendra en charge votre demande dans les plus brefs délais.\n\n' +
        '> ⚠️ Merci d\'ouvrir un ticket uniquement si votre demande le nécessite.'
      )
      .setFooter({ text: 'Support — Topia FR RP' })
      .setTimestamp();

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_verif').setLabel('✅ Aide à la vérification').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticket_unban').setLabel('🔓 Aide débannissement').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('ticket_question').setLabel('💡 Aide question').setStyle(ButtonStyle.Secondary),
    );
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_signal').setLabel('📢 Aide au signalement').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket_autre').setLabel('🧩 Autre Aide').setStyle(ButtonStyle.Secondary),
    );

    await salon.send({ embeds: [embed], components: [row1, row2] });
    return;
  }

  // ── !ticketsmod ──
  if (message.content === '!ticketsmod') {
    if (message.author.id !== message.guild.ownerId) {
      return message.reply({ content: '❌ Seul le propriétaire du serveur 👑 peut utiliser cette commande !' });
    }
    await message.delete().catch(() => {});

    const salon = message.guild.channels.cache.get(SALON_MOD_EMBED);
    if (!salon) return;

    const embed = new EmbedBuilder()
      .setTitle('🛡️ Ouvrir un ticket Modérateur')
      .setColor(0xef4444)
      .setDescription(
        'Notre équipe de modérateurs est à votre disposition pour toute demande relative à la modération du serveur.\n\n' +
        'Sélectionnez la catégorie correspondant à votre situation en cliquant sur le bouton approprié ci-dessous.\n' +
        'Un modérateur prendra en charge votre demande dans les plus brefs délais.\n\n' +
        '> ⚠️ Merci d\'ouvrir un ticket uniquement si votre demande le nécessite réellement.'
      )
      .setFooter({ text: 'Modération — Topia FR RP' })
      .setTimestamp();

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_mod_unban').setLabel('🚫 Débannir').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('ticket_mod_report').setLabel('🚩 Signaler').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticket_mod_reportbug').setLabel('🐞 Signaler bug').setStyle(ButtonStyle.Secondary),
    );
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_mod_reportstaff').setLabel('👮 Signaler staff').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket_mod_autre').setLabel('🧩 Autre type de ticket').setStyle(ButtonStyle.Secondary),
    );

    await salon.send({ embeds: [embed], components: [row1, row2] });
    return;
  }

  // ── Écoute transfert : mention après clic "Transférer" ──
  if (pendingTransfer[message.author.id]) {
    const channelId = pendingTransfer[message.author.id];
    if (message.channel.id !== channelId) return;

    const target = message.mentions.members.first();
    if (!target) return;

    delete pendingTransfer[message.author.id];

    const data = ticketData[channelId];
    if (!data) return;

    data.claimedBy = target.id;

    await message.delete().catch(() => {});
    await sendTransferEmbed(message.channel, message.channel.name, target.id, message.author.id, false);
    await renameChannel(message.channel, data);
    return;
  }

  // ── !forcetransfertclaim @user ──
  if (message.content.startsWith('!forcetransfertclaim')) {
    const data = ticketData[message.channel.id];
    if (!data) return;

    const hasRole = ROLES_FORCE_TRANSFER.some(r => message.member.roles.cache.has(r));
    if (!hasRole) {
      return message.reply({ content: '❌ Tu n\'as pas la permission d\'utiliser cette commande !' });
    }

    const target = message.mentions.members.first();
    if (!target) return message.reply({ content: '❌ Mentionne un utilisateur !' });

    data.claimedBy = target.id;

    await message.delete().catch(() => {});
    await sendTransferEmbed(message.channel, message.channel.name, target.id, message.author.id, true);
    await renameChannel(message.channel, data);
    return;
  }
});

// ══════════════════════════════════════════
//   INTERACTIONS (boutons)
// ══════════════════════════════════════════
client.on('interactionCreate', async function(interaction) {
  if (!interaction.isButton()) return;
  if (interaction.guild.id !== GUILD_ID) return;

  const { customId, member, guild } = interaction;

  // ── Création ticket Support ──
  if (customId.startsWith('ticket_') && !customId.startsWith('ticket_mod_')) {
    const type     = customId.replace('ticket_', '');
    const typeInfo = TICKET_TYPES_SUPPORT[type];
    if (!typeInfo) return;
    return createTicket(
      interaction, type, typeInfo,
      ROLES_STAFF,
      ['1432841223118262413', '1433053281327775845', '1432840939658940456'],
      false
    );
  }

  // ── Création ticket Modérateur ──
  if (customId.startsWith('ticket_mod_')) {
    const type     = customId.replace('ticket_', ''); // → mod_unban, mod_report…
    const typeInfo = TICKET_TYPES_MOD[type];
    if (!typeInfo) return;
    return createTicket(interaction, type, typeInfo, ROLES_MOD, PING_ROLES_MOD, true);
  }

  // ── Claim ──
  if (customId === 'claim_ticket') {
    if (!member.roles.cache.has(ROLE_CLAIM)) {
      return interaction.reply({ content: '❌ Tu n\'as pas la permission de réclamer ce ticket !', ephemeral: true });
    }
    const data = ticketData[interaction.channel.id];
    if (!data) return interaction.reply({ content: '❌ Ticket introuvable.', ephemeral: true });

    if (data.claimedBy) {
      return interaction.reply({ content: '❌ Ce ticket est déjà réclamé par <@' + data.claimedBy + '> !', ephemeral: true });
    }

    data.claimedBy = member.id;
    if (data.timers) data.timers.forEach(t => clearTimeout(t));

    await renameChannel(interaction.channel, data);
    return interaction.reply({ content: '✅ Tu as réclamé ce ticket !', ephemeral: true });
  }

  // ── Unclaim ──
  if (customId === 'unclaim_ticket') {
    if (!member.roles.cache.has(ROLE_CLAIM)) {
      return interaction.reply({ content: '❌ Tu n\'as pas la permission !', ephemeral: true });
    }
    const data = ticketData[interaction.channel.id];
    if (!data) return interaction.reply({ content: '❌ Ticket introuvable.', ephemeral: true });

    if (!data.claimedBy || data.claimedBy !== member.id) {
      return interaction.reply({ content: '❌ Tu n\'as pas réclamé ce ticket !', ephemeral: true });
    }

    data.claimedBy = null;
    data.openedAt  = Date.now();
    scheduleTimers(interaction.channel, data);

    await renameChannel(interaction.channel, data);
    return interaction.reply({ content: '✅ Tu as retiré ta réclamation sur ce ticket.', ephemeral: true });
  }

  // ── Transfert via bouton ──
  if (customId === 'transfer_ticket') {
    if (!member.roles.cache.has(ROLE_CLAIM)) {
      return interaction.reply({ content: '❌ Tu n\'as pas la permission !', ephemeral: true });
    }

    const data = ticketData[interaction.channel.id];
    if (!data) return interaction.reply({ content: '❌ Ticket introuvable.', ephemeral: true });

    if (!data.claimedBy || data.claimedBy !== member.id) {
      return interaction.reply({
        content: '❌ Tu dois avoir **réclamé** ce ticket avant de pouvoir en transférer la propriété !',
        ephemeral: true,
      });
    }

    pendingTransfer[member.id] = interaction.channel.id;

    return interaction.reply({
      content: '📩 Mentionne la personne à qui tu veux transférer ce ticket (ex: @Utilisateur) :',
      ephemeral: true,
    });
  }

  // ── Fermeture ──
  if (customId === 'close_ticket') {
    const data = ticketData[interaction.channel.id];
    if (!data) return interaction.reply({ content: '❌ Ticket introuvable.', ephemeral: true });

    const canClose =
      data.claimedBy === member.id ||
      ROLES_TRANSFER.some(r => member.roles.cache.has(r));

    if (!canClose) {
      return interaction.reply({ content: '❌ Seul la personne ayant réclamé ce ticket ou le staff autorisé peut le fermer !', ephemeral: true });
    }

    await interaction.reply({ content: '🔒 Fermeture du ticket en cours...' });

    const transcript     = await makeTranscript(interaction.channel);
    const typeInfo       = ALL_TICKET_TYPES[data.type];
    const transcriptSalon = interaction.guild.channels.cache.get(typeInfo.transcript);

    const embedTranscript = new EmbedBuilder()
      .setTitle('📋 Transcript — ' + interaction.channel.name)
      .setColor(0x6b7280)
      .setDescription('**Créé par :** <@' + data.creatorId + '>\n**Fermé par :** ' + member.toString())
      .setTimestamp();

    const buffer1     = Buffer.from(transcript, 'utf-8');
    const attachment1 = new AttachmentBuilder(buffer1, { name: interaction.channel.name + '.txt' });

    if (transcriptSalon) {
      await transcriptSalon.send({ embeds: [embedTranscript], files: [attachment1] }).catch(() => {});
    }

    try {
      const creator     = await interaction.guild.members.fetch(data.creatorId);
      const buffer2     = Buffer.from(transcript, 'utf-8');
      const attachment2 = new AttachmentBuilder(buffer2, { name: interaction.channel.name + '.txt' });
      await creator.send({
        content: '👋 ' + creator.toString() + '\n\nBonjour ! Ton ticket **' + interaction.channel.name + '** sur **Topia FR RP** vient d\'être clôturé.\nTu trouveras ci-joint le transcript complet de votre échange pour en garder une trace.\n\nNous espérons avoir pu répondre à ta demande dans les meilleures conditions. N\'hésite pas à revenir vers nous si tu as besoin d\'aide. Bonne continuation et à bientôt ! 🌟',
        files: [attachment2],
      }).catch(() => {});
    } catch (e) { console.error('❌ MP : ' + e.message); }

    if (data.timers) data.timers.forEach(t => clearTimeout(t));

    const store = data.ismod ? userTicketsMod : userTickets;
    delete store[data.creatorId];
    delete ticketData[interaction.channel.id];

    setTimeout(async () => {
      await interaction.channel.delete().catch(() => {});
    }, 3000);
  }
});

client.on('error', (e) => console.error('❌ ' + e.message));
process.on('unhandledRejection', (r) => console.error('❌ ' + r));

client.login(TOKEN);
