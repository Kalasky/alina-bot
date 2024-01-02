import 'dotenv/config'
import { Client, GatewayIntentBits, Partials } from "discord.js";
import { getVoiceConnection } from "@discordjs/voice";
import { interactionHandlers } from "./interaction.js";
import { deploy } from "./deploy.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.GuildMember,
    Partials.User,
    Partials.GuildScheduledEvent,
    Partials.ThreadMember,
  ],
});

client.once("ready", async () => {
  console.log("Ready!");
  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  if (guild) {
    await deploy(guild);
  } else {
    console.warn("Unable to find guild by ID");
  }
});

const recordable = new Set();

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;
  const handler = interactionHandlers.get(commandName);
  if (!handler) {
    await interaction.reply({ content: "Command not recognized", ephemeral: true });
    return;
  }

  try {
    await handler(interaction, recordable, client, getVoiceConnection(interaction.guildId));
  } catch (error) {
    console.error(error);
    await interaction.reply({
      content: "There was an error while executing this command!",
      ephemeral: true,
    });
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
