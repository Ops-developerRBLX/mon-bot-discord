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
  if (!guild) return;

  const memberCount = guild.memberCount;

  // Activité : "Ecoute Topia FR RP"
  client.user.setActivity('Topia FR RP', { type: ActivityType.Playing });

  // Note (status custom) : "👥 Nombres de Membre sur Topia : X"
  client.user.setPresence({
    activities: [
      {
        name: 'Topia FR RP',
        type: ActivityType.Playing,
      },
      {
        name: '👥 Nombres de Membre sur Topia : ' + memberCount,
        type: ActivityType.Custom,
        state: '👥 Nombres de Membre sur Topia : ' + memberCount,
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

  // Mise à jour immédiate
  updateStatus();

  // Mise à jour toutes les 5 minutes
  setInterval(updateStatus, 5 * 60 * 1000);
});

// Mise à jour quand quelqu'un rejoint ou quitte
client.on('guildMemberAdd', () => updateStatus());
client.on('guildMemberRemove', () => updateStatus());

client.on('error', (e) => console.error('❌ ' + e.message));
process.on('unhandledRejection', (r) => console.error('❌ ' + r));

client.login(TOKEN);