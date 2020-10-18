const teamName = process.env.KB_TEAMNAME;
exports.commands = ['adduser'];

exports['adduser'] = {
        re: /^!adduser @(?<username>\S+)\s*$/,
        description: "add a new member",
        usage: '[@username]',
        adminOnly: true,
        handle: async (_msg, match, bot, content) => {
            const username = match.groups["username"];
            await bot.team.addMembers({
                team: teamName,
                usernames: [{username: username, role: "reader"}]
            });

            await bot.chat.send({
                name: teamName,
                membersType: "team",
                topicName:  "general"
            }, {
                body: content["welcome"].replace("{username}", username)
            });
        }
    };
