const {
  Client, EmbedBuilder, ButtonBuilder, ButtonStyle,
  ActionRowBuilder, ChannelType, PermissionsBitField, AttachmentBuilder
} = require('discord.js');

// ══════════════════════════════════════════
//   CONFIGURATION
// ══════════════════════════════════════════
const TOKEN = process.env.TOKEN;
const GUILD_ID = '1432472817005236326';
const SALON_CANDID_EMBED = '1485781664507363508';
const ROLE_CLAIM = '1432472817005236328';

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

const ROLES_CLOSE = [
  '1432840844754292766',
  '1433052694670475334',
  '1432839854911127625',
  '1432472817349431365',
  '1474093816398221463',
  '1474093820785332458',
  '1474133714391793784',
];

const CANDID_TYPES = {
  rp:      { label: 'Candidature Accès Rôle Play', prefix: 'candid-rp',      categorie: '1489726701721354360', logs: '1489726293661581444' },
  beta:    { label: 'Candidature Bêta Testers',    prefix: 'candid-testers',  categorie: '1489726875470266479', logs: '1489726328490954983' },
  video:   { label: 'Candidature Vidéaste',         prefix: 'candid-video',    categorie: '1489726939559362663', logs: '1489726369100468335' },
  dev:     { label: 'Candidature Développeur',      prefix: 'candid-dev',      categorie: '1489726997667250466', logs: '1489726396942258320' },
  agentRP: { label: 'Candidature Agent RP',         prefix: 'candid-a-rp',    categorie: '1489727087442001972', logs: '1489726430752538634' },
  support: { label: 'Candidature Support',          prefix: 'candid-support',  categorie: '1489727152114110514', logs: '1489726464541720668' },
  modo:    { label: 'Candidature Modérateur',       prefix: 'candid-modo',     categorie: '1489727210867654727', logs: '1489726531512045710' },
};

const candidCounters = { rp: 0, beta: 0, video: 0, dev: 0, agentRP: 0, support: 0, modo: 0 };

// channelId -> { type, creatorId, claimedBy, openedAt, timers, numero }
const candidData = {};

// userId -> channelId (1 candid par personne)
const userCandid = {};

// userId -> channelId (en attente mention transfert)
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

function getEmoji(openedAt) {
  const min = (Date.now() - openedAt) / 60000;
  if (min < 5)             return '🟢';
  if (min < 15)            return '🟡';
  if (min < 45)            return '🟠';
  if (min < 24 * 60 + 45) return '🔴';
  return '⚫';
}

async function renameChannel(channel, data) {
  const type = CANDID_TYPES[data.type];
  const num = padNum(data.numero);
  const emoji = getEmoji(data.openedAt);
  const status = data.claimedBy ? 'claim' : 'unclaim';
  const name = status + '-' + emoji + '-' + type.prefix + '-' + num;
  await channel.setName(name).catch(() => {});
}

