const {
  Client, EmbedBuilder, ButtonBuilder, ButtonStyle,
  ActionRowBuilder, ChannelType, PermissionsBitField
} = require('discord.js');

// ══════════════════════════════════════════
//   CONFIGURATION
// ══════════════════════════════════════════
const TOKEN = process.env.TOKEN;
const GUILD_ID = '1432472817005236326';

const SALON_TICKET_EMBED   = '1485781954077921473';
const CATEGORIE_VERIF      = '1433817707521904680';

const SALON_TRANSCRIPT = {
  verif:    '1485786365726556220',
  unban:    '1485786433057722468',
  question: '1485786483423187004',
  signal:   '1485786528364888104',
  autre:    '1485786561227526174',
};

// Rôles ayant accès aux tickets
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
];

// Rôle pouvant claim/fermer
const ROLE_CLAIM = '1432472817005236328';

// Rôles pouvant forcer le transfert
const ROLES_TRANSFER = [
  '1432840844754292766',
  '1433052694670475334',
  '1432839854911127625',
  '1432472817349431365',
  '1474093816398221463',
  '1474093820785332458',
];

// Types de tickets
const TICKET_TYPES = {
  verif:    { label: '✅ Aide à la vérification', prefix: 'ticket-aide-vérif',    categorie: '1433817707521904680', transcript: '1485786365726556220' },
  unban:    { label: '🔓 Aide débannissement',    prefix: 'ticket-aide-unban',    categorie: '1433817707521904680', transcript: '1485786433057722468' },
  question: { label: '💡 Aide question',           prefix: 'ticket-aide-question', categorie: '1433817707521904680', transcript: '1485786483423187004' },
  signal:   { label: '📢 Aide au signalement',    prefix: 'ticket-aide-signal',   categorie: '1433817707521904680', transcript: '1485786528364888104' },
  autre:    { label: '🧩 Autre Aide',              prefix: 'ticket-aide-autre',    categorie: '1433817707521904680', transcript: '1485786561227526174' },
};

// Compteurs de tickets (en mémoire)
const ticketCounters = { verif: 0, unban: 0, question: 0, signal: 0, autre: 0 };

// Données des tickets ouverts : channelId -> { type, creatorId, claimedBy, openedAt, timers, numero }
const ticketData = {};

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

function getEmoji(openedAt, claimedBy) {
  if (claimedBy) return null; // géré séparément
  const elapsed = Date.now() - openedAt;
  const min = elapsed / 60000;
  if (min < 5)   return '🟢';
  if (min < 15)  return '🟡';
  if (min < 45)  return '🟠';
  if (min < 24*60+45) return '🔴';
  return '⚫';
}

async function renameChannel(channel, data) {
  const type = TICKET_TYPES[data.type];
  const prefix = type.prefix;
  const num = padNum(data.numero);
  const emoji = getEmoji(data.openedAt, data.claimedBy);
  const status = data.claimedBy ? 'claim' : 'unclaim';
  const name = status + '-' + emoji.replace(/\uFE0F/g, '') + '-' + prefix + '-' + num;
  await channel.setName(name).catch(() => {});
}

