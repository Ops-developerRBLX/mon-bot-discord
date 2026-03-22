const { Client } = require('discord.js');

// ══════════════════════════════════════════
//   CONFIGURATION
// ══════════════════════════════════════════
const TOKEN = process.env.TOKEN;
const GUILD_ID = '1432472817005236326';
const ROLE_AUTO_ID = '1433025817386156143';
const WEBHOOK_BIENVENUE = 'https://discord.com/api/webhooks/1485020648634843236/D639AGwUneJqQ-eZE95Mbc4R5hF95j_cysF5DSq1Sfuu98zICX221svXO_bgi-ybt-v2';

// ══════════════════════════════════════════
//   CLIENT
// ══════════════════════════════════════════
const client = new Client({
  intents: [33283],
});

client.once('ready', () => {
  console.log('✅ [BIENVENUE] Bot connecté en tant que : ' + client.user.tag);
});

// ══════════════════════════════════════════
//   NOUVEAU MEMBRE
// ══════════════════════════════════════════
client.on('guildMemberAdd', async function(member) {
  if (member.guild.id !== GUILD_ID) return;

  const user = member.user;
  const username = user.username;
  const mention = '<@' + user.id + '>';
  const avatarURL = user.displayAvatarURL({ size: 256, extension: 'png' });

  // ── Ajout automatique du rôle ──
  try {
    await member.roles.add(ROLE_AUTO_ID);
    console.log('✅ Rôle auto donné à : ' + username);
  } catch (error) {
    console.error('❌ Erreur ajout rôle auto : ' + error.message);
  }

  // ── Message de bienvenue ──
  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const payload = {
    embeds: [{
      title: '🎉 Nouvelle Arrivant(e) !',
      description: 'Bienvenue parmi nous, ' + mention + ' ! 🎊\n\nLa cloche a sonné et toute la communauté est là pour t\'accueillir comme il se doit ! 🔔✨\nInstalle-toi confortablement, car ici est ton endroit tant rêvé ! 🚀🔥',
      color: 0x5865f2,
      thumbnail: { url: avatarURL },
      fields: [
        { name: '📅 Date d\'arrivée', value: dateStr, inline: true },
        { name: '👥 Membres', value: '#' + member.guild.memberCount, inline: true },
      ],
      footer: { text: 'Heureux de t\'avoir parmi nous !' },
      timestamp: now.toISOString(),
    }],
  };

  const https = require('https');
  const body = JSON.stringify(payload);
  const url = new URL(WEBHOOK_BIENVENUE);
  const req = https.request({
    hostname: url.hostname,
    path: url.pathname,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  }, (res) => {
    console.log(res.statusCode >= 200 && res.statusCode < 300
      ? '✅ Bienvenue envoyé pour : ' + username
      : '❌ Erreur webhook : ' + res.statusCode);
  });
  req.on('error', (e) => console.error('❌ ' + e.message));
  req.write(body);
  req.end();
});

client.on('error', (e) => console.error('❌ ' + e.message));
process.on('unhandledRejection', (r) => console.error('❌ ' + r));

client.login(TOKEN);