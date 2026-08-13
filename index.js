const express = require("express");
const crypto = require("crypto");
const cors = require("cors");

const app = express();

// Suporte para receber tanto JSON quanto formulário x-www-form-urlencoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Rota de Health Check
app.get("/my-ip", async (req, res) => {
  try {
    const response = await fetch("https://api.ipify.org?format=json");
    const data = await response.json();
    res.json({ ip: data.ip });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 1. ROTA DE CRIAÇÃO DA FATURA
app.post("/create-invoice", async (req, res) => {
  try {
    const { amount, order_id } = req.body;

    if (!amount || !order_id) {
      return res.status(400).json({ status: false, message: "Parâmetros obrigatórios ausentes." });
    }

    const LOGIN = (process.env.ZEROCRYPTO_LOGIN || "").trim();
    const TOKEN = (process.env.ZEROCRYPTO_TOKEN || "").trim();
    const SECRET = (process.env.ZEROCRYPTO_SECRET || "").trim();
    const SUPABASE_PROJECT_URL = (process.env.SUPABASE_URL || "https://SEU_PROJETO.supabase.co").trim();

    const amountStr = String(amount);
    const orderIdStr = String(order_id);

    // Concatenação oficial: AMOUNT + SECRET_KEY + ORDER_ID + LOGIN
    const rawString = amountStr + SECRET + orderIdStr + LOGIN;
    const sign = crypto.createHash("sha256").update(rawString).digest("hex");

    // URL do Webhook que vai processar a entrega no Supabase
    const webhookUrl = `${SUPABASE_PROJECT_URL}/functions/v1/zerocrypto-webhook`;

    console.log("=== ENVIANDO PARA ZEROCRYPTO ===");
    console.log("Order ID Real:", orderIdStr);
    console.log("Webhook Callback:", webhookUrl);

    const formData = new URLSearchParams();
    formData.append("amount", amountStr);
    formData.append("token", TOKEN);
    formData.append("sign", sign);
    formData.append("signature", sign);
    formData.append("login", LOGIN);
    formData.append("order_id", orderIdStr);
    
    // Injeta a URL do webhook no payload para garantir
    formData.append("url_callback", webhookUrl);
    formData.append("callback_url", webhookUrl);

    const response = await fetch("https://zerocryptopay.com/pay/newtrack", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString()
    });

    const text = await response.text();
    console.log("RESPOSTA ZEROCRYPTO:", text);

    try {
      const data = JSON.parse(text);
      res.json(data);
    } catch (_e) {
      res.status(400).json({ status: false, message: "Erro ZeroCrypto: " + text });
    }

  } catch (error) {
    console.error("ERRO NO PROXY:", error);
    res.status(500).json({ status: false, message: error.message });
  }
});

// 2. ROTA DE WEBHOOK (REPASSE PARA O SUPABASE)
// Caso o ZeroCryptoPay notifique diretamente o Render, este repassa o aviso pro Supabase
app.post("/webhook", async (req, res) => {
  try {
    const SUPABASE_PROJECT_URL = (process.env.SUPABASE_URL || "https://SEU_PROJETO.supabase.co").trim();
    const targetUrl = `${SUPABASE_PROJECT_URL}/functions/v1/zerocrypto-webhook`;

    console.log("Webhook recebido no Render! Repassando para:", targetUrl);

    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": req.headers["content-type"] || "application/json"
      },
      body: typeof req.body === "string" ? req.body : JSON.stringify(req.body)
    });

    const responseData = await response.text();
    console.log("Resposta do Supabase Webhook:", responseData);

    res.status(response.status).send(responseData);

  } catch (error) {
    console.error("Erro ao repassar Webhook no Render:", error);
    res.status(500).send("Internal Error");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy rodando na porta ${PORT}`));
