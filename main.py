import random
import json
import pickle
import numpy as np
import sys
import nltk
from dotenv import load_dotenv

import discord
import os

client = discord.Client()
load_dotenv()
TOKEN = os.getenv('TOKEN')


from nltk.stem import WordNetLemmatizer

from tensorflow.keras.models import load_model



print("GO! Bot is running!")


@client.event
async  def on_message(message):
    print(message.content)
    if message.author == client.user:
        return
    await message.channel.send(input())

client.run(TOKEN)
