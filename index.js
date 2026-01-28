const express = require("express");
const line = require("@line/bot-sdk");
const { google } = require("googleapis");

const app = express();

/* ========= CONFIG ========= */
const LINE_CONFIG = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = "Form_Responses 1";
const KEYWORD = "ORDER";

/* ========= LINE ========= */
const client = new line.Client(LINE_CONFIG);

/* ========= MIDDLEWARE ========= */
app.post(
  "/webhook",
  line.middleware(LINE_CONFIG),
  async (req, res) => {
    try {
      const event = req.body.events?.[0];
      if (!event || event.type !== "message") {
        return res.sendStatus(200);
      }

      const text = event.message.text.trim().toUpperCase();
      if (text !== KEYWORD) {
        await client.replyMessage(event.replyToken, {
          type: "text",
          text: "Silakan kirim pesan:\nORDER"
        });
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
`Halo ${order.nama}!

Order ID: ${order.orderId}
Pesanan untuk desain: ${order.kebutuhan}
Deadline: ${order.deadline}
_______________
Actuarial Science Student Association
Line : @057eddac
Instagram : @assaipb`;

      await client.replyMessage(event.replyToken, {
        type: "text",
        text: message
      });

      res.sendStatus(200);
    } catch (err) {
      console.error(err);
      res.sendStatus(200);
    }
  }
);

/* ========= GOOGLE SHEETS ========= */
async function getLatestOrder() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
  });

  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: SHEET_NAME
  });

  const rows = res.data.values;
  if (!rows || rows.length < 2) return null;

  const headers = rows[0];
  const idxNama = headers.indexOf("Nama");
  const idxOrder = headers.indexOf("ORDER ID");
  const idxKebutuhan = headers.indexOf("Kebutuhan desain (PPT, Poster, Infografis, dll)");
  const idxDeadline = headers.indexOf("Deadline yang diajukan");

  for (let i = rows.length - 1; i > 0; i--) {
    if (rows[i][idxOrder]) {
      return {
        nama: rows[i][idxNama],
        orderId: rows[i][idxOrder],
        kebutuhan: rows[i][idxKebutuhan],
        deadline: rows[i][idxDeadline]
      };
    }
  }
  return null;
}

/* ========= START SERVER ========= */
app.get("/", (req, res) => res.send("OK"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