function scheduleTimers(channel, data) {
  if (data.timers) data.timers.forEach(t => clearTimeout(t));
  data.timers = [];
  if (data.claimedBy) return;
  const times = [5 * 60000, 15 * 60000, 45 * 60000, (24 * 60 + 45) * 60000];
  times.forEach(ms => {
    const t = setTimeout(async () => {
      const current = candidData[channel.id];
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

// ══════════════════════════════════════════
//   BOT PRÊT
// ══════════════════════════════════════════
client.once('ready', () => {
  console.log('✅ [CANDIDATURES] Bot connecté en tant que : ' + client.user.tag);
});

// ══════════════════════════════════════════
//   COMMANDES TEXTE
// ══════════════════════════════════════════
client.on('messageCreate', async function(message) {
  if (message.author.bot) return;
  if (!message.guild || message.guild.id !== GUILD_ID) return;

  // ── !candidatures ──
  if (message.content === '!candidatures') {
    if (message.author.id !== message.guild.ownerId) {
      return message.reply({ content: '❌ Seul le propriétaire du serveur 👑 peut utiliser cette commande !' });
    }
    await message.delete().catch(() => {});

    const salon = message.guild.channels.cache.get(SALON_CANDID_EMBED);
    if (!salon) return;

    const embed = new EmbedBuilder()
      .setTitle('📋 Soumettre une Candidature')
      .setColor(0xFFFFFF)
      .setDescription(
        'Notre équipe examine toutes les candidatures avec la plus grande attention.\n\n' +
        'Veuillez sélectionner la catégorie correspondant à votre candidature en cliquant sur le bouton approprié ci-dessous.\n' +
        'Un membre de notre staff étudiera votre dossier dans les plus brefs délais.\n\n' +
        '> ⚠️ Merci de ne soumettre votre candidature qu\'une seule fois et de manière sérieuse.'
      )
      .setFooter({ text: 'Candidatures — Topia FR RP' })
      .setTimestamp();

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('candid_rp').setLabel('Candidature Accès Rôle Play').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('candid_beta').setLabel('Candidature Bêta Testers').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('candid_video').setLabel('Candidature Vidéaste').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('candid_dev').setLabel('Candidature Développeur').setStyle(ButtonStyle.Secondary),
    );
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('candid_agentRP').setLabel('Candidature Agent RP').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('candid_support').setLabel('Candidature Support').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('candid_modo').setLabel('Candidature Modérateur').setStyle(ButtonStyle.Danger),
    );

    await salon.send({ embeds: [embed], components: [row1, row2] });
    return;
  }

  // ── Écoute transfert ──
  if (pendingTransfer[message.author.id]) {
    const channelId = pendingTransfer[message.author.id];
    if (message.channel.id !== channelId) return;

    const target = message.mentions.members.first();
    if (!target) return;

    delete pendingTransfer[message.author.id];

    const data = candidData[channelId];
    if (!data) return;

    const oldClaimer = data.claimedBy ? '<@' + data.claimedBy + '>' : 'Personne';
    data.claimedBy = target.id;

    const embed = new EmbedBuilder()
      .setTitle('🔄 Transfert de Candidature')
      .setColor(0xf59e0b)
      .setDescription(
        'Bonjour, <@' + data.creatorId + '>\n\n' +
        'Votre candidature est désormais prise en charge par ' + target.toString() + '.\n\n' +
        '*Transfert effectué depuis : ' + oldClaimer + '*'
      )
      .setTimestamp();

    await message.channel.send({ embeds: [embed] });
    await message.delete().catch(() => {});
    await renameChannel(message.channel, data);
    return;
  }

  // ── !forcetransfertclaim @user ──
  if (message.content.startsWith('!forcetransfertclaim')) {
    const data = candidData[message.channel.id];
    if (!data) return;

    const hasRole = ROLES_CLOSE.some(r => message.member.roles.cache.has(r));
    if (!hasRole) return message.reply({ content: '❌ Tu n\'as pas la permission !' });

    const target = message.mentions.members.first();
    if (!target) return message.reply({ content: '❌ Mentionne un utilisateur !' });

    const oldClaimer = data.claimedBy ? '<@' + data.claimedBy + '>' : 'Personne';
    data.claimedBy = target.id;

    const embed = new EmbedBuilder()
      .setTitle('🔄 Transfert de Candidature')
      .setColor(0xf59e0b)
      .setDescription(
        'Bonjour, <@' + data.creatorId + '>\n\n' +
        'Votre candidature est désormais prise en charge par ' + target.toString() + '.\n\n' +
        '*Transfert forcé depuis : ' + oldClaimer + '*'
      )
      .setTimestamp();

    await message.channel.send({ embeds: [embed] });
    await message.delete().catch(() => {});
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

  // ── Création de candidature ──
  if (customId.startsWith('candid_')) {
    const type = customId.replace('candid_', '');
    const typeInfo = CANDID_TYPES[type];
    if (!typeInfo) return;

    // 1 candidature max par personne
    if (userCandid[member.id]) {
      const existing = guild.channels.cache.get(userCandid[member.id]);
      if (existing) {
        return interaction.reply({
          content: '❌ Tu as déjà une candidature ouverte : ' + existing.toString() + '\nFerme-la avant d\'en ouvrir une nouvelle !',
          ephemeral: true,
        });
      }
      delete userCandid[member.id];
    }

    await interaction.deferReply({ ephemeral: true });

    candidCounters[type]++;
    const numero = candidCounters[type];
    const num = padNum(numero);
    const channelName = '🟢-' + typeInfo.prefix + '-' + num;

    const permissionOverwrites = [
      { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      {
        id: member.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
      },
    ];
    ROLES_STAFF.forEach(roleId => {
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
    }).catch(e => { console.error('❌ ' + e.message); return null; });

    if (!channel) {
      return interaction.editReply({ content: '❌ Impossible de créer la candidature. Contacte un administrateur.' });
    }

    userCandid[member.id] = channel.id;
    candidData[channel.id] = {
      type, creatorId: member.id, claimedBy: null,
      openedAt: Date.now(), timers: [], numero,
    };
    scheduleTimers(channel, candidData[channel.id]);

    const embedCandid = new EmbedBuilder()
      .setTitle('📋 Candidature Créée')
      .setColor(0xFFFFFF)
      .setDescription(
        'Bonjour <@' + member.id + '> ! 👋\n\n' +
        '> Votre candidature a bien été reçue. Notre équipe l\'examinera dans les plus brefs délais.\n' +
        '> Merci de patienter et de ne pas relancer le staff.\n\n' +
        '**Type :** ' + typeInfo.label + '\n' +
        '**Candidature n° :** ' + num
      )
      .setFooter({ text: 'Candidatures — Topia FR RP' })
      .setTimestamp();

    const rowCandid = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('claim_candid').setLabel('📩 Réclamer cette candidature').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('unclaim_candid').setLabel('📩 Ne plus réclamer').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('transfer_candid').setLabel('📩 Transférer la propriété').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('close_candid').setLabel('❌ Fermer la candidature').setStyle(ButtonStyle.Danger),
    );

    const pingRoles = '<@&1432841223118262413> <@&1433053281327775845> <@&1432840939658940456>';
    await channel.send({ content: '<@' + member.id + '> ' + pingRoles, embeds: [embedCandid], components: [rowCandid] });

    return interaction.editReply({ content: '✅ Ta candidature a été créée : ' + channel.toString() });
  }

  // ── Claim ──
  if (customId === 'claim_candid') {
    if (!member.roles.cache.has(ROLE_CLAIM)) {
      return interaction.reply({ content: '❌ Tu n\'as pas la permission de réclamer cette candidature !', ephemeral: true });
    }
    const data = candidData[interaction.channel.id];
    if (!data) return interaction.reply({ content: '❌ Candidature introuvable.', ephemeral: true });

    if (data.claimedBy) {
      return interaction.reply({ content: '❌ Cette candidature est déjà réclamée par <@' + data.claimedBy + '> !', ephemeral: true });
    }

    data.claimedBy = member.id;
    if (data.timers) data.timers.forEach(t => clearTimeout(t));

    await renameChannel(interaction.channel, data);
    return interaction.reply({ content: '✅ Tu as réclamé cette candidature !', ephemeral: true });
  }

  // ── Unclaim ──
  if (customId === 'unclaim_candid') {
    if (!member.roles.cache.has(ROLE_CLAIM)) {
      return interaction.reply({ content: '❌ Tu n\'as pas la permission !', ephemeral: true });
    }
    const data = candidData[interaction.channel.id];
    if (!data) return interaction.reply({ content: '❌ Candidature introuvable.', ephemeral: true });

    if (!data.claimedBy || data.claimedBy !== member.id) {
      return interaction.reply({ content: '❌ Tu n\'as pas réclamé cette candidature !', ephemeral: true });
    }

    data.claimedBy = null;
    data.openedAt = Date.now();
    scheduleTimers(interaction.channel, data);

    await renameChannel(interaction.channel, data);
    return interaction.reply({ content: '✅ Tu as retiré ta réclamation sur cette candidature.', ephemeral: true });
  }

  // ── Transfert ──
  if (customId === 'transfer_candid') {
    if (!member.roles.cache.has(ROLE_CLAIM)) {
      return interaction.reply({ content: '❌ Tu n\'as pas la permission !', ephemeral: true });
    }
    const data = candidData[interaction.channel.id];
    if (!data) return interaction.reply({ content: '❌ Candidature introuvable.', ephemeral: true });

    if (!data.claimedBy || data.claimedBy !== member.id) {
      return interaction.reply({ content: '❌ Tu dois avoir réclamé cette candidature pour pouvoir en transférer la propriété !', ephemeral: true });
    }

    pendingTransfer[member.id] = interaction.channel.id;
    return interaction.reply({
      content: '📩 Mentionne la personne à qui tu veux transférer cette candidature (ex: @Utilisateur) :',
      ephemeral: true,
    });
  }

  // ── Fermeture ──
  if (customId === 'close_candid') {
    const data = candidData[interaction.channel.id];
    if (!data) return interaction.reply({ content: '❌ Candidature introuvable.', ephemeral: true });

    const canClose =
      data.claimedBy === member.id ||
      ROLES_CLOSE.some(r => member.roles.cache.has(r));

    if (!canClose) {
      return interaction.reply({ content: '❌ Seul la personne ayant réclamé cette candidature ou le staff autorisé peut la fermer !', ephemeral: true });
    }

    await interaction.reply({ content: '🔒 Fermeture de la candidature en cours...' });

    const transcript = await makeTranscript(interaction.channel);
    const typeInfo = CANDID_TYPES[data.type];
    const logSalon = interaction.guild.channels.cache.get(typeInfo.logs);

    const embedLog = new EmbedBuilder()
      .setTitle('📋 Log Candidature — ' + interaction.channel.name)
      .setColor(0x6b7280)
      .setDescription('**Créé par :** <@' + data.creatorId + '>\n**Fermé par :** ' + member.toString())
      .setTimestamp();

    const buffer1 = Buffer.from(transcript, 'utf-8');
    const attachment1 = new AttachmentBuilder(buffer1, { name: interaction.channel.name + '.txt' });

    if (logSalon) {
      await logSalon.send({ embeds: [embedLog], files: [attachment1] }).catch(() => {});
    }

    try {
      const creator = await interaction.guild.members.fetch(data.creatorId);
      const buffer2 = Buffer.from(transcript, 'utf-8');
      const attachment2 = new AttachmentBuilder(buffer2, { name: interaction.channel.name + '.txt' });
      await creator.send({
        content: '👋 ' + creator.toString() + '\n\nBonjour ! Ta candidature **' + interaction.channel.name + '** sur **Topia FR RP** vient d\'être clôturée.\nTu trouveras ci-joint le transcript complet de votre échange pour en garder une trace.\n\nNous espérons avoir pu traiter ta candidature dans les meilleures conditions. Bonne continuation et à bientôt ! 🌟',
        files: [attachment2],
      }).catch(() => {});
    } catch (e) { console.error('❌ MP : ' + e.message); }

    if (data.timers) data.timers.forEach(t => clearTimeout(t));
    delete userCandid[data.creatorId];
    delete candidData[interaction.channel.id];

    setTimeout(async () => {
      await interaction.channel.delete().catch(() => {});
    }, 3000);
  }
});

client.on('error', (e) => console.error('❌ ' + e.message));
process.on('unhandledRejection', (r) => console.error('❌ ' + r));

client.login(TOKEN);
