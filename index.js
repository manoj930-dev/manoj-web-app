// const { Client } = require('whatsapp-web.js');
// const qrcode = require('qrcode-terminal');

// // WhatsApp client
// const client = new Client();

// // Generate QR code in terminal
// client.on('qr', (qr) => {
//     console.log("QR Code received, scan it with your WhatsApp:");
//     qrcode.generate(qr, { small: true });
// });

// // Successfully authenticated
// client.on('ready', () => {
//     console.log('✅ WhatsApp is ready!');

//     // Example: Send message to yourself or a contact
//     const number = '919785493798'; // replace with actual number
//     const chatId = number + "@c.us";

//     client.sendMessage(chatId, "Hello from Node.js WhatsApp bot!")
//         .then(() => console.log("📤 Message sent!"))
//         .catch(err => console.error("❌ Error sending message:", err));
// });

// client.initialize();


// const { Client } = require('whatsapp-web.js');
// const qrcode = require('qrcode-terminal');
// const readline = require('readline');

// const client = new Client();

// client.on('qr', (qr) => {
//     console.log("📱 Scan this QR Code:");
//     qrcode.generate(qr, { small: true });
// });

// client.on('ready', async () => {
//     console.log('✅ WhatsApp is ready!');

//     // Fetch all chats
//     const chats = await client.getChats();

//     // Display contact names
//     console.log("\n📋 Available Contacts:\n");

//     chats.forEach((chat, index) => {
//         if (chat.name || chat.formattedTitle) {
//             console.log(`${index + 1}. ${chat.name || chat.formattedTitle}`);
//         }
//     });

//     // Ask user to select and send message
//     const rl = readline.createInterface({
//         input: process.stdin,
//         output: process.stdout
//     });

//     rl.question("\n👉 Enter the contact name you want to send message to: ", async (name) => {
//         const targetChat = chats.find(chat => (chat.name || chat.formattedTitle) === name);

//         if (targetChat) {
//             rl.question("💬 Enter your message: ", async (msg) => {
//                 await client.sendMessage(targetChat.id._serialized, msg);
//                 console.log("📤 Message sent!");
//                 rl.close();
//             });
//         } else {
//             console.log("❌ Contact not found!");
//             rl.close();
//         }
//     });
// });

// client.initialize();


// const express = require('express');
// const { Client, LocalAuth } = require('whatsapp-web.js');
// const qrcode = require('qrcode');
// const cors = require('cors');

// const app = express();
// app.use(cors());
// app.use(express.json());

// let qrCodeImage = null;
// let allChats = [];
// let client;
// let isReady = false;
// let connectionProgress = 0;


// // ✅ Client initializer function
// function createClient() {
//     client = new Client({
//         authStrategy: new LocalAuth(),
//         puppeteer: {
//             headless: true,
//             args: ['--no-sandbox', '--disable-setuid-sandbox']
//         }
//     });

//     client.on('qr', async (qr) => {
//         console.log('📱 New QR Code generated');
//         qrCodeImage = await qrcode.toDataURL(qr);
//         connectionProgress = 0; // QR shown, progress reset
//     });
    
//     client.on('authenticated', () => {
//         console.log('🔐 Authenticated!');
//         connectionProgress = 50; // Halfway done
//     });
    
//     client.on('ready', async () => {
//         console.log('✅ WhatsApp is ready!');
//         allChats = await client.getChats();
//         connectionProgress = 100; // Fully connected
//         isReady = true;
//     });
    

//     client.on('disconnected', (reason) => {
//         console.log("⚠️ Client disconnected:", reason);
//         isReady = false;
//     });

//     client.initialize();
// }

// // 🔁 First time initialize
// createClient();

// // =================== API Routes ===================

// app.get('/qr', (req, res) => {
//     if (qrCodeImage) {
//         res.send(`<img src="${qrCodeImage}" alt="QR Code" />`);
//     } else {
//         res.send("QR Code not ready");
//     }
// });

// app.get('/progress', (req, res) => {
//     res.json({ progress: connectionProgress });
// });


// // app.get('/contacts', async (req, res) => {
// //     try {
// //         const chats = await client.getChats();
// //         const formatted = chats
// //             .filter(chat => chat.name || chat.formattedTitle)
// //             .map(chat => ({
// //                 id: chat.id._serialized,
// //                 name: chat.name || chat.formattedTitle
// //             }));
// //         res.json(formatted);
// //     } catch (err) {
// //         console.error("❌ Error getting contacts:", err);
// //         res.status(500).json({ error: "Failed to load contacts" });
// //     }
// // });


