const express = require('express');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const { Server } = require('socket.io');
const http = require('http');
const app = express();
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const events = require('events');
const jwt = require('jsonwebtoken');
const authDir = path.join(__dirname, '.wwebjs_auth');
const server = http.createServer(app);
events.defaultMaxListeners = 50;
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log('🟢 New socket connected:', socket.id);

  socket.on("register-number", ({ mobileNumber }) => {
    const normalized = mobileNumber.startsWith("91") ? mobileNumber : "91" + mobileNumber;
    socketIdMap[normalized] = socket.id;
    console.log(`📲 Registered socket for ${normalized}`);
  });


  socket.on('disconnect', () => {
    for (const [key, value] of Object.entries(socketIdMap)) {
      if (value === socket.id) {
        delete socketIdMap[key];
        break;
      }
    }
  });
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let client;
let qrScanTimeout;
const isQrTimerRunning = {};
const socketIdMap = {};
const clientCreatedAt = {};
let serverLogs = [];

function logServerError(message) {
  serverLogs.push({
    time: new Date().toLocaleString(),
    message,
  });


  if (serverLogs.length > 100) serverLogs.shift();
}


process.on('uncaughtException', (err) => {
  logServerError(`Uncaught Exception: ${err.message}`);
});

process.on('unhandledRejection', (reason, promise) => {
  logServerError(`Unhandled Rejection: ${reason}`);
});

const progressStatus = {};
const clients = {};
const qrCodes = {};
const readyStatus = {};
const clientsNumbers = {};

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    // Images
    'image/jpeg', 'image/png', 'image/gif', 'image/avif', 'image/webp', 'image/bmp',
    'image/svg+xml', 'image/tiff', 'image/x-icon',

    // Videos
    'video/mp4', 'video/webm', 'video/ogg', 'video/x-msvideo',
    'video/x-matroska', 'video/quicktime',

    // Audios
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4',
    'audio/aac', 'audio/webm', 'audio/x-ms-wma',

    // PDFs & Documents
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',

    // Text files
    'text/plain', 'text/csv', 'application/json', 'application/rtf',
    'text/html', 'text/xml', 'text/javascript', 'application/xml',

    // Archives
    'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
    'application/x-tar', 'application/gzip',

    // Code files
    'application/javascript', 'application/x-javascript',
    'application/x-python-code', 'text/x-python',
    'text/x-c', 'text/x-c++', 'text/x-java-source',
    'application/x-httpd-php', 'text/x-php', // ✅ PHP file types

    // Fonts
    'font/woff', 'font/woff2', 'application/font-woff',
    'application/vnd.ms-fontobject', 'font/otf', 'font/ttf'
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
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Client creation function, takes mobileNumber and returns WhatsApp client instance
// const createClient = (mobileNumber) => {
//   const client = new Client({
//     authStrategy: new LocalAuth({ clientId: mobileNumber }),
//     puppeteer: {
//       headless: true,
//       args: ['--no-sandbox', '--disable-setuid-sandbox']
//     }
//   });

//   // client.on('qr', async (qr) => {
//   //   console.log(`📱 [${mobileNumber}] QR Generated`);
//   //   const qrImage = await qrcode.toDataURL(qr);
//   //   qrCodes[mobileNumber] = qrImage;
//   //   readyStatus[mobileNumber] = false;
//   //   progressStatus[mobileNumber] = 'QR Code Generated - Awaiting Scan';
//   // });


//   client.on('qr', async (qr) => {
//     console.log(`📱 [${mobileNumber}] QR Generated`);

//     const qrImage = await qrcode.toDataURL(qr);
//     qrCodes[mobileNumber] = qrImage;
//     readyStatus[mobileNumber] = false;
//     progressStatus[mobileNumber] = 'QR Code Generated - Awaiting Scan';

//     if (!isQrTimerRunning[mobileNumber]) {
//       isQrTimerRunning[mobileNumber] = true;

//       qrScanTimeout = setTimeout(() => {
//         console.log(`⌛ QR not scanned in time for ${mobileNumber}. Closing client.`);
//         client.destroy();
//         progressStatus[mobileNumber] = '❌ QR expired. Please retry.';
//         isQrTimerRunning[mobileNumber] = false;
//       }, 2 * 60 * 1000); // 2 minutes
//     }
//   });


