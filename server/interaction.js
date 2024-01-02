import { entersState, joinVoiceChannel, VoiceConnectionStatus } from "@discordjs/voice";
import { GuildMember } from "discord.js";
import { createListeningStream } from "./createListeningStream.js";

async function join(interaction, recordable, client, connection) {
  await interaction.deferReply();
  if (!connection) {
    if (interaction.member instanceof GuildMember && interaction.member.voice.channel) {
      const channel = interaction.member.voice.channel;
      connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        selfDeaf: false,
        selfMute: false,
        adapterCreator: channel.guild.voiceAdapterCreator,
      });

      connection.on("error", console.warn);

      console.log("stateChange", connection.state.status);

      connection.on("stateChange", (oldState, newState) => {
        console.log("stateChange", oldState.status, newState.status);
      });

      connection.on("debug", console.log);
    } else {
      await interaction.followUp("Join a voice channel and then try that again!");
      return;
    }
  }

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 20e3);
    const receiver = connection.receiver;

    receiver.speaking.on("start", (userId) => {
      if (recordable.has(userId)) {
        createListeningStream(receiver, userId, client.users.cache.get(userId));
      }
    });
  } catch (error) {
    console.warn(error);
    await interaction.followUp(
      "Failed to join voice channel within 20 seconds, please try again later!"
    );
  }

  await interaction.followUp("Ready!");
}

async function record(interaction, recordable, client, connection) {
  if (connection) {
    const userId = interaction.options.get("speaker").value;
    recordable.add(userId);

    const receiver = connection.receiver;
    if (connection.receiver.speaking.users.has(userId)) {
      createListeningStream(receiver, userId, client.users.cache.get(userId));
    }

    await interaction.reply({ ephemeral: true, content: "Listening!" });
  } else {
    await interaction.reply({
      ephemeral: true,
      content: "Join a voice channel and then try that again!",
    });
  }
}

async function leave(interaction, recordable, _client, connection) {
  if (connection) {
    connection.destroy();
    recordable.clear();
    await interaction.reply({ ephemeral: true, content: "Left the channel!" });
  } else {
    await interaction.reply({ ephemeral: true, content: "Not playing in this server!" });
  }
}

const interactionHandlers = new Map();
interactionHandlers.set("join", join);
interactionHandlers.set("record", record);
interactionHandlers.set("leave", leave);

export { interactionHandlers };