// app.get('/contacts', async (req, res) => {
//     try {
//         const chats = await client.getChats();
//         const formatted = chats
//             .filter(chat => chat.name || chat.formattedTitle)
//             .map(chat => ({
//                 id: chat.id._serialized,
//                 name: chat.name || chat.formattedTitle,
//                 number: chat.id._serialized.split('@')[0] // Extract number from ID
//             }));
//         res.json(formatted);
//     } catch (err) {
//         console.error("❌ Error getting contacts:", err);
//         res.status(500).json({ error: "Failed to load contacts" });
//     }
// });


// app.post('/logout', async (req, res) => {
//     try {
//         if (client) {
//             await client.logout();
//             await client.destroy();
//             qrCodeImage = null;
//             isReady = false;
//             console.log('👋 Logged out successfully!');

//             // ✅ Immediately re-create the client to regenerate QR
//             createClient();

//             res.sendStatus(200);
//         } else {
//             res.status(400).send('Client not initialized.');
//         }
//     } catch (err) {
//         console.error('Logout error:', err);
//         res.status(500).send('Logout failed.');
//     }
// });

// app.get('/status', (req, res) => {
//     res.json({ ready: isReady });
// });

// app.post('/send', async (req, res) => {
//     const { id, message } = req.body;
//     try {
//         await client.sendMessage(id, message);
//         res.json({ status: 'Message sent' });
//     } catch (e) {
//         console.error("❌ Send failed:", e);
//         res.status(500).json({ error: 'Failed to send message' });
//     }
// });

// // app.post('/add-contact', async (req, res) => {
// //     const { number } = req.body;

// //     if (!number) {
// //         return res.status(400).json({ error: 'Contact number is required' });
// //     }

// //     try {
// //         // Check if the number is already in contacts
// //         const chatExists = allChats.some(chat => chat.id._serialized.includes(number));

// //         if (chatExists) {
// //             return res.status(400).json({ error: 'Contact already saved in WhatsApp' });
// //         }

// //         // This will open the chat and send a message to the contact
// //         await client.sendMessage(`${number}@c.us`, 'Hello! This is a test message.');

// //         // Return the new contact id and name for the frontend to use
// //         res.json({ id: `${number}@c.us`, name: number });
// //     } catch (err) {
// //         console.error('❌ Error adding new contact:', err);
// //         res.status(500).json({ error: 'Failed to add new contact' });
// //     }
// // });


// app.post('/add-contact', async (req, res) => {
//     const { number } = req.body;
  
//     if (!number) {
//       return res.status(400).json({ error: 'Contact number is required' });
//     }
  
//     try {
//       const cleanNumber = number.replace(/\D/g, ''); // "919306487939"
//       const chatId = `${cleanNumber}@c.us`;
//       const message = 'Hello! This is a test message.';
  
//       await client.sendMessage(chatId, message);
  
//       res.json({ id: chatId, name: cleanNumber });
//     } catch (err) {
//       console.error('❌ Error adding new contact:', err);
//       res.status(500).json({ error: 'Failed to add new contact' });
//     }
//   });
  

//   app.post('/send-bulk', async (req, res) => {
//     const { contacts, message } = req.body;
  
//     if (!contacts || !message) {
//       return res.status(400).json({ error: 'Contacts and message are required' });
//     }
  
//     try {
//       for (const number of contacts) {
//         const formattedNumber = number.includes('@c.us') ? number : `${number.replace(/\D/g, '')}@c.us`;
//         await client.sendMessage(formattedNumber, message);
//       }
  
//       res.json({ status: 'Bulk message sent successfully' });
//     } catch (err) {
//       console.error('❌ Bulk message sending failed:', err);
//       res.status(500).json({ error: 'Failed to send bulk messages' });
//     }
//   });
  
  
  

// app.get('/me', async (req, res) => {
//     try {
//         const user = await client.getMe();
//         res.json(user);
//     } catch (err) {
//         res.status(500).json({ error: 'Failed to fetch profile' });
//     }
// });

// app.listen(5000, () => {
//     console.log('🚀 Server running on http://localhost:5000');
// });



const express = require('express');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const cors = require('cors');
const multer = require('multer')
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));



let qrCodeImage = null;
let allChats = [];
let client;
let isReady = false;
let connectionProgress = 0;
const messages = {}; // Store messages globally






