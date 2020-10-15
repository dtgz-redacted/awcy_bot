const imap = require("imap-simple");
const timers = require("timers");

const interval = process.env.EMAIL_INTERVAL;
const teamName = process.env.KB_TEAMNAME;
const subteamName = process.env.AUTOMAGIC_SUBTEAM;
const emailSettings = {
    imap: {
        user: process.env.EMAIL_LOGIN,
        password: process.env.EMAIL_PASSWORD,
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_TLS_PORT,
        authTimeout: 3000,
        tls: true,
        tlsOptions: {
            rejectUnauthorized: false
        }
    }
};

const fromRe = /^.*<(?<email>\S+)>$/;
const subjectRe = /^(?<username>\S+) wants to join team (?<team>\S+)$/;
const keybaseAddr = "notify@keybase.io";

exports.run = function(bot, getContent) {
    timers.setInterval(async () => {
        const connection = await imap.connect(emailSettings);
        await connection.openBox("INBOX");
        const results = await connection.search([
            "UNSEEN"
        ], {
            bodies: ["HEADER"],
            markSeen: true
        });

        for (const email of results) {
            if (!email || !email.parts || !email.parts.length) {
                return;
            }

            const details = email.parts[0].body;
            if (!details || !details.subject || !details.subject.length
                || !details.from || !details.from.length) {
                return;
            }

            const subject = details.subject[0];
            const from = details.from[0]
            const fromMatch = from.match(fromRe);
            const subjectMatch = subject.match(subjectRe);
            
            if (!fromMatch || !subjectMatch || fromMatch.groups["email"] !== keybaseAddr) {
                return;
            }

            const username = subjectMatch.groups["username"];
            await bot.team.addMembers({
                team: `${teamName}.${subteamName}`,
                usernames: [{username: username, role: "reader"}]
            });
        };

        connection.end();
    }, parseInt(interval));
};