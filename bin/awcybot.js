#!/usr/bin/env node
require("dotenv").config();
const Bot = require("keybase-bot");
const keybaseExec = require("keybase-bot/lib/utils/keybaseExec").default;
const regexEscape = require("regex-escape");
const timers = require("timers");

const bot = new Bot();

let content = {};
let commands = {};
let adminIds = [];
const builtinCommands = {
    adduser: {
        re: /^!adduser @(?<username>\S+)\s*$/,
        description: "add a new member",
        usage: '[@username]',
        adminOnly: true,
        handle: async (msg, match) => {
            await bot.team.addMembers({
                team: process.env.TEAM_NAME,
                usernames: [{username: match.groups["username"], role: "reader"}]
            });
        }
    }
};

async function main() {
    await bot.init(process.env.KEYBASE_USERNAME, process.env.PAPER_KEY);
    await updateAppData();
    timers.setInterval(updateAppData, 300000);

    await bot.chat.watchAllChannelsForNewMessages(async msg => {
        if (msg.content.type !== "text" || !msg.content.text.body.startsWith("!")) {
            return;
        }

        const isAdmin = adminIds.some(aId => aId === msg.sender.uid);
        const isTeamChat = msg.channel.name === process.env.TEAM_NAME;

        if (!isAdmin && !isTeamChat) {
            return;
        }

        for (const cmd of Object.values(commands)) {
            const match = msg.content.text.body.match(cmd.re);
            if(match) {
                if (!cmd.adminOnly || isAdmin) {
                    cmd.handle(msg, match);
                } else {
                    await bot.chat.send(msg.conversationId, {
                        body: "nah"
                    });
                }

                break;
            }
        }
    }, e => console.error(e));
}

async function updateAppData() {
    await updateAdminIds();
    await updateContent();
    await updateCommands();
}

async function updateAdminIds() {
    const result = await bot.team.listTeamMemberships({team: process.env.TEAM_NAME});
    adminIds = [
        ...result.members.admins.map(it => it.uv.uid),
        ...result.members.owners.map(it => it.uv.uid)
    ];
}

async function updateCommands() {
    let nCommands = {};
    for (const contentKey in content) {
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
        ...builtinCommands
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
}

async function updateContent() {
    const workingDir = bot["_workingDir"];
    const fileList = (await keybaseExec(workingDir, null,
        ["fs", "ls", `/keybase/team/${process.env.TEAM_NAME}/${process.env.CONTENT_FOLDER}`, "--one"]))
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
        ["fs", "read", `/keybase/team/${process.env.TEAM_NAME}/${process.env.CONTENT_FOLDER}/${fileName}`]);
}

async function exit() {
    await bot.deinit();
    process.exit();
}

process.on("SIGINT", exit);
process.on("SIGTERM", exit);

main();