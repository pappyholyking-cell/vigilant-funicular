const { Telegraf, Markup } = require('telegraf');
const { exec } = require('child_process');

// YOUR TELEGRAM BOT API
const bot = new Telegraf('8628225264:AAExRJHJecgljZN3yBDPXGuOtrltMb7Y1r0');

// Helper to run commands
const runCmd = (cmd) => new Promise((resolve) => {
    exec(cmd, (err, stdout, stderr) => resolve(stdout || stderr || err.message));
});

// 1. MAIN MENU
bot.start((ctx) => {
    ctx.reply('⚔️ LEVANTER COMMAND CENTER ⚔️', Markup.keyboard([
        ['📊 Status', '📄 View Logs'],
        ['🔄 Restart Bot', '🗑️ Delete Bot'],
        ['⚙️ System Stats', '🐚 Run Command'],
        ['💀 Kill All Sessions', '➕ How to Add']
    ]).resize());
});

// 2. ADD BOT (Command: /add Name:SessionID)
bot.command('add', async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1).join(' ');
    if (!args.includes(':')) return ctx.reply("❌ Use: /add Name:SessionID");
    const [NAME, ID] = args.split(':').map(s => s.trim());
    
    ctx.reply(`🏗️ Deploying ${NAME}...\nCloning repo and installing yarn...`);
    
    const cmd = `git clone --depth 1 https://github.com/lyfe00011/levanter "${NAME}" && cd "${NAME}" && yarn install && echo "VPS = 'true'\nSESSION_ID = '${ID}'\nPREFIX = '.'\nNAME = '${NAME}'" > config.env && npx pm2 start index.js --name "${NAME}" && npx pm2 save`;
    
    const result = await runCmd(cmd);
    if (result.includes('error')) {
        ctx.reply(`❌ Failed!\n${result.substring(0, 200)}`);
    } else {
        ctx.reply(`✅ ${NAME} is now ONLINE!`);
    }
});

// 3. STATUS
bot.hears('📊 Status', async (ctx) => {
    const stdout = await runCmd('npx pm2 jlist');
    try {
        const list = JSON.parse(stdout);
        if (list.length === 0) return ctx.reply("📭 No bots running.");
        let msg = "🚀 **Active Bots:**\n";
        list.forEach(p => {
            const emoji = p.pm2_env.status === 'online' ? '🟢' : '🔴';
            msg += `\n${emoji} **${p.name}**\n   └ RAM: ${(p.monit.memory / 1024 / 1024).toFixed(1)}MB | CPU: ${p.monit.cpu}%\n`;
        });
        ctx.reply(msg, { parse_mode: 'Markdown' });
    } catch (e) { ctx.reply("❌ Error parsing status."); }
});

// 4. VIEW LOGS (Buttons)
bot.hears('📄 View Logs', async (ctx) => {
    const stdout = await runCmd('npx pm2 jlist');
    const list = JSON.parse(stdout);
    const buttons = list.map(p => [Markup.button.callback(`Logs: ${p.name}`, `logs_${p.name}`)]);
    if (buttons.length === 0) return ctx.reply("No bots to check.");
    ctx.reply("Select bot for logs:", Markup.inlineKeyboard(buttons));
});

bot.action(/logs_(.+)/, async (ctx) => {
    const name = ctx.match[1];
    const logs = await runCmd(`npx pm2 logs ${name} --lines 20 --nostream`);
    ctx.reply(`📄 **Last 20 lines for ${name}:**\n\n\`\`\`\n${logs}\n\`\`\``, { parse_mode: 'Markdown' });
});

// 5. RESTART BOT
bot.hears('🔄 Restart Bot', async (ctx) => {
    const stdout = await runCmd('npx pm2 jlist');
    const list = JSON.parse(stdout);
    const buttons = list.map(p => [Markup.button.callback(`Restart ${p.name}`, `res_${p.name}`)]);
    ctx.reply("Select bot to restart:", Markup.inlineKeyboard(buttons));
});

bot.action(/res_(.+)/, async (ctx) => {
    const name = ctx.match[1];
    await runCmd(`npx pm2 restart ${name}`);
    ctx.reply(`🔄 ${name} has been restarted.`);
});

// 6. DELETE BOT
bot.hears('🗑️ Delete Bot', async (ctx) => {
    const stdout = await runCmd('npx pm2 jlist');
    const list = JSON.parse(stdout);
    const buttons = list.map(p => [Markup.button.callback(`Kill ${p.name}`, `stop_${p.name}`)]);
    ctx.reply("Select bot to DELETE permanently:", Markup.inlineKeyboard(buttons));
});

bot.action(/stop_(.+)/, async (ctx) => {
    const name = ctx.match[1];
    await runCmd(`npx pm2 delete ${name} && rm -rf ${name}`);
    ctx.editMessageText(`🗑️ Bot "${name}" deleted and folder removed.`);
});

// 7. SYSTEM STATS
bot.hears('⚙️ System Stats', async (ctx) => {
    const ram = await runCmd("free -m | awk 'NR==2{printf \"RAM Usage: %s/%sMB (%.2f%%)\", $3,$2,$3*100/$2 }'");
    const disk = await runCmd("df -h / | awk 'NR==2{print \"Disk Space: \"$4\" available\"}'");
    ctx.reply(`🖥️ **Codespace Resources:**\n\n${ram}\n${disk}`);
});

// 8. RUN COMMAND (Shell)
bot.hears('🐚 Run Command', (ctx) => {
    ctx.reply("Send me any terminal command starting with `$`\nExample: `$ls` or `$pm2 list`", { parse_mode: 'Markdown' });
});

bot.hears(/^\$/, async (ctx) => {
    const cmd = ctx.message.text.replace('$', '');
    ctx.reply("⏳ Executing...");
    const result = await runCmd(cmd);
    ctx.reply(`\`\`\`\n${result}\n\`\`\``, { parse_mode: 'Markdown' });
});

// 9. KILL ALL
bot.hears('💀 Kill All Sessions', async (ctx) => {
    await runCmd('npx pm2 delete all && find . -maxdepth 1 -type d -not -path "." -not -path "./node_modules" -not -path "./.git" -exec rm -rf {} +');
    ctx.reply("💥 Total Wipeout Complete. All bots and folders deleted.");
});

bot.hears('➕ How to Add', (ctx) => {
    ctx.reply("Send: `/add BotName:SessionID`", { parse_mode: 'Markdown' });
});

// --- CRASH MONITOR & KEEP-ALIVE ---
// Checks every 1 minute if any bot has stopped/errored and sends you a message
setInterval(async () => {
    const stdout = await runCmd('npx pm2 jlist');
    try {
        const list = JSON.parse(stdout);
        list.forEach(p => {
            if (p.pm2_env.status === 'errored' || p.pm2_env.status === 'stopped') {
                bot.telegram.sendMessage('YOUR_CHAT_ID', `⚠️ ALERT: Bot "${p.name}" has stopped! Check logs.`);
            }
        });
    } catch (e) {}
    console.log('Keep-alive ping: ' + new Date().toISOString());
}, 60000);

bot.launch();
console.log("MANAGER IS FULLY OPERATIONAL");
                                                          
