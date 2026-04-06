import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import makeWASocket, { 
  useMultiFileAuthState, 
  DisconnectReason, 
  WASocket,
  fetchLatestBaileysVersion
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import pino from "pino";
import fs from "fs";

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer);
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // WhatsApp Logic
  let sock: WASocket | null = null;
  let qrCode: string | null = null;
  let contacts: any[] = [];
  let chats: any[] = [];

  async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();

    if (sock) {
      try {
        sock.ev.removeAllListeners('connection.update');
        sock.ev.removeAllListeners('creds.update');
        sock.ev.removeAllListeners('messaging-history.set');
        sock.ev.removeAllListeners('chats.upsert');
        sock.ev.removeAllListeners('contacts.upsert');
        sock.ev.removeAllListeners('messages.upsert');
      } catch (e) {}
    }

    sock = makeWASocket({
      version,
      printQRInTerminal: false,
      auth: state,
      logger: pino({ level: 'silent' })
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        qrCode = await QRCode.toDataURL(qr);
        io.emit('qr', qrCode);
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        console.log('Connection closed. Status:', statusCode, 'Error:', lastDisconnect?.error?.message);
        
        if (shouldReconnect) {
          // If it's a stream error (515), we might need a slightly longer delay or just a fresh start
          const delay = statusCode === 515 ? 5000 : 3000;
          console.log(`Reconnecting in ${delay}ms...`);
          
          setTimeout(() => {
            connectToWhatsApp();
          }, delay);
        } else {
          console.log('Logged out. Cleaning up...');
          if (fs.existsSync('auth_info_baileys')) {
            fs.rmSync('auth_info_baileys', { recursive: true, force: true });
          }
          qrCode = null;
          io.emit('connection-status', 'close');
          // Restart to allow new login
          setTimeout(() => {
            connectToWhatsApp();
          }, 3000);
        }
      } else if (connection === 'open') {
        console.log('opened connection');
        qrCode = null;
        const userNumber = sock?.user?.id.split(':')[0];
        io.emit('connection-status', 'open');
        io.emit('connected-number', userNumber);
      }
    });

    sock.ev.on('creds.update', saveCreds);

    // Sync Data
    sock.ev.on('messaging-history.set', ({ chats: newChats, contacts: newContacts }) => {
      chats = newChats.map(c => ({
        id: c.id,
        name: c.name,
        unreadCount: c.unreadCount,
        lastMessage: '' // Baileys history set doesn't always include last message text easily
      }));
      contacts = newContacts.map(c => ({
        id: c.id,
        name: c.name || c.verifiedName || c.notify,
        imgUrl: null
      }));
      io.emit('chats', chats);
      io.emit('contacts', contacts);
    });

    sock.ev.on('chats.upsert', (newChats) => {
      newChats.forEach(c => {
        const index = chats.findIndex(chat => chat.id === c.id);
        if (index === -1) chats.push(c);
        else chats[index] = { ...chats[index], ...c };
      });
      io.emit('chats', chats);
    });

    sock.ev.on('contacts.upsert', (newContacts) => {
      newContacts.forEach(c => {
        const index = contacts.findIndex(contact => contact.id === c.id);
        if (index === -1) contacts.push(c);
        else contacts[index] = { ...contacts[index], ...c };
      });
      io.emit('contacts', contacts);
    });

    sock.ev.on('messages.upsert', ({ messages, type }) => {
      if (type === 'notify') {
        messages.forEach(m => {
          if (!m.key.fromMe && m.message) {
            const text = m.message.conversation || m.message.extendedTextMessage?.text || 'Media message';
            io.emit('new-message', {
              id: m.key.id,
              from: m.key.remoteJid,
              text,
              timestamp: m.messageTimestamp
            });
          }
        });
      }
    });
  }

  connectToWhatsApp();

  // Template Logic
  const TEMPLATES_FILE = path.join(process.cwd(), 'templates.json');
  function getTemplates() {
    if (!fs.existsSync(TEMPLATES_FILE)) return [];
    return JSON.parse(fs.readFileSync(TEMPLATES_FILE, 'utf-8'));
  }
  function saveTemplates(templates: any[]) {
    fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(templates, null, 2));
  }

  // API Routes
  app.get("/api/templates", (req, res) => {
    res.json(getTemplates());
  });

  app.post("/api/templates", (req, res) => {
    const templates = getTemplates();
    const newTemplate = { id: Date.now().toString(), ...req.body };
    templates.push(newTemplate);
    saveTemplates(templates);
    res.json(newTemplate);
  });

  app.delete("/api/templates/:id", (req, res) => {
    const templates = getTemplates();
    const filtered = templates.filter((t: any) => t.id !== req.params.id);
    saveTemplates(filtered);
    res.json({ success: true });
  });

  app.post("/api/logout", async (req, res) => {
    try {
      if (sock) {
        await sock.logout();
        sock = null;
      }
      if (fs.existsSync('auth_info_baileys')) {
        fs.rmSync('auth_info_baileys', { recursive: true, force: true });
      }
      qrCode = null;
      io.emit('connection-status', 'close');
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to logout" });
    }
  });

  app.post("/api/send-message", async (req, res) => {
    const { to, message } = req.body;
    if (!sock) return res.status(500).json({ error: "WhatsApp not connected" });

    try {
      // Ensure the number has the country code and correct format
      let formattedNumber = to.replace(/\D/g, ''); // Remove non-digits
      if (formattedNumber.startsWith('0')) {
        formattedNumber = '88' + formattedNumber; // Default to BD if starts with 0
      }
      const jid = `${formattedNumber}@s.whatsapp.net`;
      
      // Check if the number exists on WhatsApp
      const results = await sock.onWhatsApp(jid);
      const result = results?.[0];
      if (!result || !result.exists) {
        return res.status(400).json({ error: "Number is not registered on WhatsApp" });
      }

      await sock.sendMessage(result.jid, { text: message });
      res.json({ success: true });
    } catch (err) {
      console.error('Send message error:', err);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  io.on('connection', (socket) => {
    if (qrCode) socket.emit('qr', qrCode);
    if (sock?.user) {
      socket.emit('connection-status', 'open');
      socket.emit('contacts', contacts);
      socket.emit('chats', chats);
    }

    socket.on('request-pairing-code', async (phoneNumber) => {
      try {
        if (!sock) return;
        const code = await sock.requestPairingCode(phoneNumber);
        socket.emit('pairing-code', code);
      } catch (err) {
        console.error('Pairing code error:', err);
        socket.emit('pairing-code-error', 'Failed to generate pairing code. Make sure the number is correct and not already linked.');
      }
    });
  });
}

startServer();
