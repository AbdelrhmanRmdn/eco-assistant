# Team Project Discord Bot

A Discord.js bot with private idea clarification/revision tickets and a fixed Arabic project overview reply. It does not use an external AI API.

## Requirements

- Node.js 20.11+
- A Discord application/bot
- The Arabic answer text at `knowledge/answer-template.md`

## Setup

1. Copy `.env.example` to `.env` and fill in the Discord token, application ID, server ID, and `AI_CHANNEL_ID` (the channel where teammates will ask project questions). No OpenAI key is needed.
2. The response template is stored in `knowledge/answer-template.md` and can be edited there.
3. In the Discord Developer Portal, add the `bot` and `applications.commands` scopes to your server installation. Under **Bot > Privileged Gateway Intents**, enable **Message Content Intent**. Grant the bot `View Channels`, `Send Messages`, `Read Message History`, `Manage Channels`, and `Manage Roles`. Configure `TICKET_SUPPORT_ROLE_ID` and `TICKET_CATEGORY_ID` if desired.
4. Install and run:

   ```sh
   npm install
   npm run register
   npm start
   ```

Teammates can post in the configured `AI_CHANNEL_ID` or in a private ticket; the bot replies with the fixed Arabic project overview and mentions the `Leader AI` and `Team Leader` roles. Set `AI_LEADER_ROLE_ID` and `TEAM_LEADER_AI_ROLE_ID` in `.env` to guarantee role mentions. `/setup-ticket` posts the Arabic clarification panel and green button in the channel where it is run (requires Manage Server). New tickets include a **Close ticket** button, and staff can also use `/close-ticket` in an existing ticket. Only members with the Leader AI or Team Leader role can close a ticket; closure renames and locks it while keeping its history.

## Notes

- The bot needs the privileged Message Content intent to read questions in the selected channel and ticket channels. It ignores messages outside those channels, bot messages, and empty messages.
- Each message receives the same configured response template; no external model or API key is used.
- The PDF is excluded from Git by default. Never commit a real Discord token.
