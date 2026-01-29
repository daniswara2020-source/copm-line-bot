const express = require("express");
const line = require("@line/bot-sdk");
const { google } = require("googleapis");

const app = express();

/* ===================== CONFIG ===================== */
const LINE_CONFIG = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_RANGE = "'Form Responses 1'!A1:Z1000";

/* ===== COMMAND CONFIG ===== */
const CMD_HELP = "!HELP";
const CMD_ORDER = "!ORDER";

const ORDER_ID_REGEX = /^![A-Z]+[0-9]+$/;        // !BDMP1
const ORDER_DEPT_REGEX = /^!ORDER\s+[A-Z]+$/;   // !ORDER BDMP

/* ===================== LINE CLIENT ===================== */
const client = new line.Client(LINE_CONFIG);

/* ===================== WEBHOOK ===================== */
app.post(
  "/webhook",
  line.middleware(LINE_CONFIG),
  async (req, res) => {
    try {
      const event = req.body.events?.[0];
      if (!event || event.type !== "message" || event.message.type !== "text") {
        return res.sendStatus(200);
      }

      const text = event.message.text.trim().toUpperCase();
      let message = null;

      /* ========= !HELP ========= */
      if (text === CMD_HELP) {
        message = getHelpMessage();
      }

      /* ========= !ORDER (tanpa departemen) ========= */
      else if (text === CMD_ORDER) {
        message = "Gunakan format:\n!order <DEPARTEMEN>\nContoh: !order BDMP";
      }

      /* ========= !ORDER BDMP ========= */
      else if (ORDER_DEPT_REGEX.test(text)) {
        const dept = text.split(" ")[1];
        message = await getOrdersByDepartment(dept);
      }

      /* ========= !BDMP1 ========= */
      else if (ORDER_ID_REGEX.test(text)) {
        const orderId = text.substring(1); // buang !
        const order = await getOrderById(orderId);
        if (order) message = formatDetail(order);
      }

      /* ========= BOT DIAM ========= */
      else {
        return res.sendStatus(200);
      }

      if (!message) {
        await client.replyMessage(event.replyToken, {
          type: "text",
          text: "Data pesanan tidak ditemukan."
        });
        return res.sendStatus(200);
      }

      await client.replyMessage(event.replyToken, {
        type: "text",
        text: message
      });

      return res.sendStatus(200);
    } catch (err) {
      console.error("WEBHOOK ERROR:", err);
      return res.sendStatus(200);
    }
  }
);

/* ===================== GOOGLE SHEETS ===================== */
async function getSheetRows() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
  });

  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: SHEET_RANGE
  });

  return res.data.values || [];
}

/* ===== DETAIL BY ORDER ID ===== */
async function getOrderById(orderId) {
  const rows = await getSheetRows();
  if (rows.length < 2) return null;

  const h = rows[0];
  const idxNama = h.indexOf("Nama");
  const idxDept = h.indexOf("Departemen");
  const idxKebutuhan = h.indexOf("Kebutuhan desain (PPT, Poster, Infografis, dll)");
  const idxDeadline = h.indexOf("Deadline yang diajukan");
  const idxOrderId = h.indexOf("ORDER ID");
  const idxStatus = h.indexOf("Status");

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][idxOrderId] === orderId) {
      return {
        nama: rows[i][idxNama],
        departemen: rows[i][idxDept],
        kebutuhan: rows[i][idxKebutuhan],
        deadline: rows[i][idxDeadline],
        orderId: rows[i][idxOrderId],
        status: rows[i][idxStatus] || "Waiting"
      };
    }
  }
  return null;
}

/* ===== LIST ORDER BY DEPARTMENT ===== */
async function getOrdersByDepartment(dept) {
  const rows = await getSheetRows();
  if (rows.length < 2) return null;

  const h = rows[0];
  const idxDept = h.indexOf("Departemen");
  const idxOrderId = h.indexOf("ORDER ID");
  const idxDeadline = h.indexOf("Deadline yang diajukan");
  const idxKebutuhan = h.indexOf("Kebutuhan desain (PPT, Poster, Infografis, dll)");

  const list = [];

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][idxDept]?.toUpperCase() === dept && rows[i][idxOrderId]) {
      list.push(
        `${rows[i][idxOrderId]} - ${rows[i][idxKebutuhan]} | ${rows[i][idxDeadline]}`
      );
    }
  }

  if (!list.length) return null;

  return (
`Daftar Order Departemen ${dept}:\n\n` +
list.join("\n") +
`\n\nKetik !<ORDER ID> (contoh: !${dept}1) untuk melihat detail.`
  );
}

/* ===== FORMAT DETAIL ===== */
function formatDetail(order) {
  return (
`Detail Pesanan

Nama           : ${order.nama}
Departemen : ${order.departemen}
Pesanan       : ${order.kebutuhan}
Deadline       : ${order.deadline}
Order ID        : ${order.orderId}
Status           : ${order.status}

_______________
Actuarial Science Student Association
Line : @057eddac
Instagram : @assaipb`
  );
}

/* ===== HELP MESSAGE ===== */
function getHelpMessage() {
  return (
`Daftar Perintah COPM

!help
→ Menampilkan daftar perintah

!order <DEPARTEMEN>
Contoh: !order BDMP
→ Menampilkan semua pesanan departemen

!<ORDER ID>
Contoh: !BDMP1
→ Menampilkan detail pesanan dan status

Catatan:
• Semua perintah diawali tanda !
• Status pesanan diperbarui oleh admin`
  );
}

/* ===================== HEALTH CHECK ===================== */
app.get("/", (req, res) => {
  res.send("OK");
});

/* ===================== START SERVER ===================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
