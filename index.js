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
    var dataToSend;
    python = spawn('python', ['chatbot.py', message.content]);
    // collect data from script
    python.stdout.on('data', function(data) {
        console.log('Pipe data from python script ...');
        dataToSend = data.toString();
    });

    python.on('close', (code) => {
        // send data to Discord
        console.log("Replied with: " + dataToSend);
        message.channel.send(dataToSend);
    });
});
client.login(token);
//console.log(message.content);
// cd Documents/AmyGalactic
// node index.js
//cd Documents/AmyGalactic && node index.js