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

      // BOT DIAM SELAIN "ORDER"
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

      // ================= FLEX MESSAGE =================
      await client.replyMessage(event.replyToken, {
        type: "flex",
        altText: "Detail Order COPM BDMP",
        contents: {
          type: "bubble",
          body: {
            type: "box",
            layout: "vertical",
            spacing: "md",
            contents: [
              {
                type: "text",
                text: `Halo, kak ${order.nama}!`,
                weight: "bold",
                size: "md"
              },
              {
                type: "text",
                text: "Terima kasih sudah memesan COPM BDMP Kabinet Vidyadharma.",
                wrap: true,
                size: "sm"
              },
              {
                type: "separator"
              },
              {
                type: "text",
                text: "Detail Pesanan",
                weight: "bold",
                size: "sm"
              },
              {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                contents: [
                  {
                    type: "text",
                    text: `Pesanan: ${order.kebutuhan}`,
                    weight: "bold",
                    wrap: true
                  },
                  {
                    type: "text",
                    text: `Deadline: ${order.deadline}`,
                    weight: "bold",
                    wrap: true
                  },
                  {
                    type: "text",
                    text: `Order ID: ${order.orderId}`,
                    weight: "bold"
                  }
                ]
              },
              {
                type: "separator"
              },
              {
                type: "text",
                text:
                  "Actuarial Science Student Association\n" +
                  "Line : @057eddac\n" +
                  "Instagram : @assaipb",
                size: "xs",
                wrap: true,
                color: "#888888"
              }
            ]
          }
        }
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
