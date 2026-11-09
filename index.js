import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, Client, EmbedBuilder,
  Events, GatewayIntentBits, OverwriteType, PermissionsBitField,
} from 'discord.js';

const { DISCORD_TOKEN } = process.env;
if (!DISCORD_TOKEN) throw new Error('DISCORD_TOKEN is required.');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const answerTemplatePath = path.resolve(process.env.ANSWER_TEMPLATE_PATH || './knowledge/answer-template.md');
const answerTemplate = (await fs.readFile(answerTemplatePath, 'utf8')).trim();
const aiChannelId = process.env.AI_CHANNEL_ID;
const safeName = value => value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'teammate';

client.once(Events.ClientReady, readyClient => console.log(`Logged in as ${readyClient.user.tag}`));

function resolveRole(guild, configuredId, names, fallback) {
  const configuredRole = configuredId ? guild.roles.cache.get(configuredId) : null;
  const role = configuredRole ?? guild.roles.cache.find(item => names.includes(item.name.toLowerCase()));
  return role ? { id: role.id, mention: `<@&${role.id}>` } : { id: null, mention: fallback };
}

async function sendProjectOverview(channel, guild, replyTo = null) {
  const aiLeader = resolveRole(guild, process.env.AI_LEADER_ROLE_ID, ['leader ai'], '@Leader AI');
  const teamLeader = resolveRole(guild, process.env.TEAM_LEADER_AI_ROLE_ID, ['team leader ai', 'team leader'], '@Team Leader');
  const splitAt = answerTemplate.lastIndexOf(' ', 1800);
  const firstPart = splitAt > 0 ? answerTemplate.slice(0, splitAt) : answerTemplate.slice(0, 1800);
  const secondPart = answerTemplate.slice(firstPart.length).trim();
  const firstMessage = { content: firstPart, allowedMentions: { repliedUser: false } };
  if (replyTo) await replyTo.reply(firstMessage);
  else await channel.send(firstMessage);

  const followUp = `${secondPart}\n\nلأي سؤال محدد أو إضافي، منشن ${aiLeader.mention} أو ${teamLeader.mention}.`;
  await channel.send({
    content: followUp,
    allowedMentions: { roles: [aiLeader.id, teamLeader.id].filter(Boolean) },
  });
}

async function closeTicket(interaction) {
  if (!interaction.inGuild()) return interaction.reply({ content: 'This action is only available in a server.', ephemeral: true });
  const channel = interaction.channel;
  const isTicket = channel?.name?.startsWith('idea-') || channel?.topic?.includes('AI_HOLOBOX_TICKET');
  if (!isTicket) return interaction.reply({ content: 'This is not an active ticket.', ephemeral: true });

  const aiLeader = resolveRole(interaction.guild, process.env.AI_LEADER_ROLE_ID, ['leader ai'], '@Leader AI');
  const teamLeader = resolveRole(interaction.guild, process.env.TEAM_LEADER_AI_ROLE_ID, ['team leader ai', 'team leader'], '@Team Leader');
  const allowedRoleIds = [aiLeader.id, teamLeader.id].filter(Boolean);
  if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });
  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (!member.roles.cache.some(role => allowedRoleIds.includes(role.id))) {
    const reply = { content: 'Only the Leader AI or Team Leader role can close this ticket.', ephemeral: true };
    return interaction.editReply(reply);
  }

  const ownerMatch = channel.topic?.match(/owner:(\d+)/);
  const ownerId = ownerMatch?.[1] ?? channel.permissionOverwrites.cache.find(
    overwrite => overwrite.type === OverwriteType.Member && overwrite.id !== client.user.id,
  )?.id;
  if (!ownerId) {
    const reply = { content: 'I couldn’t identify the ticket owner, so I left the ticket unchanged.', ephemeral: true };
    return interaction.editReply(reply);
  }

  const botPermissions = channel.permissionsFor(client.user);
  if (!botPermissions?.has(PermissionsBitField.Flags.ManageChannels)
      || !botPermissions.has(PermissionsBitField.Flags.ManageRoles)) {
    return interaction.editReply('I need the Manage Channels and Manage Roles permissions to close tickets while preserving their history.');
  }

  await channel.permissionOverwrites.edit(ownerId, { SendMessages: false });
  await channel.setName(`closed-${channel.name.replace(/^(idea-|closed-)/, '')}`.slice(0, 100));
  await channel.setTopic(`CLOSED | AI_HOLOBOX_TICKET | owner:${ownerId}`);
  if (interaction.isButton()) await interaction.message.edit({ components: [] }).catch(() => {});
  await channel.send(`Ticket closed by <@${interaction.user.id}>.`);
  return interaction.editReply('Ticket closed. Its history is kept in the server.');
}

