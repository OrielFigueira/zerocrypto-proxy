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

    // Aponta a notificação para a rota /webhook do próprio Render (para capturar e repassar garantido)
    const renderHost = req.headers.host ? `https://${req.headers.host}` : null;
    const webhookUrl = renderHost 
      ? `${renderHost}/webhook` 
      : `${SUPABASE_PROJECT_URL}/functions/v1/zerocrypto-webhook`;

    console.log("=== ENVIANDO PARA ZEROCRYPTO ===");
    console.log("Order ID Real:", orderIdStr);
    console.log("Webhook Callback Registrado:", webhookUrl);

    const formData = new URLSearchParams();
    formData.append("amount", amountStr);
    formData.append("token", TOKEN);
    formData.append("sign", sign);
    formData.append("signature", sign);
    formData.append("login", LOGIN);
    formData.append("order_id", orderIdStr);
    
    // Envia todas as possíveis variações do parâmetro de webhook que o gateway possa ler
    formData.append("url_callback", webhookUrl);
    formData.append("callback_url", webhookUrl);
    formData.append("webhook_url", webhookUrl);
    formData.append("webhook", webhookUrl);
    formData.append("url_return", webhookUrl);
    formData.append("url_result", webhookUrl);

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

// 2. ROTA DE WEBHOOK (RECEBE DO ZEROCRYPTO E REPASSA LIMPO PARA O SUPABASE)
app.use("/webhook", async (req, res) => {
  try {
    const SUPABASE_PROJECT_URL = (process.env.SUPABASE_URL || "https://SEU_PROJETO.supabase.co").trim();
    const targetUrl = `${SUPABASE_PROJECT_URL}/functions/v1/zerocrypto-webhook`;

    console.log("=== WEBHOOK RECEBIDO NO RENDER ===");
    console.log("Método:", req.method);
    console.log("Headers:", JSON.stringify(req.headers));
    console.log("Body Recebido:", JSON.stringify(req.body));
    console.log("Query String:", JSON.stringify(req.query));

    // Consolida Body e Query Params em um objeto só
    let payload = req.body || {};
    if (req.query && Object.keys(req.query).length > 0) {
      payload = { ...payload, ...req.query };
    }

    console.log("Repassando para Supabase Edge Function:", targetUrl);

    // Dispara o evento direto para o Supabase
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const responseData = await response.text();
    console.log("Resposta do Supabase Webhook:", responseData);

    res.status(response.status).send(responseData);

  } catch (error) {
    console.error("Erro ao repassar Webhook no Render:", error);
    res.status(500).send("Internal Error: " + error.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy rodando na porta ${PORT}`));
