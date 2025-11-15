const { 
    Client, 
    GatewayIntentBits, 
    SlashCommandBuilder, 
    REST, 
    Routes 
} = require("discord.js");

const fs = require("fs");
const cron = require("node-cron");

const token = "MTQzOTM2OTM4MDk2NTM4NDMzNw.GpBHek.2m2yVu3cwbNMq2LTTUXipI4ssxV8eeHKRpVT74";

// Load sales data
let sales = {};
if (fs.existsSync("data.json")) {
    sales = JSON.parse(fs.readFileSync("data.json"));
}

// Create bot client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
    ]
});

// ----------- SLASH COMMANDS -----------
const commands = [

    // /sale
    new SlashCommandBuilder()
        .setName("sale")
        .setDescription("Submit a sale")
        .addStringOption(option =>
            option.setName("name").setDescription("Your name").setRequired(true)
        )
        .addNumberOption(option =>
            option.setName("amount").setDescription("Sale amount").setRequired(true)
        )
        .addAttachmentOption(option =>
            option.setName("proof").setDescription("Sale proof image").setRequired(true)
        ),

    // /totals
    new SlashCommandBuilder()
        .setName("totals")
        .setDescription("Shows all weekly totals"),

    // /mytotal
    new SlashCommandBuilder()
        .setName("mytotal")
        .setDescription("Shows your personal total"),

    // /leaderboard
    new SlashCommandBuilder()
        .setName("leaderboard")
        .setDescription("Shows top sellers"),

    // /reset (admin only)
    new SlashCommandBuilder()
        .setName("reset")
        .setDescription("ADMIN: Reset all sales"),

    // /remove
    new SlashCommandBuilder()
        .setName("remove")
        .setDescription("Remove amount from a user's total")
        .addStringOption(option =>
            option.setName("name").setDescription("Person's name").setRequired(true)
        )
        .addNumberOption(option =>
            option.setName("amount").setDescription("Amount to remove").setRequired(true)
        ),

    // /payouts
    new SlashCommandBuilder()
        .setName("payouts")
        .setDescription("Shows 10% payout amounts for each seller"),

].map(cmd => cmd.toJSON());

// Register commands on bot start
const rest = new REST({ version: '10' }).setToken(token);

client.once("clientReady", async () => {
    console.log(`Logged in as ${client.user.tag}`);

    await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: commands }
    );

    console.log("All commands registered!");
});

// ------------- COMMAND HANDLING -------------
client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const cmd = interaction.commandName;

    // /sale
    if (cmd === "sale") {
        const name = interaction.options.getString("name");
        const amount = interaction.options.getNumber("amount");
        const proof = interaction.options.getAttachment("proof");

        if (!sales[name]) sales[name] = 0;
        sales[name] += amount;

        fs.writeFileSync("data.json", JSON.stringify(sales, null, 2));

        return interaction.reply({
            content:
                `✔ **Sale Recorded!**\n**Name:** ${name}\n**Amount:** $${amount}\n**Total Now:** $${sales[name]}`,
            files: [proof.url]
        });
    }

    // /totals
    if (cmd === "totals") {
        let msg = "**📊 Weekly Totals:**\n\n";

        if (Object.keys(sales).length === 0)
            msg += "No sales yet.";

        for (const name in sales)
            msg += `**${name}** — $${sales[name]}\n`;

        return interaction.reply(msg);
    }

    // /mytotal
    if (cmd === "mytotal") {
        const user = interaction.user.username;

        const total = sales[user] || 0;

        return interaction.reply(
            `👤 **${user}**\nYour total: **$${total}**`
        );
    }

    // /leaderboard
    if (cmd === "leaderboard") {
        const sorted = Object.entries(sales)
            .sort((a, b) => b[1] - a[1]);

        let msg = "🏆 **Leaderboard (Top Sellers)**\n\n";

        sorted.forEach(([name, amount], idx) => {
            msg += `**${idx + 1}. ${name}** — $${amount}\n`;
        });

        return interaction.reply(msg);
    }

    // /reset (admin)
    if (cmd === "reset") {
        if (!interaction.member.permissions.has("Administrator"))
            return interaction.reply("❌ You must be an **Administrator**.");

        sales = {};
        fs.writeFileSync("data.json", JSON.stringify(sales, null, 2));

        return interaction.reply("🔄 All sales reset successfully.");
    }

    // /remove
    if (cmd === "remove") {
        const name = interaction.options.getString("name");
        const amount = interaction.options.getNumber("amount");

        if (!sales[name]) sales[name] = 0;

        sales[name] -= amount;
        if (sales[name] < 0) sales[name] = 0;

        fs.writeFileSync("data.json", JSON.stringify(sales, null, 2));

        return interaction.reply(
            `✔ Removed $${amount} from **${name}**\nNew total: $${sales[name]}`
        );
    }

    // /payouts
    if (cmd === "payouts") {
        let msg = "💰 **Weekly Payouts (10%)**\n\n";

        for (const name in sales) {
            const total = sales[name];
            const ten = (total * 0.10).toFixed(2);

            msg += `**${name}** — Owes: **$${ten}**\n`;
        }

        return interaction.reply(msg);
    }
});

// -------- WEEKLY SCHEDULED RESET ---------
cron.schedule("0 0 * * 0", () => {
    const channel = client.channels.cache.get("1439374651850489938");
    if (!channel) return;

    let msg = "📅 **Weekly Report & Reset**\n\n";

    for (const name in sales) {
        const total = sales[name];
        const ten = (total * 0.10).toFixed(2);
        msg += `**${name}** — $${total} (10%: $${ten})\n`;
    }

    channel.send(msg);

    // Reset for new week
    sales = {};
    fs.writeFileSync("data.json", JSON.stringify(sales, null, 2));
});

// Login bot
client.login(token);

