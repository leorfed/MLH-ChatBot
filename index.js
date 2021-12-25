const fs = require('fs');
const Discord = require('discord.js');
const { prefix, token } = require('./config.json');

const client = new Discord.Client();
client.commands = new Discord.Collection();

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	client.commands.set(command.name, command);
}

client.once('ready', () => {
	console.log('Ready!');
//client.user.setActivity(" shenanigans",{type:"I like"});
});

client.on('message', message => {
    console.log(message.content);

	if (!message.content.startsWith(prefix) || message.author.bot) return;

	const args = message.content.slice(prefix.length).split(/ +/);
	const command = args.shift().toLowerCase();

	if (command === 'ping') {
		message.channel.send('Pong.');
	}
	if (command === 'bobliu') {
            //message.channel.send('I love B:wheelchair:bliu');
		message.channel.send('I do not love amy');
	} else if (command === 'beep') {
		message.channel.send('Boop.');
	} else if (command === 'tzak_el') {
		message.channel.send('I love Dora Su.');
	} else if (command === 'catgirl') {
		message.channel.send('I want to kick catgirl');
	}else if (command === 'bobliureee') {
		message.channel.send('Stop Inviting people B:wheelchair:bliu :rage:');
		message.channel.send('Stop Inviting people B:wheelchair:bliu :rage:');
		message.channel.send('Grind 4 Euclid B:wheelchair:bliu :rage:');
		message.channel.send('Grind 4 Euclid B:wheelchair:bliu :rage: ');
		message.channel.send('do the problems B:wheelchair:bliu :blobreee: ');
		message.channel.send('do the problems B:wheelchair:bliu :blobreee: ');
		message.channel.send('stop copying code B:wheelchair:bliu :blobreee: ');
		message.channel.send('stop copying code B:wheelchair:bliu :blobreee: ');
		message.channel.send('stop spoiling problems B:wheelchair:bliu :blobreee: ');
		message.channel.send('stop spoiling problems B:wheelchair:bliu :blobreee: ');
		message.channel.send('play minecraft B:wheelchair:bliu :blobreee: ');
		message.channel.send('play minecraft B:wheelchair:bliu :blobreee: ');
	} else if (command === 'oly') {
		message.channel.send(':wheelchair:lympiads');
	}
	else if (command === 'server') {
		message.channel.send(`Server name: ${message.guild.name}\nTotal members: ${message.guild.memberCount}`);
	} else if (command === 'user-info') {
		message.channel.send(`Your username: ${message.author.username}\nYour ID: ${message.author.id}`);

	} else if (command === 'info') {
		if (!args.length) {
			return message.channel.send(`You didn't provide any arguments, ${message.author}!`);
		} else if (args[0] === 'foo') {
			return message.channel.send('bar');
		}

		message.channel.send(`First argument: ${args[0]}`);
	} else if (command === 'kick') {
		if (!message.mentions.users.size) {
			return message.reply('you need to tag a user in order to kick them!');
		}

		let taggedUser = message.mentions.members.first();

		message.channel.send(`Goodbye: ${taggedUser.displayName}`);
		taggedUser.kick();
	} else if (command === 'avatar') {
		if (!message.mentions.users.size) {
			return message.channel.send(`Your avatar: <${message.author.displayAvatarURL}>`);
		}

		const avatarList = message.mentions.users.map(user => {
			return `${user.username}'s avatar: <${user.displayAvatarURL}>`;
		});

		message.channel.send(avatarList);
	} else if (command === 'prune') {
		const amount = parseInt(args[0]) + 1;

		if (isNaN(amount)) {
			return message.reply('that doesn\'t seem to be a valid number.');
		} else if (amount <= 1 || amount > 100) {
			return message.reply('you need to input a number between 1 and 99.');
		}

		message.channel.bulkDelete(amount, true).catch(err => {
			console.error(err);
			message.channel.send('there was an error trying to prune messages in this channel!');
		});
	}else if (command === 'spam') {
	    const amount = parseInt(args[0]);

		if (isNaN(amount)) {
			return message.reply('that doesn\'t seem to be a valid number.');
		}else if (!args.length) {
			return message.channel.send(`You didn't provide any arguments, ${message.author}!`);
		} else if (args[1] === 'foo') {
			return message.channel.send(':wheelchair:');
		}
        if(amount>20)return message.channel.send(`Go fuck yourself , ${message.author}!`);
		for (i = 0; i < amount; i++)message.channel.send(`${args[1]}`);
	}

});

client.login(token);
//console.log(message.content);
// cd Documents/AmyGalactic
// node index.js
//cd Documents/AmyGalactic && node index.js
