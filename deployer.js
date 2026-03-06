const { Telegraf, Markup } = require('telegraf');
const { exec } = require('child_process');

const bot = new Telegraf('8628225264:AAExRJHJecgljZN3yBDPXGuOtrltMb7Y1r0');

// Main Menu
bot.start((ctx) => {
    ctx.reply('🤖 Levanter Manager Console', Markup.keyboard([
        ['📊 Status', '🗑️ Delete Bot'],
        ['➕ How to Add']
    ]).resize());
});

// Instruction for adding
bot.hears('➕ How to Add', (ctx) => {
    ctx.reply("To add a new bot, send:\n`/add BotName:SessionID`", { parse_mode: 'Markdown' });
});

// Logic to ADD a bot
bot.command('add', (ctx) => {
    const args = ctx.message.text.split(' ').slice(1).join(' ');
    if (!args.includes(':')) return ctx.reply("❌ Use: /add Name:SessionID");

    const [NAME, ID] = args.split(':');
    ctx.reply(`🛠 Deploying ${NAME}...`);

    const deployCmd = `git clone --depth 1 https://github.com/lyfe00011/levanter "${NAME}" && cd "${NAME}" && yarn install && echo "VPS = 'true'\nSESSION_ID = '${ID}'\nPREFIX = '.'\nNAME = '${NAME}'" > config.env && pm2 start index.js --name "${NAME}" && pm2 save`;

    exec(deployCmd, (err) => {
        if (err) return ctx.reply(`❌ Error: ${err.message}`);
        ctx.reply(`✅ ${NAME} is LIVE!`);
    });
});

// Logic to check STATUS (Active Sessions)
bot.hears('📊 Status', (ctx) => {
    exec('pm2 jlist', (err, stdout) => {
        const list = JSON.parse(stdout);
        if (list.length === 0) return ctx.reply("No bots running.");
        
        let msg = "✨ **Active Sessions:**\n";
        list.forEach(proc => {
            msg += `\n🤖 Name: ${proc.name}\n📈 Status: ${proc.pm2_env.status}\n♻️ Restarts: ${proc.pm2_env.restart_time}\n`;
        });
        ctx.reply(msg, { parse_mode: 'Markdown' });
    });
});

// Logic to DELETE (Generates Buttons for each bot)
bot.hears('🗑️ Delete Bot', (ctx) => {
    exec('pm2 jlist', (err, stdout) => {
        const list = JSON.parse(stdout);
        const buttons = list.map(proc => [Markup.button.callback(`❌ Stop ${proc.name}`, `stop_${proc.name}`)]);
        
        if (buttons.length === 0) return ctx.reply("Nothing to delete.");
        
        ctx.reply("Select a bot to stop and remove:", Markup.inlineKeyboard(buttons));
    });
});

// Handle the Delete Button Click
bot.action(/stop_(.+)/, (ctx) => {
    const botName = ctx.match[1];
    exec(`pm2 delete ${botName} && rm -rf ${botName}`, (err) => {
        if (err) return ctx.reply(`❌ Failed to delete ${botName}`);
        ctx.editMessageText(`🗑️ ${botName} has been stopped and folder deleted.`);
    });
});

// Keep-alive for Codespace
setInterval(() => console.log('Keep-alive: ' + new Date().toISOString()), 300000);

bot.launch();
console.log("Manager Online with Buttons!");
