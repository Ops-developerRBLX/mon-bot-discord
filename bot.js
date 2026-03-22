const { Client, ActivityType } = require('discord.js');

// ══════════════════════════════════════════
//   CONFIGURATION
// ══════════════════════════════════════════
const TOKEN = process.env.TOKEN;
const GUILD_ID = '1432472817005236326';

// ══════════════════════════════════════════
//   CLIENT
// ══════════════════════════════════════════
const client = new Client({
  intents: [33283],
});

// ══════════════════════════════════════════
//   FONCTION : Mettre à jour le statut
// ══════════════════════════════════════════
function updateStatus() {
  const guild = client.guilds.cache.get(GUILD_ID);
  const memberCount = guild ? guild.memberCount : '...';

  client.user.setPresence({
    activities: [
      {
        name: 'Joue à Topia FR RP',
        type: ActivityType.Playing,
      },
      {
        type: ActivityType.Custom,
        name: 'custom',
        state: '👥 Membres sur Topia : ' + memberCount,
      },
    ],
    status: 'online',
  });

  console.log('🔄 Statut mis à jour — Membres : ' + memberCount);
}

// ══════════════════════════════════════════
//   ÉVÉNEMENT : BOT PRÊT
// ══════════════════════════════════════════
client.once('ready', () => {
  console.log('✅ [STATUS] Bot connecté en tant que : ' + client.user.tag);
  updateStatus();
  setInterval(updateStatus, 5 * 60 * 1000);
});

client.on('guildMemberAdd', () => updateStatus());
client.on('guildMemberRemove', () => updateStatus());

client.on('error', (e) => console.error('❌ ' + e.message));
process.on('unhandledRejection', (r) => console.error('❌ ' + r));

client.login(TOKEN);
