import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

const { DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID || !DISCORD_GUILD_ID) {
  throw new Error('Set DISCORD_TOKEN, DISCORD_CLIENT_ID, and DISCORD_GUILD_ID in .env');
}

const commands = [
  new SlashCommandBuilder()
    .setName('setup-ticket')
    .setDescription('Post the team idea/revision ticket button in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName('close-ticket')
    .setDescription('Close this ticket (Leader AI or Team Leader only)'),
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID), { body: commands });
console.log(`Registered ${commands.length} commands in guild ${DISCORD_GUILD_ID}.`);