app.get('/media/:mediaKey', async (req, res) => {
    try {
        const mediaKey = req.params.mediaKey;
        const message = await client.getMessageById(mediaKey);
        
        if (!message.hasMedia) {
            return res.status(404).send('Media not found');
        }
        
        const media = await message.downloadMedia();
        
        // Set proper content type
        res.set('Content-Type', media.mimetype);
        
        // Send the media data
        res.send(Buffer.from(media.data, 'base64'));
    } catch (err) {
        console.error('Error serving media:', err);
        res.status(500).send('Error retrieving media');
    }
});

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // const allowedTypes = [
  //     'image/jpeg',
  //     'image/png',
  //     'image/gif',
  //     'video/mp4',
  //     'audio/mpeg',
  //     'application/pdf'
  // ];

  const allowedTypes = [
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/avif',
    'image/webp',
    'image/bmp',
    'image/svg+xml',
    
    // Videos
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/x-msvideo', // .avi
    
    // Audio
    'audio/mpeg',  // .mp3
    'audio/wav',
    'audio/ogg',
    
    // Documents
    'application/pdf',
    'application/msword', // .doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.ms-excel', // .xls
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-powerpoint', // .ppt
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    
    // Text
    'text/plain', // .txt
    'text/csv',
    'application/json',
    'application/rtf'
  ];
  
  
  if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
  } else {
      cb(new Error('Invalid file type'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
      fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});


// ✅ Client initializer function
function createClient() {
    client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    });

    client.on('qr', async (qr) => {
        console.log('📱 New QR Code generated');
        qrCodeImage = await qrcode.toDataURL(qr);
        connectionProgress = 0; // QR shown, progress reset
    });
    
    client.on('authenticated', () => {
        console.log('🔐 Authenticated!');
        connectionProgress = 50; // Halfway done
    });
    
    client.on('ready', async () => {
        console.log('✅ WhatsApp is ready!');
        allChats = await client.getChats();
        connectionProgress = 100; // Fully connected
        isReady = true;
    });
    

    client.on('message', (message) => {
        // console.log('Received message:', message);
    
        // If the message's sender is not already in the `messages` object, create a new array for them
        if (!messages[message.from]) {
            messages[message.from] = [];
        }
    
        // Push the new message into the array for the sender (contact ID)
        messages[message.from].push({
            message: message.body,  // Message content
            from: message.from,     // Sender's contact ID
            time: message.timestamp // Timestamp of when the message was received
        });
    
        // console.log(`Message from ${message.from}: ${message.body}`);
    });
    
    
    
    

    client.on('disconnected', (reason) => {
        console.log("⚠️ Client disconnected:", reason);
        isReady = false;
    });

    client.initialize();
}

// 🔁 First time initialize
createClient();

// =================== API Routes ===================

app.get('/qr', (req, res) => {
    if (qrCodeImage) {
        res.send(`<img src="${qrCodeImage}" alt="QR Code" />`);
    } else {
        res.send("QR Code not ready");
    }
});

//Laravel according backend

// app.get('/qr', (req, res) => {
//   if (qrCodeImage) {
//       res.json({ qrr: qrCodeImage }); // send JSON instead of HTML
//   } else {
//       res.status(404).json({ error: "QR Code not ready" });
//   }
// });

app.get('/progress', (req, res) => {
    res.json({ progress: connectionProgress });
});


// app.get('/contacts', async (req, res) => {
//     try {
//         const chats = await client.getChats();
//         const formatted = chats
//             .filter(chat => chat.name || chat.formattedTitle)
//             .map(chat => ({
//                 id: chat.id._serialized,
//                 name: chat.name || chat.formattedTitle
//             }));
//         res.json(formatted);
//     } catch (err) {
//         console.error("❌ Error getting contacts:", err);
//         res.status(500).json({ error: "Failed to load contacts" });
//     }
// });

app.get('/contacts', async (req, res) => {
  try {
    const chats = await client.getChats();
    console.log("Chats fetched");

    const promises = chats
      .filter(chat => chat.name || chat.formattedTitle)
      .map(async (chat) => {
        try {
          const profilePic = await Promise.race([
            client.getProfilePicUrl(chat.id._serialized),
            new Promise((_, reject) => setTimeout(() => reject('Timeout'), 5000))  // 5 seconds timeout
          ]);
          return {
            id: chat.id._serialized,
            name: chat.name || chat.formattedTitle,
            number: chat.id._serialized.split('@')[0],
            profilePic: profilePic || null
          };
        } catch (err) {
          console.error(`Error fetching profile pic for: ${chat.id._serialized}`, err);
          return {
            id: chat.id._serialized,
            name: chat.name || chat.formattedTitle,
            number: chat.id._serialized.split('@')[0],
            profilePic: null
          };
        }
      });

    const results = await Promise.allSettled(promises);
    console.log("Results:", results.length);

    const formatted = results
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value);

    res.json(formatted);
  } catch (err) {
    console.error("❌ Error getting contacts:", err);
    res.status(500).json({ error: "Failed to load contacts" });
  }
});






