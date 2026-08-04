require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('create')
    .setDescription('Create your own channel')
    .addStringOption((opt) => opt.setName('name').setDescription('Name for the channel').setRequired(true)),
  new SlashCommandBuilder()
    .setName('add')
    .setDescription('Add a player to your channel')
    .addUserOption((opt) => opt.setName('user').setDescription('User to add').setRequired(true)),
  new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a player from your channel')
    .addUserOption((opt) => opt.setName('user').setDescription('User to remove').setRequired(true)),
  new SlashCommandBuilder().setName('close').setDescription('Delete your channel and free up your slot'),
].map((c) => c.toJSON());

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), {
      body: commands,
    });
    console.log('Slash commands registered.');
  } catch (err) {
    console.error(err);
  }
})();
