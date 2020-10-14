const teamName = process.env.KB_TEAMNAME;
exports.adduser = {
        re: /^!adduser @(?<username>\S+)\s*$/,
        description: "add a new member",
        usage: '[@username]',
        adminOnly: true,
        handle: async (bot, msg, match) => {
            await bot.team.addMembers({
                team: teamName,
                usernames: [{username: match.groups["username"], role: "reader"}]
            });
        }
    };
