#!/usr/bin/env node
require("dotenv").config();
const Bot = require("keybase-bot");
const keybaseExec = require("keybase-bot/lib/utils/keybaseExec").default;
const regexEscape = require("regex-escape");
const timers = require("timers");
const fs = require('fs');
const path = require('path');
const cmdLogic = require('./commands/cmdlogic.js');

const username = process.env.KB_USERNAME;
const paperkey = process.env.KB_PAPERKEY;
const teamName = process.env.KB_TEAMNAME;
const subteamName = process.env.AUTOMAGIC_SUBTEAM;
const contentFolder = process.env.KB_CONTENT;

const ignoredContent = [
    "welcome",
    "waiting_room_welcome"
];

const bot = new Bot();

let content = {};
let commands = {};
let adminIds = [];
let builtInCommands = {};

async function main() {
    console.log('initiating bot...')
    await bot.init(username, paperkey);
    console.log('bot started!')
    console.log('watching all channels for messages!');
    loadBuiltInCommands();
    await updateAppData();
    timers.setInterval(updateAppData, 300000);

    await bot.chat.watchAllChannelsForNewMessages(async msg => {
        if (msg.content.type !== "text" || !msg.content.text.body.startsWith("!")) {
            return;
        }

        console.log('message recieved: ' + msg.sender.username)
        const isAdmin = adminIds.some(aId => aId === msg.sender.uid);
        const isTeamChat = msg.channel.name === teamName
            || msg.channel.name === subteamName;

        if (!isAdmin && !isTeamChat) {
            return;
        }

        for (const cmd of Object.values(commands)) {
            const match = msg.content.text.body.match(cmd.re);
            if(match) {
                if (!cmd.adminOnly || isAdmin) {
                    cmd.handle(msg, match, bot, content);
                } else {
                    console.log("Insufficent privs");
                }

                break;
            }
        }
    }, e => console.error(e));
}

function loadBuiltInCommands() {
    console.log("Loading built in commands...");

    let otherFunc = 0;
    let commandCount = 0;
    let cmd_directory = path.join(__dirname, 'commands');
    let cmds = fs.readdirSync(cmd_directory);

    cmds.forEach(cmdFile => {
        let cmd;
        try {
            cmd = require(`${cmd_directory}/${cmdFile}`);
        } catch (err) {
            console.error(`Improper setup of the '${cmdFile}' command. : ${err}`);
            return;
        }

        if ('commands' in cmd) {
            cmd.commands.forEach(cmdName => {
                if (cmdName in cmd) {
                    cmdLogic.addCommand(cmdName, cmd[cmdName], builtInCommands);
                    commandCount++;
                }
            });
        }

        if ('custom' in cmd) {
            cmd.custom.forEach(customName => {
                if (customName in cmd) {
                    cmdLogic.addCustomFunc(cmd[customName], bot, () => content);
                    otherFunc++;
                }
            });
        }
    });

    console.log(`Loaded ${commandCount} chat commands and ${otherFunc} custom functions.`);
}

async function updateAppData() {
    await updateAdminIds();
    await updateContent();
    await updateCommands();
}

async function updateAdminIds() {
    console.log('Updating Admin and Owners List...')
    const result = await bot.team.listTeamMemberships({team: teamName});
    if (!result.members.admins && !result.members.owners){
        console.log("error no admins or owners found!");
        return;
    }

    let sowner = result.members.owners;
    let sadmin = result.members.admins;
    adminIds = [
        ...(sowner ? sowner.map(it => it.uv.uid) : []),
        ...(sadmin ? sadmin.map(it => it.uv.uid) : [])
    ];
}

async function updateCommands() {
    console.log('updating txt commands...')

    let nCommands = {};
    let commandCount = 0;
    for (const contentKey in content) {
        if (ignoredContent.some(it => it === contentKey)) {
            continue;
        }

        commandCount++;
        nCommands = {
            ...nCommands,
            [contentKey]: {
                re: new RegExp(`^!${regexEscape(contentKey)}\\s*$`),
                adminOnly: false,
                handle: async msg => await bot.chat.send(msg.conversationId, {
                    body: content[contentKey]
                })
            }
        };
    }

    commands = {
        ...nCommands,
        ...builtInCommands
    };

    await bot.chat.clearCommands();
    await bot.chat.advertiseCommands({
        advertisements: [{
            type: "public",
            commands: Object.keys(commands).map(it => ({
                name: it,
                description: commands[it].description,
                usage: commands[it].usage
            }))
        }]
    });

    console.log(`Updated ${commandCount} txt commands.`);
}

async function updateContent() {
    console.log('updating content...')
    const workingDir = bot["_workingDir"];
    const fileList = (await keybaseExec(workingDir, null,
        ["fs", "ls", `/keybase/team/${teamName}/${contentFolder}`, "--one"]))
        .split("\n")
        .filter(it => !!it);

    let result = {};
    for (const fileName of fileList.filter(it => it.endsWith(".txt"))) {
        result[fileName.split(".").slice(0, -1).join(".")] = await readFile(fileName);
    }

    content = result;
}

async function readFile(fileName) {
    const workingDir = bot["_workingDir"];
    return await keybaseExec(workingDir, null,
        ["fs", "read", `/keybase/team/${teamName}/${contentFolder}/${fileName}`]);
}

async function exit() {
    await bot.deinit();
    process.exit();
}

process.on("SIGINT", exit);
process.on("SIGTERM", exit);

main();
