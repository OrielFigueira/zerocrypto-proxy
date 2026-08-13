const express = require("express");
const crypto = require("crypto");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

app.get("/my-ip", async (req, res) => {
  try {
    const response = await fetch("https://api.ipify.org?format=json");
    const data = await response.json();
    res.json({ ip: data.ip });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/create-invoice", async (req, res) => {
  try {
    const { amount, order_id } = req.body;

    if (!amount || !order_id) {
      return res.status(400).json({ status: false, message: "Parâmetros obrigatórios ausentes." });
    }

    const LOGIN = (process.env.ZEROCRYPTO_LOGIN || "").trim();
    const TOKEN = (process.env.ZEROCRYPTO_TOKEN || "").trim();
    const SECRET = (process.env.ZEROCRYPTO_SECRET || "").trim();

    // Garante valor numérico com 2 casas decimais (ex: "3.08")
    const formattedAmount = Number(amount).toFixed(2);
    const rawString = formattedAmount + SECRET + order_id + LOGIN;

    // 1. Tenta primeira tentativa com MD5
    let sign = crypto.createHash("md5").update(rawString).digest("hex");
    let algorithmUsed = "md5";

    let formData = new URLSearchParams();
    formData.append("amount", formattedAmount);
    formData.append("token", TOKEN);
    formData.append("sign", sign);
    formData.append("login", LOGIN);
    formData.append("order_id", String(order_id));

    console.log("=== TENTATIVA 1: MD5 ===");
    console.log("RAW STRING:", rawString);
    console.log("SIGN (MD5):", sign);

    let response = await fetch("https://zerocryptopay.com/pay/newtrack", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString()
    });

    let text = await response.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch (_e) {
      data = null;
    }

    // 2. Se MD5 falhar por assinatura inválida (error_code 11), tenta SHA256
    if (data && !data.status && data.error_code === 11) {
      console.log("MD5 recusado. Tentando SHA256...");
      sign = crypto.createHash("sha256").update(rawString).digest("hex");
      algorithmUsed = "sha256";

      formData = new URLSearchParams();
      formData.append("amount", formattedAmount);
      formData.append("token", TOKEN);
      formData.append("sign", sign);
      formData.append("login", LOGIN);
      formData.append("order_id", String(order_id));

      response = await fetch("https://zerocryptopay.com/pay/newtrack", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString()
      });

      text = await response.text();
      try {
        data = JSON.parse(text);
      } catch (_e) {
        data = { status: false, message: text };
      }
    }

    console.log(`RESPOSTA FINAL ZEROCRYPTO (${algorithmUsed}):`, text);
    res.json(data);

  } catch (error) {
    console.error("ERRO NO PROXY:", error);
    res.status(500).json({ status: false, message: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy rodando na porta ${PORT}`));