//   client.on('authenticated', () => {
//     console.log(`🔐 [${mobileNumber}] Authenticated`);
//     progressStatus[mobileNumber] = 'Authenticated - Loading...';
//   });

//   client.on('message', async (message) => {
//     const from = message.from;
//     const to = message.to; // or client.info.wid.user
//     const body = message.body;

//     // You can emit socket event
//     const socketId = socketIdMap[to];
//     if (socketId) {
//       io.to(socketId).emit('new-message', { from, body });
//     }
//   });


//   client.on('ready', () => {
//     clearTimeout(qrScanTimeout); // Clear timeout once scanned
//      isQrTimerRunning = false;

//     console.log(`✅ [${mobileNumber}] WhatsApp Ready`);

//     clients[mobileNumber] = client;
//     readyStatus[mobileNumber] = true;
//     progressStatus[mobileNumber] = '100% - Ready';

//     const actualNumber = client.info?.wid?.user;

//     if (actualNumber) {
//       console.log("Client ready with number:", actualNumber);

//       // Ensure socketIdMap keys are normalized with country code
//       // Here normalize mobileNumber to full format with country code
//       const normalizedMobile = mobileNumber.startsWith('91') ? mobileNumber : '91' + mobileNumber;

//       const socketId = socketIdMap[normalizedMobile];
//       if (socketId) {
//         io.to(socketId).emit('whatsapp-ready', { actualNumber });
//       } else {
//         console.log(`❌ No socket registered for ${normalizedMobile}`);
//       }

//       clientsNumbers[mobileNumber] = actualNumber;
//     } else {
//       console.log("❌ client not ready or info missing");
//     }
//   });



//  client.on('disconnected', async (reason) => {
//   console.log(`📴 [${mobileNumber}] Client disconnected:`, reason);

//   try {
//     // Agar client abhi bhi exist karta hai to safely destroy karo
//     if (clients[mobileNumber]) {
//       await clients[mobileNumber].destroy();
//       console.log(`🧹 Client destroyed for ${mobileNumber}`);
//     }
//   } catch (err) {
//     console.error(`❌ Error destroying client for ${mobileNumber}:`, err.message);
//   }

//   // Memory cleanup
//   delete clients[mobileNumber];
//   delete qrCodes[mobileNumber];
//   delete progressStatus[mobileNumber];
//   delete clientsNumbers[mobileNumber];
//   delete isQrTimerRunning[mobileNumber];
//   readyStatus[mobileNumber] = false;  // Abhi false set karo, delete mat karo

//   // Session folder delete mat karo yahan; alag route ya process se cleanup kar lena

//   console.log(`ℹ️ Logout completed for mobile: ${mobileNumber}`);
// });

//   client.initialize();
//   return client;
// };


