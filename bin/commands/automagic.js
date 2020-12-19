const imap = require("imap-simple");
const timers = require("timers");

const automagic = process.env.AUTOMAGIC == 1;
const interval = process.env.AUTOMAGIC_INTERVAL;
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
const subjectRe = /^(?<username>\S+)(\s\(.*\))? wants to join team (?<team>\S+)$/;
const keybaseAddr = "notify@keybase.io";

exports.custom = ["automagic"];
exports.automagic = function(bot, getContent) {
	if (!automagic) {
		return;
	}

	timers.setInterval(async () => {
		const connection = await imap.connect(emailSettings);
		await connection.openBox("INBOX");
		const results = await connection.search(["UNSEEN"], {
			bodies: ["HEADER"],
			markSeen: true
		});

		for (const email of results) {
			if (!email || !email.parts || !email.parts.length) {
				return;
			}

			const details = email.parts[0].body;
			if (!details || !details.subject || !details.subject.length || !details.from || !details.from.length) {
				return;
			}

			const subject = details.subject[0];
			const from = details.from[0];
			const fromMatch = from.match(fromRe);
			const subjectMatch = subject.match(subjectRe);

			if (!fromMatch || !subjectMatch || fromMatch.groups["email"] !== keybaseAddr) {
				return;
			}

			const username = subjectMatch.groups["username"];
			let usernameList = " ";
			await bot.team.addMembers({
				team: `${teamName}.${subteamName}`,
				usernames: [{ username: username, role: "reader" }]
			});
			usernameList += ",@"+ username
			timers.setTimeout(async () => {
				await bot.chat.send(
					{
						name: `${teamName}.${subteamName}`,
						membersType: "team",
						topicName: "general"
					},
					{
						body: getContent()["waiting_room_welcome"].replace("{username}", usernameList.replace('@ ,',''))
					}
				);
				usernameList = null;
			}, 300000);
		}

		connection.end();
	}, parseInt(interval));
};
