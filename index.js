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

const KEYWORD = "ORDER";
const ORDER_ID_REGEX = /^[A-Z]+[0-9]+$/;

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

      let order = null;

      // CASE 1: ORDER (ambil order terakhir)
      if (text === KEYWORD) {
        order = await getLatestOrder();
      }
      // CASE 2: ORDER ID (ACAF1, BDMP3, dll)
      else if (ORDER_ID_REGEX.test(text)) {
        order = await getOrderById(text);
      }
      // selain itu bot DIAM
      else {
        return res.sendStatus(200);
      }

      if (!order) {
        await client.replyMessage(event.replyToken, {
          type: "text",
          text: "Data pesanan tidak ditemukan."
        });
        return res.sendStatus(200);
      }

      const message =
`Halo, kak ${order.nama}!

Berikut adalah detail pesanan terbaru Anda

Pesanan : ${order.kebutuhan}
Deadline : ${order.deadline}
ORDER ID : ${order.orderId}
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
async function getSheetRows() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
  });

  const sheets = google.sheets({ version: "v4", auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: SHEET_RANGE
  });

  return response.data.values || [];
}

async function getLatestOrder() {
  const rows = await getSheetRows();
  if (rows.length < 2) return null;

  const headers = rows[0];
  const idxNama = headers.indexOf("Nama");
  const idxKebutuhan = headers.indexOf("Kebutuhan desain (PPT, Poster, Infografis, dll)");
  const idxDeadline = headers.indexOf("Deadline yang diajukan");
  const idxOrderId = headers.indexOf("ORDER ID");

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

async function getOrderById(orderId) {
  const rows = await getSheetRows();
  if (rows.length < 2) return null;

  const headers = rows[0];
  const idxNama = headers.indexOf("Nama");
  const idxKebutuhan = headers.indexOf("Kebutuhan desain (PPT, Poster, Infografis, dll)");
  const idxDeadline = headers.indexOf("Deadline yang diajukan");
  const idxOrderId = headers.indexOf("ORDER ID");

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][idxOrderId] === orderId) {
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
