# MLH-ChatBot
This is an intent based chatbot which made for the 2021 Christmas hackerthon. Intent based chatbots are agents that are meant to determint the intent of a user baised on it's input. The inspiration for this bot was Siri. 

# How it worked
This bot leverages a supervized machine learning model that performs classification on a bag of words to determine the intent. Just like a muti class classification model that is used to classify the picture of a cat or a dog or a parrot it determines the intents of the user using the bag of words interpretation of the user input. 

#how to use

First obtain a discord bot token and put it in the .env file put it where it said <Your bot token>

Define your intents and run training.py

Run chatbot.py to have the bot running
