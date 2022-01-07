# MLH-ChatBot
The intent based chatbot was made for the 2021 Christmas hackathon. My friend, Leo worked on the Python discord API integration while I worked on the back-end model. Intent based chatbots are agents meant to determine the intent of a user according to its input. The inspiration for this bot was Siri.


# How it worked
This bot leverages a supervised machine learning model that performs a classification on a bag of words formed by the user input to determine the user's intent. The problem can be deduces to a multi clssification problem.
There is a chatbotmodel.h5 file, which is an already trained agent on the current intent file. The current intent file represents the variouse topics one wants to talk about during the hollidays. 
# how to use

First obtain a discord bot token and put it in the .env file put it where it said <Your bot token>

Define your intents and run training.py

Run chatbot.py to have the bot running
  
 Be sure to get the token by clicking copy
![image](https://user-images.githubusercontent.com/34801810/148580601-a3414f86-9588-41a7-8779-98849e6135d3.png)

  Also do not forget the '' around the token
  
  <img width="550" alt="image" src="https://user-images.githubusercontent.com/34801810/148580982-74040ea5-9474-4c18-9bfe-8d7b2f9cec6e.png">