const createClient = (mobileNumber) => {
  const client = new Client({
    authStrategy: new LocalAuth({ clientId: mobileNumber }),
    puppeteer: {
      headless: true, // 🔍 Turn this to true in production
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  // DEBUG: Listen to all events
  const events = ['qr', 'authenticated', 'ready', 'message', 'disconnected'];

  events.forEach((eventName) => {
    client.on(eventName, (...args) => {
      console.log(`📡 [${mobileNumber}] EVENT: ${eventName}`, args);
    });
  });


  // Track loading progress
  client.on('loading_screen', (percent, message) => {
    console.log(`⏳ [${mobileNumber}] Loading ${percent}% - ${message}`);
  });

  client.on('change_state', (state) => {
    console.log(`🔁 [${mobileNumber}] State changed to:`, state);
  });

  client.on('qr', async (qr) => {
    console.log(`📱 [${mobileNumber}] QR Generated`);

    const qrImage = await qrcode.toDataURL(qr);
    qrCodes[mobileNumber] = qrImage;
    readyStatus[mobileNumber] = false;
    progressStatus[mobileNumber] = 'QR Code Generated - Awaiting Scan';

    if (!isQrTimerRunning[mobileNumber]) {
      isQrTimerRunning[mobileNumber] = true;

      qrScanTimeout = setTimeout(() => {
        console.log(`⌛ QR not scanned in time for ${mobileNumber}. Closing client.`);
        client.destroy();
        progressStatus[mobileNumber] = '❌ QR expired. Please retry.';
        isQrTimerRunning[mobileNumber] = false;
      }, 2 * 60 * 1000); // 2 minutes
    }
  });

  client.on('authenticated', () => {
    console.log(`🔐 [${mobileNumber}] Authenticated`);
    progressStatus[mobileNumber] = 'Authenticated - Loading...';
  });

  client.on('ready', () => {
    clearTimeout(qrScanTimeout);
    isQrTimerRunning[mobileNumber] = false;

    console.log(`✅ [${mobileNumber}] WhatsApp Ready`);

    clients[mobileNumber] = client;
    readyStatus[mobileNumber] = true;
    progressStatus[mobileNumber] = '100% - Ready';

    const actualNumber = client.info?.wid?.user;
    const normalizedMobile = mobileNumber.startsWith('91') ? mobileNumber : '91' + mobileNumber;

    if (actualNumber) {
      console.log(`📞 Client ready with number: ${actualNumber}`);

      const socketId = socketIdMap[normalizedMobile];
      if (socketId) {
        io.to(socketId).emit('whatsapp-ready', { actualNumber });
      } else {
        console.log(`❌ No socket registered for ${normalizedMobile}`);
      }

      clientsNumbers[mobileNumber] = actualNumber;
    } else {
      console.log("❌ client not ready or info missing");
    }
  });

  client.on('message', async (message) => {
    const from = message.from;
    const to = message.to;
    const body = message.body;

    const socketId = socketIdMap[to];
    if (socketId) {
      io.to(socketId).emit('new-message', { from, body });
    }
  });

  client.on('disconnected', async (reason) => {
    console.log(`📴 [${mobileNumber}] Client disconnected:`, reason);

    try {
      if (clients[mobileNumber]) {
        await clients[mobileNumber].destroy();
        console.log(`🧹 Client destroyed for ${mobileNumber}`);
      }
    } catch (err) {
      console.error(`❌ Error destroying client for ${mobileNumber}:`, err.message);
    }

    delete clients[mobileNumber];
    delete qrCodes[mobileNumber];
    delete progressStatus[mobileNumber];
    delete clientsNumbers[mobileNumber];
    delete isQrTimerRunning[mobileNumber];
    readyStatus[mobileNumber] = false;

    console.log(`ℹ️ Logout completed for mobile: ${mobileNumber}`);
  });

  // Catch unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error(`⚠️ Unhandled Rejection:`, reason);
  });
  clientCreatedAt[mobileNumber] = new Date();
  client.initialize();

  // ⏱️ Force timeout log if ready not triggered within 20s
  setTimeout(() => {
    if (!readyStatus[mobileNumber]) {
      console.warn(`⚠️ [${mobileNumber}] Still not ready after 20s.`);
    }
  }, 20000);

  return client;
};

// JWT middleware
const verifyJWT = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token missing' });

  try {
    const decoded = jwt.verify(token, 'your-secret-key'); // 🔐 Replace with your real secret
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};


app.post('/restart-server', verifyJWT, (req, res) => {
  res.status(200).json({ message: '♻️ Server restarting...' });

  // Graceful shutdown
  console.log('🔁 Restart command received via API...');

  // Delay exit to allow response to be sent
  setTimeout(() => {
    process.exit(0); // exit code 0 means clean exit
  }, 1000);
});


function deleteAllSessions() {
  console.log('⏰ Starting session cleanup...');

  if (!fs.existsSync(authDir)) {
    console.log(`⚠️ Directory not found: ${authDir}`);
    return;
  }

  const files = fs.readdirSync(authDir);
  console.log(`🔍 Found total ${files.length} items inside .wwebjs_auth`);

  const sessionFolders = files.filter(file => file.startsWith('session-'));
  console.log(`📁 Found ${sessionFolders.length} session folders to delete`);

  if (sessionFolders.length === 0) {
    console.log('✅ No session folders to delete.');
    return;
  }

  sessionFolders.forEach((folder, index) => {
    const folderPath = path.join(authDir, folder);
    try {
      fs.rmSync(folderPath, { recursive: true, force: true });
      console.log(`🧹 [${index + 1}/${sessionFolders.length}] Deleted session folder: ${folderPath}`);
    } catch (err) {
      console.error(`❌ [${index + 1}/${sessionFolders.length}] Failed to delete session folder ${folderPath}: ${err.message}`);
    }
  });

  console.log('✅ Session cleanup completed.\n');
}

// Run first time immediately
deleteAllSessions();

// Run every 5 minutes (300000 ms)
setInterval(() => {
  deleteAllSessions();
}, 300000); Number

// Route to initialize client for a given mobileNumber

app.get('/init/:mobileNumber', (req, res) => {
  const mobileNumber = req.params.mobileNumber;

  // ✅ Flexible token format check
  const tokenRegex = /^wa_token_[a-zA-Z0-9]+_[a-zA-Z0-9]+$/;
  if (!tokenRegex.test(mobileNumber)) {
    return res.status(400).send('❌ Invalid token format');
  }

  if (clients[mobileNumber] && readyStatus[mobileNumber]) {
    return res.status(200).send('✅ Client already logged in and ready');
  }

  if (!clients[mobileNumber]) {
    const client = createClient(mobileNumber);
    clients[mobileNumber] = client;
    readyStatus[mobileNumber] = false;
    console.log("✅ Client created and stored for:", mobileNumber);
  }

  res.status(200).send('✅ Client initializing... QR Code Successfully Generated');
});


// app.get('/init/:mobileNumber', (req, res) => {
//   const mobileNumber = req.params.mobileNumber;

//   if (clients[mobileNumber] && readyStatus[mobileNumber]) {
//     return res.status(200).send('Client already logged in and ready');
//   }

//   if (!clients[mobileNumber]) {
//     const client = createClient(mobileNumber);
//     clients[mobileNumber] = client;
//     readyStatus[mobileNumber] = false;
//     console.log("Client created and stored for:", mobileNumber);
//   }

//   res.status(200).send('Client initializing... Qr Code Successfully Genrate');
// });

// Route to get QR code for a given mobileNumber
app.get('/qr/:mobileNumber', (req, res) => {
  const mobileNumber = req.params.mobileNumber;
  const qrImage = qrCodes[mobileNumber];

  if (qrImage) {
    // qrImage is a Data URL like "data:image/png;base64,...."
    // Tum front-end me <img src={qrImage} /> se dikha sakte ho
    res.json({ qr: qrImage });
  } else {
    res.status(404).send('QR code not found. Please initialize client first.');
  }
});
// Route to logout client for given mobileNumber


app.post('/logout/:mobileNumber', async (req, res) => {
  const mobileNumber = req.params.mobileNumber;

  const client = clients[mobileNumber];

  if (!client) {
    return res.status(404).send('Client not found');
  }

  try {
    // Destroy the WhatsApp client instance
    await client.destroy();

    // Delete in-memory references
    delete clients[mobileNumber];
    delete qrCodes[mobileNumber];
    delete readyStatus[mobileNumber];
    delete progressStatus[mobileNumber];
    delete clientsNumbers[mobileNumber];


    // ✅ Correct session folder path
    const sessionPath = path.join(__dirname, '.wwebjs_auth', `session-${mobileNumber}`);

    console.log('Looking for session path:', sessionPath);

    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      console.log(`🧹 Session folder deleted: ${sessionPath}`);
    } else {
      console.log(`⚠️ Session folder not found: ${sessionPath}`);
    }

    return res.status(200).send('Logged out successfully and session data deleted');
  } catch (error) {
    console.error(`❌ Logout error for ${mobileNumber}:`, error);
    return res.status(500).send('Failed to log out and clear session');
  }
});




