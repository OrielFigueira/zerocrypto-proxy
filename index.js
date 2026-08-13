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

    const formattedAmount = Number(amount).toFixed(2);
    const rawString = formattedAmount + SECRET + order_id + LOGIN;

    // 1. SHA-256 Padrão
    const sha256Sign = crypto.createHash("sha256").update(rawString).digest("hex");

    // 2. HMAC-SHA256 (usando a Secret como chave)
    const hmacString = formattedAmount + order_id + LOGIN;
    const hmacSign = crypto.createHmac("sha256", SECRET).update(hmacString).digest("hex");

    const attempts = [
      { name: "SHA256 Concatenação Direta", sign: sha256Sign },
      { name: "HMAC-SHA256", sign: hmacSign }
    ];

    let lastData = null;

    for (const item of attempts) {
      console.log(`=== TESTANDO: ${item.name} ===`);
      console.log("SIGN:", item.sign);

      const formData = new URLSearchParams();
      formData.append("amount", formattedAmount);
      formData.append("token", TOKEN);
      formData.append("sign", item.sign);
      formData.append("login", LOGIN);
      formData.append("order_id", String(order_id));

      const response = await fetch("https://zerocryptopay.com/pay/newtrack", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString()
      });

      const text = await response.text();
      console.log("RESPOSTA ZEROCRYPTO:", text);

      try {
        lastData = JSON.parse(text);
      } catch (_e) {
        lastData = { status: false, message: text };
      }

      if (lastData && (lastData.status === true || lastData.url_to_pay)) {
        console.log(`>>> SUCESSO APROVADO COM: ${item.name} <<<`);
        return res.json(lastData);
      }
    }

    return res.json(lastData);

  } catch (error) {
    console.error("ERRO NO PROXY:", error);
    res.status(500).json({ status: false, message: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy rodando na porta ${PORT}`));
