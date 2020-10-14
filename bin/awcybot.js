#!/usr/bin/env node
require("dotenv").config();
const Bot = require("keybase-bot");
const keybaseExec = require("keybase-bot/lib/utils/keybaseExec").default;
const regexEscape = require("regex-escape");
const timers = require("timers");

const username = process.env.KB_USERNAME;
const paperkey = process.env.KB_PAPERKEY;
const teamName = process.env.KB_TEAMNAME;
const contentFolder = process.env.KB_CONTENT;

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
                team: teamName,
                usernames: [{username: match.groups["username"], role: "reader"}]
            });
        }
    }
};

async function main() {
    console.log('initiating bot...')
    await bot.init(username, paperkey);
    console.log('bot started!')
    console.log('watching all channels for messages!');
    await updateAppData();
    timers.setInterval(updateAppData, 300000);

    await bot.chat.watchAllChannelsForNewMessages(async msg => {
        if (msg.content.type !== "text" || !msg.content.text.body.startsWith("!")) {
            return;
        }
        console.log('message recieved: ')
        const isAdmin = adminIds.some(aId => aId === msg.sender.uid);
        const isTeamChat = msg.channel.name === teamName;

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
    console.log('Updating Admin and Owners List...')
    const result = await bot.team.listTeamMemberships({team: teamName});
    //console.log(result.members.admins);
    //console.log(result.members.owners);
    if (!result.members.admins && !result.members.owners){
      console.log("error no admins or owners found!");
      return;
   }
   let sowner = result.members.owners;
   let sadmin = result.members.admins;
   if (sadmin == null) {
     adminIds = [
         ...sowner.map(it => it.uv.uid)
     ];
    return;
   }
   if (sowners == null) {
     adminIds = [
         ...sadmins.map(it => it.uv.uid)
     ];
    return;
   }
   else {
     adminIds = [
         ...sadmins.map(it => it.uv.uid),
         ...sowners.map(it => it.uv.uid)
     ];
    return;
   }
}

async function updateCommands() {
    console.log('updating commands...')
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
    console.log('updating content...')
    const workingDir = bot["_workingDir"];
    //console.log(`/keybase/team/${teamName}/${contentFolder}`)
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