client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.guild) return;
  const isTicket = message.channel.name?.startsWith('idea-')
    || message.channel.topic?.startsWith('AI_HOLOBOX_TICKET')
    || message.channel.topic?.startsWith('Idea clarification or revision ticket opened by ');
  const isConfiguredAiChannel = Boolean(aiChannelId && message.channelId === aiChannelId);
  if (!isTicket && !isConfiguredAiChannel) return;
  const question = message.content.trim();
  if (!question) return;
  try {
    await message.channel.sendTyping();
    await sendProjectOverview(message.channel, message.guild, message);
  } catch (error) {
    console.error('Automatic project answer error:', error);
    const reply = error.code === 'ENOENT'
      ? 'I can’t find the answer template. Check `ANSWER_TEMPLATE_PATH` in the bot configuration.'
      : 'I couldn’t send the project information right now. Please try again or open a team ticket.';
    await message.reply({ content: reply, allowedMentions: { repliedUser: false } }).catch(() => {});
  }
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === 'setup-ticket') {
      if (!interaction.inGuild()) return interaction.reply({ content: 'Use this command in a server.', ephemeral: true });
      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('AI HoloBox')
        .setDescription('لو مش فاهم الفكره او مش فاكرها يا فلاحححححححح دوس فهمني و هتفتكر');
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('open_idea_ticket').setLabel('فهمني').setStyle(ButtonStyle.Success),
      );
      return interaction.reply({ embeds: [embed], components: [row] });
    }

    if (interaction.isButton() && interaction.customId === 'open_idea_ticket') {
      if (!interaction.inGuild()) return interaction.reply({ content: 'Tickets can only be opened in a server.', ephemeral: true });
      await interaction.deferReply({ ephemeral: true });
      const guild = interaction.guild;
      const permissionOverwrites = [
        { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
        { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.ManageChannels] },
      ];
      const aiLeader = resolveRole(guild, process.env.AI_LEADER_ROLE_ID, ['leader ai'], '@Leader AI');
      const teamLeader = resolveRole(guild, process.env.TEAM_LEADER_AI_ROLE_ID, ['team leader ai', 'team leader'], '@Team Leader');
      const staffRoleIds = new Set([
        process.env.TICKET_SUPPORT_ROLE_ID,
        aiLeader.id,
        teamLeader.id,
      ].filter(Boolean));
      for (const roleId of staffRoleIds) {
        permissionOverwrites.push({ id: roleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] });
      }
      const channel = await guild.channels.create({
        name: `idea-${safeName(interaction.user.username)}`,
        type: ChannelType.GuildText,
        ...(process.env.TICKET_CATEGORY_ID ? { parent: process.env.TICKET_CATEGORY_ID } : {}),
        permissionOverwrites,
        topic: `AI_HOLOBOX_TICKET | owner:${interaction.user.id}`,
      });
      const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('close_idea_ticket').setLabel('Close ticket').setStyle(ButtonStyle.Danger),
      );
      await channel.send({
        content: `Hi <@${interaction.user.id}>, how can I help you?${process.env.TICKET_SUPPORT_ROLE_ID ? ` <@&${process.env.TICKET_SUPPORT_ROLE_ID}>` : ''}`,
        components: [closeRow],
        allowedMentions: { users: [interaction.user.id], roles: process.env.TICKET_SUPPORT_ROLE_ID ? [process.env.TICKET_SUPPORT_ROLE_ID] : [] },
      });
      await sendProjectOverview(channel, guild);
      return interaction.editReply(`Your private ticket is ready: ${channel}`);
    }

    if (interaction.isChatInputCommand() && interaction.commandName === 'close-ticket') return await closeTicket(interaction);
    if (interaction.isButton() && interaction.customId === 'close_idea_ticket') return await closeTicket(interaction);
  } catch (error) {
    console.error('Interaction error:', error);
    const message = error.code === 50013
      ? 'I don’t have the Discord permissions needed for that action. Check my channel permissions and role position.'
      : 'Something went wrong while handling that request.';
    if (interaction.deferred || interaction.replied) await interaction.followUp({ content: message, ephemeral: true }).catch(() => {});
    else await interaction.reply({ content: message, ephemeral: true }).catch(() => {});
  }
});

client.login(DISCORD_TOKEN);