app.get('/progress/:mobileNumber', (req, res) => {
  const mobileNumber = req.params.mobileNumber;

  if (progressStatus[mobileNumber]) {
    return res.json({ progress: progressStatus[mobileNumber] });
  } else {
    return res.status(404).send('No progress found for this number');
  }
});

app.get('/status/:mobileNumber', (req, res) => {
  const mobile = req.params.mobileNumber;

  // readyStatus object mein se ready flag le lo
  const isReady = readyStatus[mobile] || false;

  res.json({ ready: isReady });
});




//Laravel according backend

// app.get('/qr', (req, res) => {
//   if (qrCodeImage) {
//       res.json({ qrr: qrCodeImage }); // send JSON instead of HTML
//   } else {
//       res.status(404).json({ error: "QR Code not ready" });
//   }
// });


app.get('/contacts/:mobileNumber', async (req, res) => {
  const mobileNumber = req.params.mobileNumber;
  const client = clients[mobileNumber];

  if (!client) {
    return res.status(404).json({ error: 'Client not found' });
  }

  if (!readyStatus[mobileNumber]) {
    return res.status(400).json({ error: 'Client not ready' });
  }

  try {
    const chats = await client.getChats();
    res.json(chats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.post('/logout/:mobileNumber', async (req, res) => {
  const mobileNumber = req.params.mobileNumber;

  const client = clients[mobileNumber];

  if (!client) {
    return res.status(404).send('Client not found');
  }

  try {
    await client.destroy();

    delete clients[mobileNumber];
    delete qrCodes[mobileNumber];
    delete readyStatus[mobileNumber];
    delete progressStatus[mobileNumber];

    // Optional safety check
    if (typeof clientsNumbers !== 'undefined') {
      delete clientsNumbers[mobileNumber];
    }

    // Correct session path
    const sessionPath = path.join(__dirname, '.wwebjs_auth', `session-${mobileNumber}`);

    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      console.log(`🧹 Session folder deleted: ${sessionPath}`);
    } else {
      console.log(`⚠️ Session folder not found: ${sessionPath}`);
    }

    return res.status(200).send('Logged out successfully and session data deleted');
  } catch (error) {
    console.error(`❌ Logout error for ${mobileNumber}:`, error);
    return res.status(500).send('Failed to log out and clear session');
  }
});


app.post('/send/:mobileNumber', upload.single('file'), async (req, res) => {
  const mobileNumber = req.params.mobileNumber;
  const { id, message } = req.body;
  const file = req.file;

  const client = clients[mobileNumber];

  if (!client) {
    return res.status(404).json({ error: 'Client not found for this mobile number' });
  }

  if (!readyStatus[mobileNumber]) {
    return res.status(400).json({ error: 'Client not ready' });
  }

  try {
    if (file) {
      const media = MessageMedia.fromFilePath(file.path, {
        mimeType: file.mimetype,
        filename: file.originalname || file.filename
      });

      await client.sendMessage(id, media, {
        caption: message || '',
        sendMediaAsDocument: false
      });

      fs.unlinkSync(file.path); // Cleanup uploaded file
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
    console.error('Send failed:', err);
    res.status(500).json({ error: 'Failed to send' });
  }
});


// app.post('/send', upload.single('file'), async (req, res) => {
//   const { id, message } = req.body;
//   console.log(req.body)
//   const file = req.file;

//   try {
//     if (file) {
//       // Get proper MIME type and original filename
//       const media = MessageMedia.fromFilePath(file.path, {
//         mimeType: file.mimetype,
//         filename: file.originalname || file.filename
//       });

//       // Send with caption if message exists
//       await client.sendMessage(id, media, { 
//         caption: message || '',
//         sendMediaAsDocument: false // Send as proper media type
//       });

//       // Clean up the uploaded file
//       fs.unlinkSync(file.path);
//     } else {
//       await client.sendMessage(id, message);
//     }

//     res.json({ 
//       success: true,
//       fileUrl: file ? `/uploads/${file.filename}` : null,
//       fileType: file ? file.mimetype : null,
//       fileName: file ? file.originalname : null
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to send' });
//   }
// });

// Route to fetch received messages for a contact
app.get('/messages/:mobileNumber/:id', async (req, res) => {
  const { mobileNumber, id } = req.params;
  const client = clients[mobileNumber];

  if (!client) {
    return res.status(404).json({ error: 'Client not found for this mobile number' });
  }

  if (!readyStatus[mobileNumber]) {
    return res.status(400).json({ error: 'Client not ready yet' });
  }

  try {
    const chat = await client.getChatById(id);

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

      if (message.hasMedia) {
        return {
          ...baseMessage,
          fileUrl: message.mediaKey, // Replace with actual media fetch logic
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


// Add contact for a specific mobileNumber client
app.post('/add-contact/:mobileNumber', async (req, res) => {
  const { mobileNumber } = req.params;  // Mobile number from URL
  const { number } = req.body;           // Contact number to add from body

  if (!number) {
    return res.status(400).json({ error: 'Contact number is required' });
  }

  const client = clients[mobileNumber];
  if (!client) {
    return res.status(404).json({ error: 'Client not found' });
  }

  try {
    const cleanNumber = number.replace(/\D/g, '');
    const chatId = `${cleanNumber}@c.us`;
    const message = 'Hello! This is a test message.';

    await client.sendMessage(chatId, message);

    res.json({ id: chatId, name: cleanNumber });
  } catch (err) {
    console.error('❌ Error adding new contact:', err);
    if (err.message.includes("Session closed")) {
      return res.status(410).json({ error: 'Session closed, please rescan QR code.' });
    }
    res.status(500).json({ error: 'Failed to add new contact' });
  }
});



app.post('/send_single_msg/:mobileNumber', async (req, res) => {
  console.log('Api Hit :: send_single_msg');
  const { mobileNumber } = req.params;  // Mobile number from URL
  const { number, message } = req.body;           // Contact number to add from body
  if (!number) {
    return res.status(400).json({ error: 'Contact number is required' });
  }

  const client = clients[mobileNumber];
  if (!client) {
    return res.status(404).json({ error: 'Client not found. AuthNumber=' + mobileNumber });
  }
  console.log(JSON.stringify(req.body));

  try {
    const cleanNumber = number.replace(/\D/g, '');
    const chatId = `${cleanNumber}@c.us`;
    const msg = message ?? 'Hello! This is a test message.';

    await client.sendMessage(chatId, msg);

    res.json({ id: chatId, name: cleanNumber });
  } catch (err) {
    console.error('❌ Error adding new contact:', err);
    if (err.message.includes("Session closed")) {
      return res.status(410).json({ error: 'Session closed, please rescan QR code.' });
    }
    res.status(500).json({ error: 'Failed to add new contact' });
  }
});


app.post('/send-bulk/:mobileNumber', upload.single('file'), async (req, res) => {
  let { contacts, message } = req.body;
  const mobileNumber = req.params.mobileNumber;
  const file = req.file;

  if (!contacts || !message) {
    return res.status(400).json({ error: 'Contacts and message are required' });
  }

  // Ensure contacts is always an array
  if (typeof contacts === 'string') {
    try {
      contacts = JSON.parse(contacts);
    } catch {
      contacts = [contacts];
    }
  }

  const client = clients[mobileNumber];
  if (!client) {
    return res.status(404).json({ error: 'Client not found for given mobile number' });
  }

  try {
    let media = null;

    // ✅ Use fromFilePath for disk storage (what multer is using by default)
    if (file) {
      media = MessageMedia.fromFilePath(file.path);
    }

    for (const number of contacts) {
      const formattedNumber = number.includes('@c.us')
        ? number
        : `${number.replace(/\D/g, '')}@c.us`;

      if (media) {
        await client.sendMessage(formattedNumber, media, { caption: message });
      } else {
        await client.sendMessage(formattedNumber, message);
      }
    }

    res.json({
      status: 'Bulk message sent successfully',
      fileName: file?.originalname || null,
      fileType: file?.mimetype || null,
    });

  } catch (err) {
    console.error('❌ Bulk message sending failed:', err);
    res.status(500).json({ error: 'Failed to send bulk messages', details: err.message });
  }
});


// app.post('/send-bulk/:mobileNumber', async (req, res) => {
//   const { contacts, message } = req.body;
//   const mobileNumber = req.params.mobileNumber; // mobile number from URL params

//   if (!contacts || !message) {
//     return res.status(400).json({ error: 'Contacts and message are required' });
//   }

//   const client = clients[mobileNumber];
//   if (!client) {
//     return res.status(404).json({ error: 'Client not found for given mobile number' });
//   }

//   try {
//     for (const number of contacts) {
//       const formattedNumber = number.includes('@c.us') ? number : `${number.replace(/\D/g, '')}@c.us`;
//       await client.sendMessage(formattedNumber, message);
//     }

//     res.json({ status: 'Bulk message sent successfully' });
//   } catch (err) {
//     console.error('❌ Bulk message sending failed:', err);
//     res.status(500).json({ error: 'Failed to send bulk messages' });
//   }
// });

// GET /me?mobileNumber=919xxxxxxxxx
app.get('/me', (req, res) => {
  const mobileNumber = req.query.mobileNumber;
  const client = clients[mobileNumber];

  if (!client || !client.info) {
    console.error(`❌ client for ${mobileNumber} not ready or info missing`);
    return res.status(500).json({ error: "Client not ready" });
  }

  try {
    const me = client.info.wid;          // WhatsApp ID object
    const name = client.info.pushname || "User";
    res.json({ id: me, pushname: name });
  } catch (err) {
    console.error('GET /me failed:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// GET /profile-pic/:id?mobileNumber=919xxxxxxxxx
app.get('/profile-pic/:id', async (req, res) => {
  const mobileNumber = req.query.mobileNumber;
  const client = clients[mobileNumber];
  const id = req.params.id;

  if (!client) {
    return res.status(404).send('Client not found for given mobile number');
  }

  try {
    const profilePicUrl = await client.getProfilePicUrl(id);
    res.json(profilePicUrl);
  } catch (error) {
    console.log('Error fetching profile pic:', error);
    res.status(404).send('No Profile Pic Found');
  }
});




app.get('/manoj', (req, res) => {
  res.status(200).json({
    message: '🚀 Your server is running successfully! Everything is smooth and ready to go. 😊'
  });
});

app.get('/manoj/haryana/status/logs', (req, res) => {
  const password = req.query.password;

  if (password !== 'manojyadavharyana@930') {
    return res.status(401).json({ error: '⛔ Unauthorized. Password required.' });
  }

  const allStatus = Object.keys(progressStatus).map((mobile) => ({
    requestedNumber: mobile,
    whatsappNumber: clientsNumbers[mobile] || null,
    isReady: readyStatus[mobile] || false,
    status: progressStatus[mobile],
    qrAvailable: !!qrCodes[mobile],
    createdAt: clientCreatedAt[mobile]
      ? new Date(clientCreatedAt[mobile]).toLocaleString()
      : 'Not Tracked',
    qrCode: qrCodes[mobile] || null,
  }));

  res.status(200).json({
    message: '📡 WhatsApp Clients Status',
    totalClients: allStatus.length,
    clients: allStatus,
  });
});

app.get('/manoj/haryana/server/health', (req, res) => {
  res.status(200).json({
    message: "🟢 Server is running",
    time: new Date().toLocaleString(),
    uptime: `${Math.round(process.uptime())}s`
  });
});

app.get('/manoj/haryana/server/logs', (req, res) => {
  const password = req.query.password;

  if (password !== 'manojyadavharyana@930') {
    return res.status(401).json({ error: '⛔ Unauthorized. Password required.' });
  }

  res.status(200).json({
    message: '🧾 Server Error Logs',
    totalErrors: serverLogs.length,
    logs: serverLogs,
  });
});

// Route to throw error intentionally for testing
app.get('/test-error', (req, res) => {
  // Uncaught Exception example
  throw new Error("🔥 Testing uncaught exception error");
});

// Or test unhandled promise rejection
app.get('/test-rejection', (req, res) => {
  // Unhandled Rejection example
  Promise.reject("💥 Testing unhandled rejection");
});

app.get('/manoj/haryana/server/logs/clear', (req, res) => {
  const password = req.query.password;
  if (password !== 'manojyadavharyana@930') {
    return res.status(401).json({ error: '⛔ Unauthorized. Password required.' });
  }

  serverLogs = [];
  res.json({ message: '🧹 All server logs cleared successfully.' });
});







app.get('/logout/:mobileNumber', async (req, res) => {
  const mobileNumber = req.params.mobileNumber;

  const client = clients[mobileNumber];

  if (!client) {
    return res.status(404).send('Client not found');
  }

  try {
    await client.destroy();

    delete clients[mobileNumber];
    delete qrCodes[mobileNumber];
    delete readyStatus[mobileNumber];
    delete progressStatus[mobileNumber];
    if (typeof clientsNumbers !== 'undefined') {
      delete clientsNumbers[mobileNumber];
    }

    const sessionPath = path.join(__dirname, '.wwebjs_auth', `session-${mobileNumber}`);
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      console.log(`🧹 Session folder deleted: ${sessionPath} `);
    }

    return res.status(200).send(`Logged out successfully via GET for ${mobileNumber}`);
  } catch (error) {
    console.error(`❌ Logout error for ${mobileNumber}:`, error);
    return res.status(500).send('Failed to log out and clear session');
  }
});



server.listen(5000, () => {
  console.log('🚀 Server running on http://localhost:5000');
});