// app.get('/contacts', async (req, res) => {
//     try {
//         const chats = await client.getChats();
//         const formatted = chats
//             .filter(chat => chat.name || chat.formattedTitle)
//             .map(chat => ({
//                 id: chat.id._serialized,
//                 name: chat.name || chat.formattedTitle,
//                 number: chat.id._serialized.split('@')[0] // Extract number from ID
//             }));
//         res.json(formatted);
//     } catch (err) {
//         console.error("❌ Error getting contacts:", err);
//         res.status(500).json({ error: "Failed to load contacts" });
//     }
// });


app.post('/logout', async (req, res) => {
    try {
        if (client) {
            await client.logout();
            await client.destroy();
            qrCodeImage = null;
            isReady = false;
            console.log('👋 Logged out successfully!');

            // ✅ Immediately re-create the client to regenerate QR
            createClient();

            res.sendStatus(200);
        } else {
            res.status(400).send('Client not initialized.');
        }
    } catch (err) {
        console.error('Logout error:', err);
        res.status(500).send('Logout failed.');
    }
});

app.get('/status', (req, res) => {
    res.json({ ready: isReady });
});

// app.post('/send', async (req, res) => {
//     const { id, message } = req.body;
//     try {
//         await client.sendMessage(id, message);
//         res.json({ status: 'Message sent' });
//     } catch (e) {
//         console.error("❌ Send failed:", e);
//         res.status(500).json({ error: 'Failed to send message' });
//     }
// });

