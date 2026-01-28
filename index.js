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

// ⚠️ SESUAI TAB SHEET DI SCREENSHOT
const SHEET_RANGE = "'Form Responses 1'!A1:Z1000";

const KEYWORD = "ORDER";

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

      if (text !== KEYWORD) {
        return res.sendStatus(200);
      }


      const order = await getLatestOrder();
      if (!order) {
        await client.replyMessage(event.replyToken, {
          type: "text",
          text: "Data pesanan tidak ditemukan."
        });
        return res.sendStatus(200);
      }

      const message =
`Halo, kak ${order.nama}!

Terima kasih sudah memesan COPM BDMP Kabinet Vidyadharma

Berikut adalah ORDER ID anda untuk pesanan |${order.kebutuhan}| dengan deadline yang diajukan pada |${order.deadline}|

ORDER ID: *${order.orderId}*
_______________
Actuarial Science Student Association
Line : @057eddac
Instagram : @assaipb`;

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
async function getLatestOrder() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
  });

  const sheets = google.sheets({ version: "v4", auth });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: SHEET_RANGE
  });

  const rows = response.data.values;
  if (!rows || rows.length < 2) return null;

  const headers = rows[0];

  const idxNama = headers.indexOf("Nama");
  const idxKebutuhan = headers.indexOf("Kebutuhan desain (PPT, Poster, Infografis, dll)");
  const idxDeadline = headers.indexOf("Deadline yang diajukan");
  const idxOrderId = headers.indexOf("ORDER ID");

  // Ambil baris terakhir yang ada ORDER ID
  for (let i = rows.length - 1; i > 0; i--) {
    if (rows[i][idxOrderId]) {
      return {
        nama: rows[i][idxNama],
        kebutuhan: rows[i][idxKebutuhan],
        deadline: rows[i][idxDeadline],
        orderId: rows[i][idxOrderId]
      };
    }
  }

  return null;
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
