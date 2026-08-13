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

    // Variações de teste
    const tests = [
      {
        name: "SHA256 Padrão (5.77)",
        amt: formattedAmount,
        algo: "sha256"
      },
      {
        name: "MD5 Padrão (5.77)",
        amt: formattedAmount,
        algo: "md5"
      },
      {
        name: "SHA256 sem Ponto (ex: 577)",
        amt: String(Math.round(Number(amount) * 100)),
        algo: "sha256"
      }
    ];

    let lastData = null;

    for (const t of tests) {
      const rawString = t.amt + SECRET + order_id + LOGIN;
      const sign = crypto.createHash(t.algo).update(rawString).digest("hex");

      console.log(`=== TESTANDO: ${t.name} ===`);
      console.log("RAW STRING:", rawString);
      console.log("SIGN:", sign);

      const formData = new URLSearchParams();
      formData.append("amount", formattedAmount); // No formulário mantém o valor normal
      formData.append("token", TOKEN);
      formData.append("sign", sign);
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

      // Se der certo, interrompe o loop e devolve
      if (lastData && (lastData.status === true || lastData.url_to_pay)) {
        console.log(`>>> SUCESSO NO TESTE: ${t.name} <<<`);
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
