require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Events,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const { getOwnerChannel, setOwnerChannel, deleteOwnerChannel } = require('./storage');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

// Discord channel names only allow lowercase letters, numbers, dashes, underscores.
function sanitizeChannelName(raw) {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90);
}

// If the sanitized name is taken, try a few "name-2", "name-3" variants before giving up.
async function findAvailableName(guild, base) {
  let candidate = base;
  let attempt = 1;
  while (guild.channels.cache.some((c) => c.name === candidate) && attempt < 6) {
    attempt += 1;
    candidate = `${base}-${attempt}`;
  }
  return guild.channels.cache.some((c) => c.name === candidate) ? null : candidate;
}

client.once(Events.ClientReady, (c) => {
  console.log(`Logged in as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (!interaction.inGuild()) {
    return interaction.reply({ content: 'This command only works inside a server.', ephemeral: true });
  }

  const { commandName, guild, user } = interaction;

  try {
    if (commandName === 'create') {
      await handleCreate(interaction, guild, user);
    } else if (commandName === 'add') {
      await handleAddRemove(interaction, guild, user, 'add');
    } else if (commandName === 'remove') {
      await handleAddRemove(interaction, guild, user, 'remove');
    } else if (commandName === 'close') {
      await handleClose(interaction, guild, user);
    }
  } catch (err) {
    console.error(err);
    const payload = { content: 'Something went wrong. Check the bot logs.', ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload);
    } else {
      await interaction.reply(payload);
    }
  }
});

async function handleCreate(interaction, guild, user) {
  const rawName = interaction.options.getString('name', true);
  const clean = sanitizeChannelName(rawName);

  if (!clean) {
    return interaction.reply({
      content: 'That name needs at least one letter or number (letters, numbers, dashes only).',
      ephemeral: true,
    });
  }

  const existingOwned = getOwnerChannel(guild.id, user.id);
  if (existingOwned) {
    return interaction.reply({
      content: `You already own <#${existingOwned.channelId}>. Use \`/close\` there first if you want a different channel.`,
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const availableName = await findAvailableName(guild, clean);
  if (!availableName) {
    return interaction.editReply(`"${clean}" is taken and a few variations are too — try a more specific name.`);
  }

  const role = await guild.roles.create({
    name: availableName,
    mentionable: false,
    reason: `Channel role for ${user.tag}`,
  });

  const channel = await guild.channels.create({
    name: availableName,
    type: ChannelType.GuildText,
    parent: process.env.CATEGORY_ID || null,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: role.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
    ],
    reason: `Channel created by ${user.tag}`,
  });

  const member = await guild.members.fetch(user.id);
  await member.roles.add(role);

  setOwnerChannel(guild.id, user.id, {
    channelId: channel.id,
    roleId: role.id,
    name: availableName,
  });

  await interaction.editReply(`Created <#${channel.id}> — use \`/add\` and \`/remove\` to manage who can see it.`);
}

async function handleAddRemove(interaction, guild, user, action) {
  const owned = getOwnerChannel(guild.id, user.id);
  if (!owned) {
    return interaction.reply({
      content: "You don't own a channel yet. Use `/create` first.",
      ephemeral: true,
    });
  }

  const role = guild.roles.cache.get(owned.roleId) || (await guild.roles.fetch(owned.roleId).catch(() => null));
  const channel =
    guild.channels.cache.get(owned.channelId) || (await guild.channels.fetch(owned.channelId).catch(() => null));

  if (!role || !channel) {
    deleteOwnerChannel(guild.id, user.id);
    return interaction.reply({
      content: 'Your channel or role no longer exists — it looks like it was deleted manually. Use `/create` to make a new one.',
      ephemeral: true,
    });
  }

  const target = interaction.options.getUser('user', true);

  await interaction.deferReply({ ephemeral: true });
  const member = await guild.members.fetch(target.id).catch(() => null);
  if (!member) {
    return interaction.editReply("Couldn't find that member in this server.");
  }

  if (action === 'add') {
    await member.roles.add(role);
    await interaction.editReply(`Added <@${target.id}> to <#${channel.id}>.`);
  } else {
    await member.roles.remove(role);
    const note = target.id === user.id ? ' (heads up — that includes you, the owner)' : '';
    await interaction.editReply(`Removed <@${target.id}> from <#${channel.id}>.${note}`);
  }
}

async function handleClose(interaction, guild, user) {
  const owned = getOwnerChannel(guild.id, user.id);
  if (!owned) {
    return interaction.reply({ content: "You don't own a channel.", ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  const channel = guild.channels.cache.get(owned.channelId);
  const role = guild.roles.cache.get(owned.roleId);

  let channelFailed = false;
  let roleFailed = false;

  if (channel) {
    await channel.delete(`Closed by owner ${user.tag}`).catch(() => {
      channelFailed = true;
    });
  }
  if (role) {
    await role.delete(`Closed by owner ${user.tag}`).catch(() => {
      roleFailed = true;
    });
  }

  // Always clear ownership so the person isn't stuck forever, even if a
  // permission issue below leaves something dangling for an admin to clean up.
  deleteOwnerChannel(guild.id, user.id);

  if (channelFailed || roleFailed) {
    const stuck = [channelFailed && 'the channel', roleFailed && `the role ("${owned.name}")`].filter(Boolean).join(' and ');
    return interaction.editReply(
      `Your ownership is cleared, but I couldn't delete ${stuck} — I likely don't have permission. ` +
        `An admin may need to remove ${stuck} manually, or move my role above it in Server Settings → Roles.`
    );
  }

  await interaction.editReply('Your channel has been closed.');
}

client.login(process.env.DISCORD_TOKEN);