function scheduleTimers(channel, data) {
  // Annuler anciens timers
  if (data.timers) data.timers.forEach(t => clearTimeout(t));
  data.timers = [];

  if (data.claimedBy) return; // Pas de timer si déjà claim

  const times = [5*60000, 15*60000, 45*60000, (24*60+45)*60000];
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

// ══════════════════════════════════════════
//   BOT PRÊT
// ══════════════════════════════════════════
client.once('ready', () => {
  console.log('✅ [TICKETS] Bot connecté en tant que : ' + client.user.tag);
});

// ══════════════════════════════════════════
//   COMMANDE : !tickets
//   Envoie l'embed de création de ticket
// ══════════════════════════════════════════
client.on('messageCreate', async function(message) {
  if (message.author.bot) return;
  if (message.guild.id !== GUILD_ID) return;
  if (message.content !== '!tickets') return;

  if (message.author.id !== message.guild.ownerId) {
    return message.reply({ content: '❌ Seul le propriétaire du serveur 👑 peut utiliser cette commande !' });
  }

  await message.delete().catch(() => {});

  const salon = message.guild.channels.cache.get(SALON_TICKET_EMBED);
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
});

// ══════════════════════════════════════════
//   COMMANDE : !forcetransfertclaim @user
// ══════════════════════════════════════════
client.on('messageCreate', async function(message) {
  if (message.author.bot) return;
  if (message.guild.id !== GUILD_ID) return;
  if (!message.content.startsWith('!forcetransfertclaim')) return;

  const data = ticketData[message.channel.id];
  if (!data) return;

  const hasRole = ROLES_TRANSFER.some(r => message.member.roles.cache.has(r));
  if (!hasRole) {
    return message.reply({ content: '❌ Tu n\'as pas la permission d\'utiliser cette commande !' });
  }

  const target = message.mentions.members.first();
  if (!target) return message.reply({ content: '❌ Mentionne un utilisateur !' });

  const oldClaimer = data.claimedBy ? '<@' + data.claimedBy + '>' : 'Personne';
  data.claimedBy = target.id;

  const embed = new EmbedBuilder()
    .setTitle('🔄 Transfert de Ticket')
    .setColor(0xf59e0b)
    .setDescription(
      'Bonjour, <@' + data.creatorId + '>\n\n' +
      'Votre ticket est désormais pris en charge par ' + target.toString() + '.\n\n' +
      '*Transfert effectué depuis : ' + oldClaimer + '*'
    )
    .setTimestamp();

  await message.channel.send({ embeds: [embed] });
  await renameChannel(message.channel, data);
  await message.delete().catch(() => {});
});

// ══════════════════════════════════════════
//   INTERACTIONS (boutons)
// ══════════════════════════════════════════
client.on('interactionCreate', async function(interaction) {
  if (!interaction.isButton()) return;
  if (interaction.guild.id !== GUILD_ID) return;

  const { customId, member, guild } = interaction;

  // ── Création de ticket ──
  if (customId.startsWith('ticket_')) {
    const type = customId.replace('ticket_', '');
    const typeInfo = TICKET_TYPES[type];
    if (!typeInfo) return;

    await interaction.deferReply({ ephemeral: true });

    ticketCounters[type]++;
    const numero = ticketCounters[type];
    const num = padNum(numero);
    const channelName = '🟢-' + typeInfo.prefix + '-' + num;

    // Permissions du salon
    const permissionOverwrites = [
      {
        id: guild.id,
        deny: [PermissionsBitField.Flags.ViewChannel],
      },
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

    // Créer le salon
    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: typeInfo.categorie,
      permissionOverwrites,
    }).catch(e => { console.error('❌ Erreur création salon : ' + e.message); return null; });

    if (!channel) {
      return interaction.editReply({ content: '❌ Impossible de créer le ticket. Contacte un administrateur.' });
    }

    // Enregistrer les données
    ticketData[channel.id] = {
      type, creatorId: member.id, claimedBy: null,
      openedAt: Date.now(), timers: [], numero,
    };

    scheduleTimers(channel, ticketData[channel.id]);

    // Embed dans le ticket
    const embedTicket = new EmbedBuilder()
      .setTitle('🎫 Ticket Créé')
      .setColor(0x22c55e)
      .setDescription(
        'Bienvenue <@' + member.id + '> !\n\n' +
        '> Veuillez patienter, un membre du staff prendra en charge votre demande dans les meilleurs délais.\n\n' +
        '**Catégorie :** ' + typeInfo.label + '\n' +
        '**Ticket n° :** ' + num
      )
      .setFooter({ text: 'Support — Topia FR RP' })
      .setTimestamp();

    const rowTicket = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('claim_ticket').setLabel('📩 Réclamer ce ticket').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('unclaim_ticket').setLabel('📩 Ne plus réclamer').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('transfer_ticket').setLabel('📩 Transférer la propriété').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('close_ticket').setLabel('❌ Fermer ce ticket').setStyle(ButtonStyle.Danger),
    );

    await channel.send({ content: '<@' + member.id + '>', embeds: [embedTicket], components: [rowTicket] });

    return interaction.editReply({ content: '✅ Ton ticket a été créé : ' + channel.toString() });
  }

  // ── Claim ──
  if (customId === 'claim_ticket') {
    if (!member.roles.cache.has(ROLE_CLAIM)) {
      return interaction.reply({ content: '❌ Tu n\'as pas la permission de réclamer ce ticket !', ephemeral: true });
    }
    const data = ticketData[interaction.channel.id];
    if (!data) return interaction.reply({ content: '❌ Ticket introuvable.', ephemeral: true });

    data.claimedBy = member.id;
    if (data.timers) data.timers.forEach(t => clearTimeout(t));

    await renameChannel(interaction.channel, data);
    await interaction.reply({ content: '✅ Tu as réclamé ce ticket !' });
    return;
  }

  // ── Unclaim ──
  if (customId === 'unclaim_ticket') {
    if (!member.roles.cache.has(ROLE_CLAIM)) {
      return interaction.reply({ content: '❌ Tu n\'as pas la permission !', ephemeral: true });
    }
    const data = ticketData[interaction.channel.id];
    if (!data) return interaction.reply({ content: '❌ Ticket introuvable.', ephemeral: true });

    data.claimedBy = null;
    data.openedAt = Date.now();
    scheduleTimers(interaction.channel, data);

    await renameChannel(interaction.channel, data);
    await interaction.reply({ content: '✅ Tu as retiré ta réclamation sur ce ticket.' });
    return;
  }

  // ── Transfert ──
  if (customId === 'transfer_ticket') {
    if (!member.roles.cache.has(ROLE_CLAIM)) {
      return interaction.reply({ content: '❌ Tu n\'as pas la permission !', ephemeral: true });
    }
    return interaction.reply({
      content: '📩 Pour transférer ce ticket, utilise la commande :\n`!forcetransfertclaim @utilisateur`',
      ephemeral: true,
    });
  }

  // ── Fermeture ──
  if (customId === 'close_ticket') {
    const data = ticketData[interaction.channel.id];
    if (!data) return interaction.reply({ content: '❌ Ticket introuvable.', ephemeral: true });

    await interaction.reply({ content: '🔒 Fermeture du ticket en cours...' });

    // Transcript
    const transcript = await makeTranscript(interaction.channel);
    const typeInfo = TICKET_TYPES[data.type];
    const transcriptSalon = interaction.guild.channels.cache.get(typeInfo.transcript);

    const embedTranscript = new EmbedBuilder()
      .setTitle('📋 Transcript — ' + interaction.channel.name)
      .setColor(0x6b7280)
      .setDescription('**Créé par :** <@' + data.creatorId + '>\n**Fermé par :** ' + member.toString())
      .setTimestamp();

    const { AttachmentBuilder } = require('discord.js');
    const buffer = Buffer.from(transcript, 'utf-8');
    const attachment = new AttachmentBuilder(buffer, { name: interaction.channel.name + '.txt' });

    // Envoyer dans le salon transcript
    if (transcriptSalon) {
      await transcriptSalon.send({ embeds: [embedTranscript], files: [attachment] }).catch(() => {});
    }

    // Envoyer en MP au créateur
    try {
      const creator = await interaction.guild.members.fetch(data.creatorId);
      const buffer2 = Buffer.from(transcript, 'utf-8');
      const attachment2 = new AttachmentBuilder(buffer2, { name: interaction.channel.name + '.txt' });
      await creator.send({
        content: '📋 Voici le transcript de ton ticket **' + interaction.channel.name + '** :',
        files: [attachment2],
      }).catch(() => {});
    } catch (e) { console.error('❌ MP impossible : ' + e.message); }

    // Annuler timers et supprimer
    if (data.timers) data.timers.forEach(t => clearTimeout(t));
    delete ticketData[interaction.channel.id];

    setTimeout(async () => {
      await interaction.channel.delete().catch(() => {});
    }, 3000);
  }
});

client.on('error', (e) => console.error('❌ ' + e.message));
process.on('unhandledRejection', (r) => console.error('❌ ' + r));

client.login(TOKEN);
