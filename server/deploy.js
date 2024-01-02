import { ApplicationCommandOptionType } from "discord.js";

async function deploy(guild) {
  await guild.commands.set([
    {
      name: "join",
      description: "Joins the voice channel that you are in",
    },
    {
      name: "record",
      description: "Enables recording for a user",
      options: [
        {
          name: "speaker",
          type: ApplicationCommandOptionType.User,
          description: "The user to record",
          required: true,
        },
      ],
    },
    {
      name: "leave",
      description: "Leave the voice channel",
    },
  ]);
}

export { deploy };
