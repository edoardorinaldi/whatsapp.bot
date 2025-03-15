const express = require('express');
const axios = require('axios');
require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

const app = express();
app.use(express.json());

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

let db;
let messagesCollection;

// Initialize MongoDB client
async function connectDB() {
    try {
        await client.connect();
        db = client.db('whatsappBot');  // Your DB name
        messagesCollection = db.collection('messages'); // Your collection name
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error("Error connecting to MongoDB: ", error);
    }
}

// This is the function that stores a message in MongoDB
async function storeMessage(message) {
    try {
        const result = await messagesCollection.insertOne({
            phoneNumber: message.from,  // Assuming 'from' is the sender's phone number
            text: message.text,         // Assuming 'text' is the message content
            timestamp: new Date()       // Timestamp for the message
        });

        console.log(`Message stored with id: ${result.insertedId}`);
    } catch (error) {
        console.error("Error storing message: ", error);
    }
}

app.get('/webhook', (req, res) => {
    if (req.query['hub.verify_token'] === VERIFY_TOKEN) {
        res.send(req.query['hub.challenge']);
    } else {
        res.send('Verification failed');
    }
});

// app.post('/webhook', async (req, res) => {
//     const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
//     if (message) {
//         const phone = message.from;
//         const text = message.text.body;

//         const responseText = `You said: ${text}`;

//         await axios.post(
//             `https://graph.facebook.com/v15.0/${PHONE_ID}/messages`,
//             {
//                 messaging_product: 'whatsapp',
//                 to: phone,
//                 text: { body: responseText },
//             },
//             { headers: { Authorization: `Bearer ${TOKEN}` } }
//         );
//     }
//     res.sendStatus(200);
// });

app.post('/webhook', (req, res) => {
    try {
        const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
        if (message) {
            // Store the message in MongoDB
            storeMessage(message);

            // Respond to the WhatsApp API (e.g., send a reply)
            const phone = message.from;
            const responseText = `You said: ${message.text.body}`;

            axios.post(
                `https://graph.facebook.com/v15.0/${PHONE_ID}/messages`,
                {
                    messaging_product: 'whatsapp',
                    to: phone,
                    text: { body: responseText },
                },
                { headers: { Authorization: `Bearer ${TOKEN}` } }
            ).then(() => {
                console.log('Response sent to user');
            }).catch((error) => {
                console.error('Error sending response: ', error);
            });
        } else {
            console.log('No message data found');
        }
        res.sendStatus(200);
    } catch (error) {
        console.error("Error handling incoming message: ", error);
        res.sendStatus(500);
    }
});

app.listen(3000, async () => {
    console.log('Bot is running on port 3000');
    await connectDB();  // Initialize DB connection when server starts
});