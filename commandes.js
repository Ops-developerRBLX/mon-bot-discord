const { Client, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');

// ══════════════════════════════════════════
//   CONFIGURATION
// ══════════════════════════════════════════
const TOKEN = process.env.TOKEN;
const GUILD_ID = '1432472817005236326';
const ROLE_ID = '1432472817349431357';

// ══════════════════════════════════════════
//   CLIENT
//   Intents : Guilds + GuildMembers + GuildMessages + MessageContent
// ══════════════════════════════════════════
const client = new Client({
  intents: [33283 | 512 | 32768],
});

client.once('ready', () => {
  console.log('✅ [COMMANDES] Bot connecté en tant que : ' + client.user.tag);
});

// ══════════════════════════════════════════
//   COMMANDE : !reglement
//   Uniquement le propriétaire du serveur 👑
// ══════════════════════════════════════════
client.on('messageCreate', async function(message) {
  if (message.author.bot) return;
  if (message.guild.id !== GUILD_ID) return;
  if (message.content !== '!reglement') return;

  // Vérification : propriétaire du serveur uniquement
  if (message.author.id !== message.guild.ownerId) {
    return message.reply({ content: '❌ Seul le propriétaire du serveur 👑 peut utiliser cette commande !' });
  }

  await message.delete().catch(() => {});

  const embed = new EmbedBuilder()
    .setTitle('📜 Règlement du Serveur')
    .setColor(0x5865f2)
    .setDescription(
      '**Bienvenue sur le serveur ! Merci de lire et respecter les règles suivantes :**\n\n' +
      '**1️⃣ Respectez tout le monde**\n' +
      'Aucune insulte, discrimination ou harcèlement ne sera toléré.\n\n' +
      '**2️⃣ Pas de spam**\n' +
      'Évitez les messages répétitifs, les majuscules excessives et les floods.\n\n' +
      '**3️⃣ Pas de publicité**\n' +
      'Toute publicité non autorisée est interdite.\n\n' +
      '**4️⃣ Contenu approprié**\n' +
      'Aucun contenu NSFW, choquant ou illégal ne sera toléré.\n\n' +
      '**5️⃣ Respectez les salons**\n' +
      'Utilisez chaque salon pour son usage prévu.\n\n' +
      '**6️⃣ Pas d\'usurpation d\'identité**\n' +
      'Il est interdit de se faire passer pour un autre membre ou un staff.\n\n' +
      '**7️⃣ Suivez les directives de Discord**\n' +
      'Les [CGU de Discord](https://discord.com/terms) s\'appliquent sur ce serveur.\n\n' +
      '*En cliquant sur le bouton ci-dessous, vous acceptez le règlement et obtenez l\'accès au serveur.*'
    )
    .setFooter({ text: 'Cliquez sur le bouton pour accepter le règlement' })
    .setTimestamp();

  const bouton = new ButtonBuilder()
    .setCustomId('accepter_reglement')
    .setLabel('✅ Accepter le Règlement')
    .setStyle(ButtonStyle.Success);

  const row = new ActionRowBuilder().addComponents(bouton);

  await message.channel.send({ embeds: [embed], components: [row] });
});

// ══════════════════════════════════════════
//   CLIC SUR LE BOUTON
// ══════════════════════════════════════════
client.on('interactionCreate', async function(interaction) {
  if (!interaction.isButton()) return;
  if (interaction.customId !== 'accepter_reglement') return;

  const member = interaction.member;

  if (member.roles.cache.has(ROLE_ID)) {
    return interaction.reply({
      content: '✅ Vous avez déjà accepté le règlement !',
      ephemeral: true,
    });
  }

  try {
    await member.roles.add(ROLE_ID);
    await interaction.reply({
      content: '🎉 Merci d\'avoir accepté le règlement ! Tu as maintenant accès au serveur. Bonne aventure ! 🚀',
      ephemeral: true,
    });
    console.log('✅ Rôle donné à : ' + member.user.username);
  } catch (error) {
    console.error('❌ Erreur rôle : ' + error.message);
    await interaction.reply({
      content: '❌ Une erreur est survenue. Contacte un administrateur.',
      ephemeral: true,
    });
  }
});

client.on('error', (e) => console.error('❌ ' + e.message));
process.on('unhandledRejection', (r) => console.error('❌ ' + r));

client.login(TOKEN);
