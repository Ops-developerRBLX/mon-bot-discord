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
//   ALTERNANCE DU STATUT
// ══════════════════════════════════════════
let statusIndex = 0;

function updateStatus() {
  const guild = client.guilds.cache.get(GUILD_ID);
  const memberCount = guild ? guild.memberCount : '...';

  const statuses = [
    {
      activities: [{ name: 'Topia FR RP', type: ActivityType.Playing }],
      status: 'online',
    },
    {
      activities: [{ name: '👥 Nombres de Membre sur Topia : ' + memberCount, type: ActivityType.Custom, state: '👥 Nombres de Membre sur Topia : ' + memberCount }],
      status: 'online',
    },
  ];

  client.user.setPresence(statuses[statusIndex]);
  statusIndex = (statusIndex + 1) % statuses.length;
}

// ══════════════════════════════════════════
//   ÉVÉNEMENT : BOT PRÊT
// ══════════════════════════════════════════
client.once('ready', () => {
  console.log('✅ [STATUS] Bot connecté en tant que : ' + client.user.tag);

  // Mise à jour immédiate
  updateStatus();

  // Alternance toutes les 10 secondes
  setInterval(updateStatus, 10 * 1000);
});

client.on('error', (e) => console.error('❌ ' + e.message));
process.on('unhandledRejection', (r) => console.error('❌ ' + r));

client.login(TOKEN);