app.post('/send', upload.single('file'), async (req, res) => {
  const { id, message } = req.body;
  console.log(req.body)
  const file = req.file;

  try {
    if (file) {
      // Get proper MIME type and original filename
      const media = MessageMedia.fromFilePath(file.path, {
        mimeType: file.mimetype,
        filename: file.originalname || file.filename
      });
      
      // Send with caption if message exists
      await client.sendMessage(id, media, { 
        caption: message || '',
        sendMediaAsDocument: false // Send as proper media type
      });
      
      // Clean up the uploaded file
      fs.unlinkSync(file.path);
    } else {
      await client.sendMessage(id, message);
    }

    res.json({ 
      success: true,
      fileUrl: file ? `/uploads/${file.filename}` : null,
      fileType: file ? file.mimetype : null,
      fileName: file ? file.originalname : null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send' });
  }
});
 
// Route to fetch received messages for a contact
app.get('/messages/:id', async (req, res) => {
  try {
      const chatId = req.params.id;
      const chat = await client.getChatById(chatId);
      
      if (!chat) {
          return res.status(404).json({ error: "Chat not found" });
      }

      const messages = await chat.fetchMessages({ limit: 100 });
      
      const formattedMessages = messages.map(message => {
          const baseMessage = {
              id: message.id._serialized,
              body: message.body,
              from: message.from,
              time: message.timestamp,
          };
          
          // Add media information if available
          if (message.hasMedia) {
              return {
                  ...baseMessage,
                  fileUrl: message.mediaKey, // You'll need to implement proper URL
                  fileType: message.type,
                  fileName: message.filename || `file_${message.timestamp}`
              };
          }
          
          return baseMessage;
      });

      res.json({ messages: formattedMessages });
  } catch (err) {
      console.error("Error getting messages:", err);
      res.status(500).json({ error: "Failed to load messages" });
  }
});

const sendMessage = async () => {
  if ((!message && !file) || !contact) return;

  const formData = new FormData();
  formData.append('id', contact.id);
  if (message) formData.append('message', message);
  if (file) formData.append('file', file);

  try {
    const res = await axios.post('http://localhost:5000/send', formData, {
      headers: { 
        'Content-Type': 'multipart/form-data',
        'Accept': 'application/json'
      }
    });

    setStatus('✅ Message sent');
    setMessage('');
    setFile(null);
    setPreview(null);
    
    // Refresh messages
    const response = await axios.get(`http://localhost:5000/messages/${contact.id}`);
    setChatHistory(response.data.messages);
    
  } catch (err) {
    console.error(err);
    setStatus('❌ Failed to send message');
  }
};
  


  
  

// app.post('/add-contact', async (req, res) => {
//     const { number } = req.body;

//     if (!number) {
//         return res.status(400).json({ error: 'Contact number is required' });
//     }

//     try {
//         // Check if the number is already in contacts
//         const chatExists = allChats.some(chat => chat.id._serialized.includes(number));

//         if (chatExists) {
//             return res.status(400).json({ error: 'Contact already saved in WhatsApp' });
//         }

//         // This will open the chat and send a message to the contact
//         await client.sendMessage(`${number}@c.us`, 'Hello! This is a test message.');

//         // Return the new contact id and name for the frontend to use
//         res.json({ id: `${number}@c.us`, name: number });
//     } catch (err) {
//         console.error('❌ Error adding new contact:', err);
//         res.status(500).json({ error: 'Failed to add new contact' });
//     }
// });

// app.post('/add-contact', async (req, res) => {
//     const { number } = req.body;

//     if (!number) {
//         return res.status(400).json({ error: 'Contact number is required' });
//     }

//     try {
//         const cleanNumber = number.replace(/[^0-9]/g, ''); // Sanitize number input
//         const fullNumber = `${cleanNumber}@c.us`;

//         // Check if the contact already exists
//         const exists = allChats.some(chat => chat.id._serialized === fullNumber);
//         if (exists) {
//             return res.status(400).json({ error: 'Contact already exists' });
//         }

//         // Send initial message to create chat
//         await client.sendMessage(fullNumber, 'Hello! This is a test message from our WhatsApp integration.');

//         // Wait briefly and fetch updated chats
//         setTimeout(async () => {
//             allChats = await client.getChats();
//         }, 2000);

//         res.json({ success: true, id: fullNumber, name: cleanNumber });
//     } catch (err) {
//         console.error('❌ Error adding new contact:', err);
//         res.status(500).json({ error: 'Failed to add new contact' });
//     }
// });

app.post('/send-emoji', async (req, res) => {
  const { number, emoji } = req.body;

  try {
    const chatId = number + "@c.us"; // WhatsApp format
    await client.sendMessage(chatId, emoji);
    res.json({ status: 'Emoji sent successfully' });
  } catch (err) {
    console.error('Failed to send emoji:', err);
    res.status(500).json({ error: 'Failed to send emoji' });
  }
});



app.post('/add-contact', async (req, res) => {
    const { number } = req.body;
  
    if (!number) {
      return res.status(400).json({ error: 'Contact number is required' });
    }
  
    try {
      const cleanNumber = number.replace(/\D/g, ''); // "919306487939"
      const chatId = `${cleanNumber}@c.us`;
      const message = 'Hello! This is a test message.';
  
      await client.sendMessage(chatId, message);
  
      res.json({ id: chatId, name: cleanNumber });
    } catch (err) {
      console.error('❌ Error adding new contact:', err);
      res.status(500).json({ error: 'Failed to add new contact' });
    }
  });
  

  app.post('/send-bulk', async (req, res) => {
    const { contacts, message } = req.body;
    const template = 'Hello! This is a test message.';
  
    if (!contacts || !message) {
      return res.status(400).json({ error: 'Contacts and message are required' });
    }
  
    try {
      for (const number of contacts) {
        const formattedNumber = number.includes('@c.us') ? number : `${number.replace(/\D/g, '')}@c.us`;
        await client.sendMessage(formattedNumber, message, template);
      }
  
      res.json({ status: 'Bulk message sent successfully' });
    } catch (err) {
      console.error('❌ Bulk message sending failed:', err);
      res.status(500).json({ error: 'Failed to send bulk messages' });
    }
  });
  
  
  

  app.get('/me', (req, res) => {
    try {
      const me = client.info?.wid;
      const name = client.info?.pushname || "User";
      res.json({
        id: me,
        pushname: name
      });
    } catch (err) {
      console.error('GET /me failed:', err);
      res.status(500).json({ error: 'Failed to fetch profile' });
    }
  });

  app.get('/profile-pic/:id', async (req, res) => {
    try {
      const id = req.params.id;
      const profilePicUrl = await client.getProfilePicUrl(id);
      res.json(profilePicUrl); // Return image URL in JSON response
    } catch (error) {
      console.log('Error fetching profile pic:', error);
      res.status(404).send('No Profile Pic Found');
    }
  });
  
  
// Add this to your server.js
// app.get('/check-online/:id', async (req, res) => {
//   try {
//     const id = req.params.id;
//     const contact = await client.getContactById(id);
//     const isOnline = await contact.isOnline();
//     res.json({ isOnline });
//   } catch (err) {
//     console.error('Error checking online status:', err);
//     res.status(500).json({ error: 'Failed to check online status' });
//   }
// });

app.get('/manoj', (req, res)=>{
  res.send("hello manoj sir kese ho")
})
  


app.listen(5000, () => {
    console.log('🚀 Server running on http://localhost:5000');
});
