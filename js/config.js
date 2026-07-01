/* ============================================================
   CONFIG — Firebase + Anthropic
============================================================ */

// Firebase
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyC0CgcbZeGw9zmjBhyZF7MIIQkcSisyGaw",
  authDomain:        "rankeia.firebaseapp.com",
  projectId:         "rankeia",
  storageBucket:     "rankeia.firebasestorage.app",
  messagingSenderId: "446148123959",
  appId:             "1:446148123959:web:f83c3b780bcb1966794eb2",
};

// Anthropic — cole sua sk-ant-... aqui ou configure em Configurações dentro do app
// ⚠️ Nunca commite a chave real — cole-a diretamente em Configurações dentro do app
const ANTHROPIC_API_KEY = window.ENV_ANTHROPIC_API_KEY || "";
const ANTHROPIC_MODEL   = "claude-sonnet-4-20250514";
const ANTHROPIC_TOKENS  = 1800;

// Plataformas
const PLATFORMS = {
  mercado_livre: { name:"Mercado Livre", color:"#FFE600", maxTitle:60  },
  shopee:        { name:"Shopee",        color:"#EE4D2D", maxTitle:120 },
  amazon:        { name:"Amazon",        color:"#FF9900", maxTitle:200 },
  tiktok_shop:   { name:"TikTok Shop",   color:"#FF0050", maxTitle:80  },
  magalu:        { name:"Magalu",        color:"#0086FF", maxTitle:150 },
};
