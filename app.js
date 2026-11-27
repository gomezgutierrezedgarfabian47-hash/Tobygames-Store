// ==================== CONFIGURACIÓN DE SUPABASE ====================
// Reemplaza estos dos valores con los de tu proyecto en Supabase -> Settings -> API
const SUPABASE_URL = "https://pigxrycqbiyrbvoehppt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_3HBUQcGfgjv4X5AawZYGRA_akLoQsyA";
const STORAGE_BUCKET = "tobygames-assets";

const hasSupabaseConfig =
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  !SUPABASE_URL.includes("TU-PROYECTO") &&
  !SUPABASE_ANON_KEY.includes("TU-ANON-PUBLIC-KEY") &&
  window.supabase &&
  typeof window.supabase.createClient === "function";

const sb = hasSupabaseConfig ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const DEFAULT_GAMES = [
  { id: 1, title: "Neon Drift X", category: "Acción", price: 1.00, desc: "Carreras cyberpunk a máxima velocidad con autos personalizables.", img: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80", fileName: null, fileUrl: null },
  { id: 2, title: "Pixel Dungeon Quest", category: "Aventura", price: 1.00, desc: "Explora mazmorras generadas proceduralmente y derrota jefes épicos.", img: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=600&q=80", fileName: null, fileUrl: null },
  { id: 3, title: "Toby Boost Optimizer", category: "Utilidades", price: 1.00, desc: "Herramienta ligera para optimizar FPS y liberar memoria RAM en PC.", img: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80", fileName: null, fileUrl: null },
  { id: 4, title: "Shadow Hollow", category: "Indie", price: 1.00, desc: "Aventura atmosférica de plataformas y acertijos en un bosque encantado.", img: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=600&q=80", fileName: null, fileUrl: null }
];

const DEFAULT_USERS = [
  { id: 1, name: "Tobygames", email: "tobygames489@gmail.com", pass: "ikea123", role: "admin", balance: 99.00, spins: 10, library: [1] }
];

let users = JSON.parse(localStorage.getItem("tg_users")) || DEFAULT_USERS;
let games = JSON.parse(localStorage.getItem("tg_games")) || DEFAULT_GAMES;
let comments = JSON.parse(localStorage.getItem("tg_comments")) || [];
let activityLogs = JSON.parse(localStorage.getItem("tg_activity_logs")) || [];
let currentUser = JSON.parse(localStorage.getItem("tg_session")) || null;
let activeCommentGameId = null;

function normalizeProfileRow(row) {
  let parsedLib = [];
  if (Array.isArray(row.library)) {
    parsedLib = row.library.map(Number);
  } else if (typeof row.library === "string") {
    try {
      const arr = JSON.parse(row.library);
      if (Array.isArray(arr)) parsedLib = arr.map(Number);
    } catch (_) {}
  }
  return {
    id: Number(row.id),
    name: row.name,
    email: row.email,
    pass: row.password,
    role: row.role || "user",
    balance: Number(row.balance) || 0,
    spins: Number(row.spins) || 0,
    library: parsedLib
  };
}

function normalizeGameRow(row) {
  return {
    id: Number(row.id),
    title: row.title,
    category: row.category,
    price: Number(row.price) || 1.00,
    desc: row.description || "",
    img: row.img_url || "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=600&q=80",
    fileName: row.file_name || null,
    fileUrl: row.file_url || null
  };
}

function normalizeCommentRow(row) {
  return {
    id: Number(row.id),
    gameId: Number(row.game_id),
    userId: row.user_id != null ? Number(row.user_id) : null,
    userName: row.user_name || "Usuario",
    userRole: row.user_role || "user",
    text: row.comment || "",
    createdAt: row.created_at || new Date().toISOString()
  };
}

function normalizeActivityRow(row) {
  return {
    id: Number(row.id),
    type: row.activity_type || "game_purchase",
    userId: row.user_id != null ? Number(row.user_id) : null,
    userName: row.user_name || "Usuario",
    userEmail: row.user_email || "",
    gameId: row.game_id != null ? Number(row.game_id) : null,
    gameTitle: row.game_title || "",
    amount: Number(row.amount) || 0,
    balanceAfter: Number(row.balance_after) || 0,
    detail: row.detail || "",
    createdAt: row.created_at || new Date().toISOString()
  };
}

function saveLocalCache() {
  localStorage.setItem("tg_users", JSON.stringify(users));
  localStorage.setItem("tg_games", JSON.stringify(games));
  localStorage.setItem("tg_comments", JSON.stringify(comments));
  localStorage.setItem("tg_activity_logs", JSON.stringify(activityLogs));
  if (currentUser) {
    const idx = users.findIndex(u => u.id === currentUser.id);
    if (idx !== -1) users[idx] = currentUser;
    localStorage.setItem("tg_users", JSON.stringify(users));
    localStorage.setItem("tg_session", JSON.stringify(currentUser));
  }
}

async function syncUserToCloud(userObj) {
  if (!sb || !userObj) return true;
  const payload = {
    id: userObj.id,
    name: userObj.name,
    email: userObj.email,
    password: userObj.pass,
    role: userObj.role,
    balance: Number(userObj.balance.toFixed(2)),
    spins: userObj.spins,
    library: userObj.library
  };
  const { error } = await sb.from("tg_profiles").upsert(payload, { onConflict: "id" });
  if (error) {
    console.error("Supabase profile sync error:", error);
    showToast("⚠️ Error sincronizando perfil en Supabase.");
    return false;
  }
  return true;
}

async function syncGameToCloud(gameObj) {
  if (!sb || !gameObj) return true;
  const payload = {
    id: gameObj.id,
    title: gameObj.title,
    category: gameObj.category,
    price: Number(gameObj.price.toFixed(2)),
    description: gameObj.desc,
    img_url: gameObj.img,
    file_name: gameObj.fileName || null,
    file_url: gameObj.fileUrl || null
  };
  const { error } = await sb.from("tg_games").upsert(payload, { onConflict: "id" });
  if (error) {
    console.error("Supabase game sync error:", error);
    showToast("⚠️ Error guardando juego en Supabase.");
    return false;
  }
  return true;
}

async function deleteGameFromCloud(gameId) {
  if (!sb) return true;
  const { error } = await sb.from("tg_games").delete().eq("id", gameId);
  if (error) {
    console.error("Supabase delete game error:", error);
    showToast("⚠️ Error borrando juego en Supabase.");
    return false;
  }
  return true;
}

async function deleteUserFromCloud(userId) {
  if (!sb) return true;
  const { error } = await sb.from("tg_profiles").delete().eq("id", userId);
  if (error) {
    console.error("Supabase delete user error:", error);
    showToast("⚠️ Error borrando usuario en Supabase.");
    return false;
  }
  return true;
}

async function syncCommentToCloud(commentObj) {
  if (!sb || !commentObj) return true;
  const payload = {
    id: commentObj.id,
    game_id: commentObj.gameId,
    user_id: commentObj.userId,
    user_name: commentObj.userName,
    user_role: commentObj.userRole,
    comment: commentObj.text,
    created_at: commentObj.createdAt
  };
  const { error } = await sb.from("tg_comments").upsert(payload, { onConflict: "id" });
  if (error) {
    console.error("Supabase comment sync error:", error);
    showToast("⚠️ Error guardando comentario en Supabase.");
    return false;
  }
  return true;
}

async function deleteCommentFromCloud(commentId) {
  if (!sb) return true;
  const { error } = await sb.from("tg_comments").delete().eq("id", commentId);
  if (error) {
    console.error("Supabase delete comment error:", error);
    showToast("⚠️ Error borrando comentario en Supabase.");
    return false;
  }
  return true;
}


async function recordActivityLog({ type, user, amount, balanceAfter, detail = "", gameId = null, gameTitle = "" }) {
  if (!user) return;
  const entry = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    type,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    gameId,
    gameTitle,
    amount: Number(Number(amount).toFixed(2)),
    balanceAfter: Number(Number(balanceAfter).toFixed(2)),
    detail,
    createdAt: new Date().toISOString()
  };

  activityLogs.unshift(entry);
  saveLocalCache();

  if (sb) {
    const { error } = await sb.from("tg_activity_logs").upsert({
      id: entry.id,
      activity_type: entry.type,
      user_id: entry.userId,
      user_name: entry.userName,
      user_email: entry.userEmail,
      game_id: entry.gameId,
      game_title: entry.gameTitle,
      amount: entry.amount,
      balance_after: entry.balanceAfter,
      detail: entry.detail,
      created_at: entry.createdAt
    }, { onConflict: "id" });
    if (error) {
      console.error("Supabase activity log error:", error);
    }
  }
}

async function loadCloudData() {
  if (!sb) return;
  const [gamesRes, usersRes, commentsRes, activityRes] = await Promise.all([
    sb.from("tg_games").select("*").order("id", { ascending: false }),
    sb.from("tg_profiles").select("*").order("id", { ascending: true }),
    sb.from("tg_comments").select("*").order("id", { ascending: false }),
    sb.from("tg_activity_logs").select("*").order("id", { ascending: false })
  ]);

  if (!gamesRes.error && Array.isArray(gamesRes.data) && gamesRes.data.length > 0) {
    games = gamesRes.data.map(normalizeGameRow);
  }
  if (commentsRes && !commentsRes.error && Array.isArray(commentsRes.data)) {
    comments = commentsRes.data.map(normalizeCommentRow);
  }
  if (activityRes && !activityRes.error && Array.isArray(activityRes.data)) {
    activityLogs = activityRes.data.map(normalizeActivityRow);
  }
  if (!usersRes.error && Array.isArray(usersRes.data) && usersRes.data.length > 0) {
    users = usersRes.data.map(normalizeProfileRow);
    if (currentUser) {
      const refreshed = users.find(u => u.id === currentUser.id);
      if (refreshed) {
        currentUser = refreshed;
      } else {
        logout();
        return;
      }
    }
  }
  saveLocalCache();
}

function showToast(msg) {
  const container = document.getElementById("toast-container");
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ==================== AUTENTICACIÓN ====================
function switchAuthTab(tab) {
  document.getElementById("tab-login").classList.toggle("active", tab === "login");
  document.getElementById("tab-register").classList.toggle("active", tab === "register");
  document.getElementById("login-form").classList.toggle("hidden", tab !== "login");
  document.getElementById("register-form").classList.toggle("hidden", tab !== "register");
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim().toLowerCase();
  const pass = document.getElementById("login-pass").value;

  if (sb) {
    const { data, error } = await sb
      .from("tg_profiles")
      .select("*")
      .ilike("email", email)
      .eq("password", pass)
      .maybeSingle();

    if (error || !data) {
      return showToast("❌ Correo o contraseña incorrectos.");
    }
    currentUser = normalizeProfileRow(data);
    await loadCloudData();
    saveLocalCache();
    initApp();
    showToast(`👋 ¡Bienvenido de nuevo, ${currentUser.name}!`);
    return;
  }

  const found = users.find(u => u.email.toLowerCase() === email && u.pass === pass);
  if (!found) return showToast("❌ Correo o contraseña incorrectos.");
  currentUser = found;
  saveLocalCache();
  initApp();
  showToast(`👋 ¡Bienvenido de nuevo, ${currentUser.name}!`);
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById("reg-name").value.trim();
  const email = document.getElementById("reg-email").value.trim().toLowerCase();
  const pass = document.getElementById("reg-pass").value;

  const gmailRegex = /^[a-z0-9._%+-]+@gmail\.com$/;
  if (!gmailRegex.test(email)) {
    return showToast("⚠️ Solo puedes registrarte usando un correo @gmail.com válido.");
  }

  if (sb) {
    const { data: existing } = await sb
      .from("tg_profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    if (existing) {
      return showToast("⚠️ Ese correo ya está registrado.");
    }
  } else if (users.some(u => u.email.toLowerCase() === email)) {
    return showToast("⚠️ Ese correo ya está registrado.");
  }

  const code = generateSixDigitCode();
  const otpRecord = await saveOtpRecord({
    email,
    purpose: "register_gmail",
    code,
    payload: { name }
  });
  const dispatch = await dispatchOtpEmail({
    email,
    name,
    code,
    purposeLabel: "Verificación de cuenta Gmail"
  });

  pendingRegistration = {
    name,
    email,
    pass,
    otpRecord
  };

  openVerifyGmailModal(email, dispatch.sentViaEmail ? null : dispatch.previewCode);
  showToast(dispatch.sentViaEmail
    ? `✉️ Código de 6 dígitos enviado a ${email}.`
    : `🔑 Código generado (${code}) para verificar ${email}.`);
}

function logout() {
  currentUser = null;
  localStorage.removeItem("tg_session");
  document.getElementById("app-screen").classList.add("hidden");
  document.getElementById("auth-screen").classList.remove("hidden");
}

// ==================== CONFIGURACIÓN DE PAYPAL ====================
// Configura tu usuario de PayPal.Me (ej: "Tobygames") o un enlace completo de pago/checkout.
// Si tienes Client ID de PayPal Developers, también puedes ponerlo en PAYPAL_CLIENT_ID.
// Configura tu PayPal para que el botón envíe al usuario directo a tu cuenta:
// - PAYPAL_ME_USER: tu usuario de paypal.me (ej. "tobygames" -> https://www.paypal.com/paypalme/tobygames/5.00USD)
// - PAYPAL_RECEIVER_EMAIL: tu correo de PayPal si quieres abrir un enlace de envío directo
// - PAYPAL_CUSTOM_CHECKOUT_URL: enlace propio de pago/checkout de PayPal si usas uno
const PAYPAL_CLIENT_ID = "";
const PAYPAL_ME_USER = "Tobygames489";
const PAYPAL_RECEIVER_EMAIL = "";
const PAYPAL_CUSTOM_CHECKOUT_URL = "";
let paypalSdkLoading = null;
let paypalRedirectOpened = false;

function buildPaypalCheckoutUrl(amount) {
  const formatted = Number(amount).toFixed(2);
  if (PAYPAL_CUSTOM_CHECKOUT_URL && PAYPAL_CUSTOM_CHECKOUT_URL.trim()) {
    const base = PAYPAL_CUSTOM_CHECKOUT_URL.trim();
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}amount=${encodeURIComponent(formatted)}`;
  }
  if (PAYPAL_ME_USER && PAYPAL_ME_USER.trim()) {
    const cleanUser = PAYPAL_ME_USER.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?paypal\.com\/paypalme\//i, "").replace(/\/+$/, "");
    return `https://www.paypal.com/paypalme/${encodeURIComponent(cleanUser)}/${encodeURIComponent(formatted)}USD`;
  }
  if (PAYPAL_RECEIVER_EMAIL && PAYPAL_RECEIVER_EMAIL.trim()) {
    return `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=${encodeURIComponent(PAYPAL_RECEIVER_EMAIL.trim())}&item_name=${encodeURIComponent("Recarga Tobygames")}&amount=${encodeURIComponent(formatted)}&currency_code=USD`;
  }
  return `https://www.paypal.com/paypalme/Tobygames489/${encodeURIComponent(formatted)}USD`;
}

function markPaypalRedirectStarted() {
  paypalRedirectOpened = true;
  const amount = getPaypalAmount();
  showToast(`🌐 Abriendo PayPal por $${amount.toFixed(2)} USD. Al terminar, confirma tu recarga aquí.`);
}

function ensurePaypalSdk() {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_ID.trim()) return Promise.resolve(false);
  if (window.paypal && typeof window.paypal.Buttons === "function") return Promise.resolve(true);
  if (paypalSdkLoading) return paypalSdkLoading;

  paypalSdkLoading = new Promise((resolve) => {
    const existing = document.querySelector('script[data-paypal-sdk="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(Boolean(window.paypal)));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(PAYPAL_CLIENT_ID.trim())}&currency=USD`;
    script.dataset.paypalSdk = "true";
    script.onload = () => resolve(Boolean(window.paypal && typeof window.paypal.Buttons === "function"));
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });

  return paypalSdkLoading;
}

function getPaypalAmount() {
  const raw = document.getElementById("paypal-amount-input")?.value || "0";
  const val = parseFloat(String(raw).replace(",", "."));
  return isNaN(val) ? 0 : Number(val.toFixed(2));
}

function selectPaypalAmount(amount) {
  const input = document.getElementById("paypal-amount-input");
  if (input) {
    input.value = Number(amount).toFixed(2);
    refreshPaypalCheckout();
  }
}

async function applyPaypalDeposit(amount) {
  if (!currentUser) return showToast("⚠️ Inicia sesión primero para recargar saldo.");
  if (isNaN(amount) || amount < 0.50) {
    return showToast("⚠️ El monto mínimo de recarga es $0.50 USD.");
  }

  currentUser.balance = Number((currentUser.balance + amount).toFixed(2));
  paypalRedirectOpened = false;
  saveLocalCache();
  await syncUserToCloud(currentUser);
  await recordActivityLog({
    type: "balance_topup",
    user: currentUser,
    amount,
    balanceAfter: currentUser.balance,
    detail: "Recarga de saldo con PayPal"
  });
  updateTopbar();
  renderCatalog();
  closePaypalModal();
  showToast(`💳 ¡Saldo recargado con PayPal! +$${amount.toFixed(2)} USD en tu moneda de la tienda.`);
}

async function confirmPaypalDeposit() {
  const amount = getPaypalAmount();
  if (isNaN(amount) || amount < 0.50) {
    return showToast("⚠️ El monto mínimo de recarga es $0.50 USD.");
  }
  if (!paypalRedirectOpened && (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_ID.trim())) {
    window.open(buildPaypalCheckoutUrl(amount), "_blank", "noopener,noreferrer");
    paypalRedirectOpened = true;
    showToast("🌐 Se abrió PayPal en una nueva pestaña. Completa el pago y vuelve a pulsar Confirmar Recarga.");
    return;
  }
  await applyPaypalDeposit(amount);
}

async function refreshPaypalCheckout() {
  const amount = getPaypalAmount();
  const safeAmount = amount >= 0.50 ? amount : 0.50;
  const externalLink = document.getElementById("paypal-external-link");
  if (externalLink) {
    externalLink.href = buildPaypalCheckoutUrl(safeAmount);
    externalLink.textContent = `🌐 Ir a PayPal para Recargar ($${safeAmount.toFixed(2)} USD)`;
  }

  const confirmBtn = document.getElementById("paypal-confirm-btn");
  if (confirmBtn) {
    confirmBtn.textContent = `✅ Confirmar Recarga Acreditada ($${safeAmount.toFixed(2)} USD)`;
  }

  const btnContainer = document.getElementById("paypal-button-container");
  const fallbackBox = document.getElementById("paypal-fallback-box");
  if (!btnContainer || !fallbackBox) return;

  btnContainer.innerHTML = "";
  const sdkReady = await ensurePaypalSdk();

  if (sdkReady && window.paypal && typeof window.paypal.Buttons === "function") {
    fallbackBox.classList.add("hidden");
    window.paypal.Buttons({
      createOrder: (_data, actions) => {
        const val = getPaypalAmount();
        if (val < 0.50) {
          showToast("⚠️ El monto mínimo es $0.50 USD.");
          return actions.reject();
        }
        return actions.order.create({
          purchase_units: [{
            description: `Recarga Tobygames ($${val.toFixed(2)} USD)`,
            amount: {
              currency_code: "USD",
              value: val.toFixed(2)
            }
          }]
        });
      },
      onApprove: async (_data, actions) => {
        const details = await actions.order.capture();
        const paidVal = parseFloat(details?.purchase_units?.[0]?.amount?.value || getPaypalAmount());
        await applyPaypalDeposit(paidVal);
      },
      onError: (err) => {
        console.error("PayPal Buttons error:", err);
        showToast("❌ Ocurrió un error al procesar el pago con PayPal.");
      }
    }).render("#paypal-button-container");
  } else {
    fallbackBox.classList.remove("hidden");
  }
}

function openPaypalModal() {
  if (!currentUser) return showToast("⚠️ Inicia sesión primero para recargar saldo.");
  paypalRedirectOpened = false;
  const input = document.getElementById("paypal-amount-input");
  if (input && (!input.value || parseFloat(input.value) < 0.50)) {
    input.value = "5.00";
  }
  document.getElementById("paypal-modal").classList.remove("hidden");
  refreshPaypalCheckout();
}

function closePaypalModal() {
  document.getElementById("paypal-modal").classList.add("hidden");
}

// ==================== INTERFAZ Y NAVEGACIÓN ====================
function initApp() {
  document.getElementById("auth-screen").classList.add("hidden");
  document.getElementById("app-screen").classList.remove("hidden");

  const savedTheme = localStorage.getItem("tg_theme") || "default";
  setTheme(savedTheme, false);

  updateTopbar();
  renderCatalog();
  renderLibrary();
  drawWheel();

  const isStaff = currentUser.role === "admin" || currentUser.role === "mod";
  document.getElementById("nav-admin").classList.toggle("hidden", !isStaff);
  document.getElementById("admin-only-mod-creator").classList.toggle("hidden", currentUser.role !== "admin");
  document.getElementById("admin-only-users-table").classList.toggle("hidden", currentUser.role !== "admin");

  if (isStaff) renderAdminPanels();
}

function updateTopbar() {
  document.getElementById("sidebar-username").textContent = currentUser.name;
  const roleEl = document.getElementById("sidebar-role");
  roleEl.className = "role-badge " + (currentUser.role === "admin" ? "role-admin" : currentUser.role === "mod" ? "role-mod" : "role-user");
  roleEl.textContent = currentUser.role === "admin" ? "Admin Principal" : currentUser.role === "mod" ? "Moderador" : "Usuario";

  document.getElementById("top-balance").textContent = currentUser.balance.toFixed(2);
  document.getElementById("top-spins").textContent = currentUser.spins;
  document.getElementById("wheel-spins-label").textContent = currentUser.spins;
  document.getElementById("set-username").value = currentUser.name;
  document.getElementById("set-email").value = currentUser.email;
}

async function navigate(view) {
  const titles = {
    catalog: "Catálogo de Juegos y Apps",
    library: "Mi Biblioteca de Descargas",
    wheel: "Ruleta de Premios Tobygames",
    settings: "Configuración de Cuenta",
    admin: "Panel de Administración y Moderación"
  };
  document.getElementById("view-title").textContent = titles[view];
  document.querySelectorAll(".view-container").forEach(el => el.classList.add("hidden"));
  document.getElementById(`view-${view}`).classList.remove("hidden");
  document.querySelectorAll(".nav-item").forEach(btn => btn.classList.toggle("active", btn.dataset.view === view));

  if (sb) await loadCloudData();
  if (!currentUser) return;
  updateTopbar();

  if (view === "catalog") renderCatalog();
  if (view === "library") renderLibrary();
  if (view === "admin") renderAdminPanels();
}

// ==================== CATÁLOGO Y COMPRAS ====================
function renderCatalog() {
  const query = document.getElementById("search-input").value.toLowerCase();
  const cat = document.getElementById("category-filter").value;
  const filtered = games.filter(g => {
    const matchText = g.title.toLowerCase().includes(query) || g.desc.toLowerCase().includes(query);
    const matchCat = cat === "all" || g.category === cat;
    return matchText && matchCat;
  });

  document.getElementById("catalog-count").textContent = filtered.length;
  const grid = document.getElementById("catalog-grid");
  grid.innerHTML = filtered.map(game => {
    const owned = currentUser.library.includes(game.id);
    return `
      <div class="game-card">
        <img src="${game.img}" alt="${game.title}" class="game-cover" onerror="this.src='https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=600&q=80'"/>
        <div class="game-body">
          <div>
            <div class="game-cat">${game.category}</div>
            <div class="game-title">${game.title}</div>
            <p class="game-desc">${game.desc}</p>
          </div>
          <div class="game-footer" style="gap: 8px; flex-wrap: wrap;">
            <span class="price-tag">$${game.price.toFixed(2)}</span>
            <div style="display: flex; gap: 6px; align-items: center;">
              <button type="button" class="btn btn-outline btn-sm" onclick="openCommentsModal(${game.id})">
                💬 (${getGameCommentsCount(game.id)})
              </button>
              ${owned
                ? `<button class="btn btn-outline btn-sm" onclick="navigate('library')">✅ En Biblioteca</button>`
                : `<button class="btn btn-primary btn-sm" onclick="buyGame(${game.id})">Comprar</button>`
              }
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

async function buyGame(gameId) {
  const game = games.find(g => g.id === gameId);
  if (!game) return;
  const price = Number(game.price) || 0;
  if (currentUser.balance < price) {
    showToast("❌ Saldo insuficiente en la tienda. Recarga con PayPal o gira la ruleta.");
    openPaypalModal();
    return;
  }
  currentUser.balance = Number((currentUser.balance - price).toFixed(2));
  if (!currentUser.library.includes(game.id)) {
    currentUser.library.push(game.id);
  }
  saveLocalCache();
  await syncUserToCloud(currentUser);
  await recordActivityLog({
    type: "game_purchase",
    user: currentUser,
    amount: price,
    balanceAfter: currentUser.balance,
    gameId: game.id,
    gameTitle: game.title,
    detail: `Compra de "${game.title}"`
  });
  updateTopbar();
  renderCatalog();
  renderLibrary();
  showToast(`🎮 Compraste "${game.title}" (-$${price.toFixed(2)} USD). Saldo restante: $${currentUser.balance.toFixed(2)} USD.`);
}

async function downloadGameFile(gameId) {
  const game = games.find(g => g.id === gameId);
  if (!game) return;

  if (game.fileUrl) {
    try {
      const response = await fetch(game.fileUrl);
      if (!response.ok) throw new Error("Network response not ok");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = game.fileName || `${game.title}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
      showToast(`⬇️ Descargando "${game.fileName || game.title}"...`);
      return;
    } catch (_) {
      window.open(game.fileUrl, "_blank", "noopener");
      showToast(`⬇️ Abriendo descarga de "${game.fileName || game.title}"...`);
      return;
    }
  }

  if (game.fileData && game.fileName) {
    const link = document.createElement("a");
    link.href = game.fileData;
    link.download = game.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`⬇️ Descargando "${game.fileName}"...`);
  } else {
    showToast(`⬇️ Descargando instalador de ${game.title}...`);
  }
}

function renderLibrary() {
  const ownedGames = games.filter(g => currentUser.library.includes(g.id));
  const grid = document.getElementById("library-grid");
  if (ownedGames.length === 0) {
    grid.innerHTML = `<p style="color: var(--text-muted);">Aún no tienes juegos en tu biblioteca.</p>`;
    return;
  }
  grid.innerHTML = ownedGames.map(game => `
    <div class="game-card">
      <img src="${game.img}" alt="${game.title}" class="game-cover" onerror="this.src='https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=600&q=80'"/>
      <div class="game-body">
        <div>
          <div class="game-cat">${game.category}</div>
          <div class="game-title">${game.title}</div>
          <p class="game-desc">${game.desc}</p>
        </div>
        <button class="btn btn-accent" style="width: 100%;" onclick="downloadGameFile(${game.id})">
          ⬇️ ${game.fileName ? `Descargar (${game.fileName})` : "Descargar Ahora"}
        </button>
      </div>
    </div>
  `).join("");
}

// ==================== RULETA DE PREMIOS ====================
const WHEEL_PRIZES = [
  { label: "+$0.50 USD", color: "#8b5cf6", type: "money", value: 0.50 },
  { label: "Sin Premio", color: "#1f2937", type: "none", value: 0 },
  { label: "Juego Gratis", color: "#06b6d4", type: "game", value: 1 },
  { label: "+$0.50 USD", color: "#10b981", type: "money", value: 0.50 },
  { label: "Giro Extra", color: "#f59e0b", type: "spin", value: 1 },
  { label: "+$1.00 USD", color: "#ec4899", type: "money", value: 1.00 }
];
let currentRotation = 0;
let isSpinning = false;

function drawWheel() {
  const canvas = document.getElementById("wheel-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radius = cx - 6;
  const arc = (2 * Math.PI) / WHEEL_PRIZES.length;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  WHEEL_PRIZES.forEach((prize, i) => {
    const angle = currentRotation + i * arc;
    ctx.beginPath();
    ctx.fillStyle = prize.color;
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, angle, angle + arc);
    ctx.fill();
    ctx.strokeStyle = "#090b10";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle + arc / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 15px Segoe UI";
    ctx.fillText(prize.label, radius - 22, 5);
    ctx.restore();
  });
}

async function spinWheel(paid) {
  if (isSpinning) return;
  if (paid) {
    if (currentUser.balance < 0.50) return showToast("❌ Necesitas $0.50 USD para comprar un giro.");
    currentUser.balance = Number((currentUser.balance - 0.50).toFixed(2));
  } else {
    if (currentUser.spins <= 0) return showToast("❌ No tienes giros gratis disponibles.");
    currentUser.spins -= 1;
  }
  saveLocalCache();
  await syncUserToCloud(currentUser);
  updateTopbar();

  isSpinning = true;
  const resultBox = document.getElementById("wheel-result-box");
  resultBox.classList.add("hidden");

  const spinDuration = 4000;
  const extraSpins = (5 + Math.random() * 4) * 2 * Math.PI;
  const startRotation = currentRotation;
  const startTime = performance.now();

  function animate(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / spinDuration, 1);
    const easeOut = 1 - Math.pow(1 - progress, 3);
    currentRotation = startRotation + extraSpins * easeOut;
    drawWheel();

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      isSpinning = false;
      resolveWheelPrize();
    }
  }
  requestAnimationFrame(animate);
}

async function resolveWheelPrize() {
  const arc = (2 * Math.PI) / WHEEL_PRIZES.length;
  const pointerAngle = (1.5 * Math.PI - (currentRotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const index = Math.floor(pointerAngle / arc) % WHEEL_PRIZES.length;
  const prize = WHEEL_PRIZES[index];

  let message = "";
  if (prize.type === "money") {
    currentUser.balance = Number((currentUser.balance + prize.value).toFixed(2));
    message = `🎉 ¡Ganaste +$${prize.value.toFixed(2)} USD en tu cuenta!`;
  } else if (prize.type === "spin") {
    currentUser.spins += 1;
    message = "🎡 ¡Ganaste 1 Giro Extra gratis!";
  } else if (prize.type === "game") {
    const unowned = games.filter(g => !currentUser.library.includes(g.id));
    if (unowned.length > 0) {
      const wonGame = unowned[Math.floor(Math.random() * unowned.length)];
      currentUser.library.push(wonGame.id);
      message = `🏆 ¡PREMIO MAYOR! Ganaste el juego "${wonGame.title}" gratis.`;
    } else {
      currentUser.balance = Number((currentUser.balance + 1.00).toFixed(2));
      message = "🏆 ¡Ya tienes todos los juegos! Recibes +$1.00 USD en su lugar.";
    }
  } else {
    message = "😅 Casi... ¡Sigue intentando en tu próximo giro!";
  }

  saveLocalCache();
  await syncUserToCloud(currentUser);
  updateTopbar();
  const resultBox = document.getElementById("wheel-result-box");
  document.getElementById("wheel-result-text").textContent = message;
  resultBox.classList.remove("hidden");
  showToast(message);
}

// ==================== CONFIGURACIÓN Y MODAL DE CONTRASEÑA ====================
async function updateProfile(e) {
  e.preventDefault();
  const newName = document.getElementById("set-username").value.trim();
  const newEmail = document.getElementById("set-email").value.trim().toLowerCase();
  if (!newName || !newEmail) return;

  const emailTaken = users.some(u => u.id !== currentUser.id && u.email.toLowerCase() === newEmail);
  if (emailTaken) {
    return showToast("⚠️ Ese correo ya está en uso por otra cuenta.");
  }

  currentUser.name = newName;
  currentUser.email = newEmail;
  saveLocalCache();
  await syncUserToCloud(currentUser);
  updateTopbar();
  showToast("✅ Perfil y correo actualizados.");
}

function openPasswordModal() {
  document.getElementById("curr-pass-input").value = "";
  document.getElementById("new-pass-input").value = "";
  document.getElementById("confirm-pass-input").value = "";
  document.getElementById("password-modal").classList.remove("hidden");
}

function closePasswordModal() {
  document.getElementById("password-modal").classList.add("hidden");
}

async function handleChangePassword(e) {
  e.preventDefault();
  const currentPass = document.getElementById("curr-pass-input").value;
  const newPass = document.getElementById("new-pass-input").value;
  const confirmPass = document.getElementById("confirm-pass-input").value;

  if (currentPass !== currentUser.pass) {
    return showToast("❌ La contraseña actual no es correcta.");
  }
  if (newPass.length < 4) {
    return showToast("⚠️ La nueva contraseña debe tener al menos 4 caracteres.");
  }
  if (newPass !== confirmPass) {
    return showToast("⚠️ Las contraseñas nuevas no coinciden.");
  }

  currentUser.pass = newPass;
  saveLocalCache();
  await syncUserToCloud(currentUser);
  closePasswordModal();
  showToast("🔒 Contraseña cambiada con éxito.");
}

function setTheme(theme, notify = true) {
  document.body.className = theme === "default" ? "" : `theme-${theme}`;
  localStorage.setItem("tg_theme", theme);
  if (notify) showToast("🎨 Tema visual actualizado.");
}

// ==================== STORAGE Y PANEL DE ADMIN / MODERADORES ====================
function sanitizeStorageFileName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function uploadFileToSupabaseStorage(file, folder) {
  const cleanName = sanitizeStorageFileName(file.name);
  const filePath = `${folder}/${Date.now()}_${cleanName}`;
  const { error } = await sb.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, { cacheControl: "3600", upsert: false });

  if (error) {
    throw new Error(error.message || "Error subiendo archivo a Storage");
  }

  const { data } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
}

async function addNewGame(e) {
  e.preventDefault();
  const title = document.getElementById("new-game-title").value.trim();
  const category = document.getElementById("new-game-cat").value;
  const price = parseFloat(document.getElementById("new-game-price").value);
  const urlInput = document.getElementById("new-game-img").value.trim();
  const imgFileInput = document.getElementById("new-game-img-file");
  const gameFileInput = document.getElementById("new-game-file");
  const desc = document.getElementById("new-game-desc").value.trim();

  const imgFile = imgFileInput && imgFileInput.files ? imgFileInput.files[0] : null;
  const gameFile = gameFileInput && gameFileInput.files ? gameFileInput.files[0] : null;
  const fallbackImg = "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=600&q=80";

  if (sb) {
    try {
      let finalImg = urlInput || fallbackImg;
      let finalFileUrl = null;

      if (imgFile) {
        finalImg = await uploadFileToSupabaseStorage(imgFile, "covers");
      }
      if (gameFile) {
        finalFileUrl = await uploadFileToSupabaseStorage(gameFile, "builds");
      }

      const newGame = {
        id: Date.now(),
        title,
        category,
        price,
        img: finalImg,
        desc,
        fileName: gameFile ? gameFile.name : null,
        fileUrl: finalFileUrl
      };

      const ok = await syncGameToCloud(newGame);
      if (!ok) return;

      games.unshift(newGame);
      saveLocalCache();
      e.target.reset();
      document.getElementById("new-game-price").value = "1.00";
      renderAdminPanels();
      renderCatalog();
      showToast(`🚀 "${title}" publicado en la nube.`);
    } catch (err) {
      console.error(err);
      showToast("❌ No se pudieron subir los archivos a Supabase Storage.");
    }
    return;
  }

  const MAX_GAME_FILE_BYTES = 8 * 1024 * 1024;
  if (gameFile && gameFile.size > MAX_GAME_FILE_BYTES) {
    return showToast("⚠️ El archivo del juego supera los 8 MB para almacenamiento local.");
  }

  const MAX_IMG_FILE_BYTES = 2 * 1024 * 1024;
  if (imgFile && imgFile.size > MAX_IMG_FILE_BYTES) {
    return showToast("⚠️ La imagen supera los 2 MB. Elige una imagen más ligera o usa una URL.");
  }

  Promise.all([
    imgFile ? readFileAsDataURL(imgFile) : Promise.resolve(null),
    gameFile ? readFileAsDataURL(gameFile) : Promise.resolve(null)
  ])
    .then(([uploadedImgDataUrl, uploadedGameDataUrl]) => {
      const newGame = {
        id: Date.now(),
        title,
        category,
        price,
        img: uploadedImgDataUrl || urlInput || fallbackImg,
        desc,
        fileName: gameFile ? gameFile.name : null,
        fileData: uploadedGameDataUrl || null
      };

      try {
        games.unshift(newGame);
        saveLocalCache();
        e.target.reset();
        document.getElementById("new-game-price").value = "1.00";
        renderAdminPanels();
        renderCatalog();
        showToast(`🚀 "${title}" publicado en el catálogo.`);
      } catch (_) {
        games = games.filter(g => g.id !== newGame.id);
        showToast("⚠️ No hay suficiente espacio en el navegador para guardar archivos tan pesados.");
      }
    })
    .catch(() => {
      showToast("❌ Error al procesar los archivos seleccionados.");
    });
}

async function deleteGame(id) {
  const game = games.find(g => g.id === id);
  if (!game) return;
  if (!confirm(`¿Seguro que quieres borrar "${game.title}" del catálogo?`)) return;

  const ok = await deleteGameFromCloud(id);
  if (!ok) return;

  games = games.filter(g => g.id !== id);
  saveLocalCache();
  renderAdminPanels();
  renderCatalog();
  showToast(`🗑️ "${game.title}" eliminado del catálogo.`);
}

async function createModerator(e) {
  e.preventDefault();
  if (currentUser.role !== "admin") return;
  const name = document.getElementById("mod-name").value.trim();
  const email = document.getElementById("mod-email").value.trim().toLowerCase();
  const pass = document.getElementById("mod-pass").value;

  if (users.some(u => u.email.toLowerCase() === email)) {
    return showToast("⚠️ Ya existe una cuenta con ese correo.");
  }
  const newMod = { id: Date.now(), name, email, pass, role: "mod", balance: 0, spins: 1, library: [] };
  const ok = await syncUserToCloud(newMod);
  if (!ok) return;

  users.push(newMod);
  saveLocalCache();
  e.target.reset();
  renderAdminPanels();
  showToast(`🛡️ Moderador "${name}" creado con éxito.`);
}

async function toggleModRole(userId) {
  if (currentUser.role !== "admin") return;
  const user = users.find(u => u.id === userId);
  if (!user || user.role === "admin") return;
  user.role = user.role === "mod" ? "user" : "mod";
  saveLocalCache();
  await syncUserToCloud(user);
  renderAdminPanels();
  showToast(`🔄 Rol de ${user.name} actualizado a ${user.role.toUpperCase()}.`);
}

async function deleteUser(userId) {
  if (currentUser.role !== "admin") return;
  const user = users.find(u => u.id === userId);
  if (!user || user.role === "admin") return;

  if (!confirm(`¿Seguro que quieres borrar al usuario "${user.name}" (${user.email})?`)) return;

  const ok = await deleteUserFromCloud(userId);
  if (!ok) return;

  users = users.filter(u => u.id !== userId);
  saveLocalCache();
  renderAdminPanels();
  showToast(`🗑️ Usuario "${user.name}" eliminado.`);
}

async function giftUserBonus(userId) {
  if (currentUser.role !== "admin") return;
  const user = users.find(u => u.id === userId);
  if (!user) return;

  const rawAmount = prompt(`¿Cuánto saldo ($ USD) quieres enviar a ${user.name}?`, "1.00");
  if (rawAmount === null) return;
  const amount = parseFloat(rawAmount.replace(",", "."));
  if (isNaN(amount) || amount <= 0) {
    return showToast("⚠️ Ingresa un monto válido mayor a 0.");
  }

  user.balance = Number((user.balance + amount).toFixed(2));
  if (currentUser.id === user.id) {
    currentUser.balance = user.balance;
  }
  saveLocalCache();
  await syncUserToCloud(user);
  renderAdminPanels();
  if (currentUser.id === user.id) updateTopbar();
  showToast(`💵 Enviados +$${amount.toFixed(2)} USD a ${user.name}.`);
}

function renderAdminPanels() {
  document.getElementById("admin-games-table").innerHTML = games.map(g => `
    <tr>
      <td><strong>${g.title}</strong></td>
      <td>${g.category}</td>
      <td>$${g.price.toFixed(2)}</td>
      <td><button class="btn btn-danger btn-sm" onclick="deleteGame(${g.id})">Eliminar</button></td>
    </tr>
  `).join("");

  const activityTableEl = document.getElementById("admin-activity-table");
  if (activityTableEl) {
    const normalizeSearch = (str) =>
      String(str || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

    const actQuery = normalizeSearch(document.getElementById("activity-search-input")?.value || "");
    const actType = document.getElementById("activity-type-filter")?.value || "all";
    const terms = actQuery ? actQuery.split(/\s+/) : [];

    const filteredLogs = activityLogs.filter(item => {
      const matchesType = actType === "all" || item.type === actType;
      const haystack = normalizeSearch([
        item.userName,
        item.userEmail,
        item.userId != null ? String(item.userId) : "",
        item.gameTitle,
        item.detail,
        item.type === "balance_topup" ? "recarga saldo paypal" : "compra juego"
      ].join(" "));
      const matchesText = terms.every(t => haystack.includes(t));
      return matchesType && matchesText;
    });

    if (filteredLogs.length === 0) {
      activityTableEl.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 18px;">
            No hay compras de saldo ni de juegos registradas todavía.
          </td>
        </tr>
      `;
    } else {
      activityTableEl.innerHTML = filteredLogs.map(item => {
        const isTopup = item.type === "balance_topup";
        const badgeClass = isTopup ? "role-user" : "role-mod";
        const typeLabel = isTopup ? "Compra de Saldo" : "Compra de Juego";
        const amountStr = isTopup
          ? `<span style="color: var(--success); font-weight: 700;">+$${item.amount.toFixed(2)}</span>`
          : `<span style="color: var(--warning); font-weight: 700;">-$${item.amount.toFixed(2)}</span>`;
        return `
          <tr>
            <td style="white-space: nowrap; color: var(--text-muted); font-size: 0.82rem;">${formatCommentDate(item.createdAt)}</td>
            <td><strong>${item.userName}</strong><br><span style="font-size: 0.78rem; color: var(--text-muted);">${item.userEmail || ""}</span></td>
            <td><span class="role-badge ${badgeClass}">${typeLabel}</span></td>
            <td>${item.detail || item.gameTitle || "-"}</td>
            <td>${amountStr}</td>
            <td>$${item.balanceAfter.toFixed(2)}</td>
          </tr>
        `;
      }).join("");
    }
  }

  if (currentUser.role === "admin") {
    const userQuery = (document.getElementById("user-search-input")?.value || "").trim().toLowerCase();
    const roleFilter = document.getElementById("user-role-filter")?.value || "all";

    const filteredUsers = users.filter(u => {
      const matchesText =
        !userQuery ||
        (u.name && u.name.toLowerCase().includes(userQuery)) ||
        (u.email && u.email.toLowerCase().includes(userQuery));
      const matchesRole = roleFilter === "all" || u.role === roleFilter;
      return matchesText && matchesRole;
    });

    if (filteredUsers.length === 0) {
      document.getElementById("admin-users-table").innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 18px;">
            No se encontraron usuarios que coincidan con el filtro.
          </td>
        </tr>
      `;
      return;
    }

    document.getElementById("admin-users-table").innerHTML = filteredUsers.map(u => `
      <tr>
        <td><strong>${u.name}</strong></td>
        <td>${u.email}</td>
        <td><span class="role-badge ${u.role === 'admin' ? 'role-admin' : u.role === 'mod' ? 'role-mod' : 'role-user'}">${u.role}</span></td>
        <td>$${u.balance.toFixed(2)}</td>
        <td>${u.spins}</td>
        <td style="display: flex; gap: 6px; flex-wrap: wrap;">
          ${u.role !== "admin" ? `
            <button class="btn btn-outline btn-sm" onclick="toggleModRole(${u.id})">
              ${u.role === "mod" ? "Quitar Mod" : "Hacer Mod"}
            </button>
            <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id})">Borrar</button>
          ` : ""}
          <button class="btn btn-primary btn-sm" onclick="giftUserBonus(${u.id})">Dar Saldo</button>
        </td>
      </tr>
    `).join("");
  }
}


// ==================== COMENTARIOS POR JUEGO ====================
function getGameCommentsCount(gameId) {
  return comments.filter(c => Number(c.gameId) === Number(gameId)).length;
}

function formatCommentDate(isoStr) {
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
  } catch (_) {
    return "";
  }
}

function renderCommentsList() {
  const listEl = document.getElementById("comments-list");
  if (!listEl || activeCommentGameId == null) return;

  const gameComments = comments.filter(c => Number(c.gameId) === Number(activeCommentGameId));
  if (gameComments.length === 0) {
    listEl.innerHTML = `<p style="color: var(--text-muted); font-size: 0.86rem; padding: 8px 0;">Aún no hay comentarios para este juego. ¡Sé el primero en comentar!</p>`;
    return;
  }

  const canModerate = currentUser && (currentUser.role === "admin" || currentUser.role === "mod");
  listEl.innerHTML = gameComments.map(c => {
    const canDelete = canModerate || (currentUser && Number(c.userId) === Number(currentUser.id));
    return `
      <div class="comment-item">
        <div class="comment-meta">
          <span>
            <strong style="color: var(--text-main);">${c.userName}</strong>
            <span class="role-badge ${c.userRole === 'admin' ? 'role-admin' : c.userRole === 'mod' ? 'role-mod' : 'role-user'}" style="margin-left: 6px;">${c.userRole}</span>
          </span>
          <span style="display: flex; align-items: center; gap: 8px;">
            <span>${formatCommentDate(c.createdAt)}</span>
            ${canDelete ? `<button type="button" class="btn btn-danger btn-sm" style="padding: 2px 7px; font-size: 0.72rem;" onclick="deleteGameComment(${c.id})">✕</button>` : ""}
          </span>
        </div>
        <div class="comment-text">${c.text}</div>
      </div>
    `;
  }).join("");
}

async function openCommentsModal(gameId) {
  const game = games.find(g => Number(g.id) === Number(gameId));
  if (!game) return showToast("⚠️ No se encontró la información del juego.");
  activeCommentGameId = Number(gameId);

  if (sb) {
    try {
      const { data, error } = await sb
        .from("tg_comments")
        .select("*")
        .eq("game_id", activeCommentGameId)
        .order("id", { ascending: false });
      if (!error && Array.isArray(data)) {
        const cloudComments = data.map(normalizeCommentRow);
        const cloudIds = new Set(cloudComments.map(c => Number(c.id)));
        const localOnlyForGame = comments.filter(
          c => Number(c.gameId) === activeCommentGameId && !cloudIds.has(Number(c.id))
        );
        const others = comments.filter(c => Number(c.gameId) !== activeCommentGameId);
        comments = [...cloudComments, ...localOnlyForGame, ...others];
        saveLocalCache();
      }
    } catch (err) {
      console.warn("Error cargando comentarios de Supabase:", err);
    }
  }

  document.getElementById("comments-modal-title").textContent = `💬 Comentarios — ${game.title}`;
  document.getElementById("comments-modal-subtitle").textContent = `Categoría: ${game.category} • Soporta consultas a tobygames489@gmail.com`;
  document.getElementById("comment-input").value = "";
  document.getElementById("comments-modal").classList.remove("hidden");
  renderCommentsList();
}

function closeCommentsModal() {
  activeCommentGameId = null;
  document.getElementById("comments-modal").classList.add("hidden");
}

async function submitGameComment(e) {
  e.preventDefault();
  if (!currentUser) return showToast("⚠️ Inicia sesión primero para comentar.");
  if (activeCommentGameId == null) return;

  const input = document.getElementById("comment-input");
  const text = (input?.value || "").trim();
  if (!text) return showToast("⚠️ Escribe un comentario antes de publicar.");

  const newComment = {
    id: Date.now(),
    gameId: Number(activeCommentGameId),
    userId: currentUser.id,
    userName: currentUser.name,
    userRole: currentUser.role || "user",
    text,
    createdAt: new Date().toISOString()
  };

  comments.unshift(newComment);
  saveLocalCache();
  input.value = "";
  renderCommentsList();
  renderCatalog();

  if (sb) {
    const payload = {
      id: newComment.id,
      game_id: newComment.gameId,
      user_id: newComment.userId,
      user_name: newComment.userName,
      user_role: newComment.userRole,
      comment: newComment.text,
      created_at: newComment.createdAt
    };
    const { error } = await sb.from("tg_comments").upsert(payload, { onConflict: "id" });
    if (error) {
      console.warn("Supabase comment upsert warning:", error);
      return showToast("💬 Comentario guardado localmente (revisa la tabla tg_comments en Supabase).");
    }
  }

  showToast("💬 Comentario publicado.");
}

async function deleteGameComment(commentId) {
  comments = comments.filter(c => Number(c.id) !== Number(commentId));
  saveLocalCache();
  renderCommentsList();
  renderCatalog();

  if (sb) {
    const { error } = await sb.from("tg_comments").delete().eq("id", commentId);
    if (error) {
      console.warn("Supabase comment delete warning:", error);
    }
  }
  showToast("🗑️ Comentario eliminado.");
}

// ==================== VERIFICACIÓN GMAIL Y RECUPERACIÓN DE CONTRASEÑA ====================
// Para envío real de correos desde frontend sin backend propio, puedes configurar EmailJS:
// https://www.emailjs.com/ -> Public Key, Service ID y Template ID con variables: {{to_email}}, {{to_name}}, {{otp_code}}, {{purpose_label}}
const EMAILJS_PUBLIC_KEY = "ctOjITpi4K3PJLOHZ";
const EMAILJS_SERVICE_ID = "service_cjse48k";
const EMAILJS_TEMPLATE_ID = "template_aqqeqmq";
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutos

let pendingRegistration = null;
let pendingPasswordReset = null;

function generateSixDigitCode() {
  const num = Math.floor(100000 + Math.random() * 900000);
  return String(num);
}

async function hashOtpCode(email, code) {
  const clean = `${email.trim().toLowerCase()}::${String(code).trim()}`;
  if (window.crypto && window.crypto.subtle) {
    const buf = new TextEncoder().encode(clean);
    const digest = await window.crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
  }
  return btoa(unescape(encodeURIComponent(clean)));
}

async function dispatchOtpEmail({ email, name, code, purposeLabel }) {
  const hasEmailJs =
    EMAILJS_PUBLIC_KEY.trim() &&
    EMAILJS_SERVICE_ID.trim() &&
    EMAILJS_TEMPLATE_ID.trim();

  if (hasEmailJs) {
    try {
      const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lib_version: "4.4.1",
          user_id: EMAILJS_PUBLIC_KEY.trim(),
          service_id: EMAILJS_SERVICE_ID.trim(),
          template_id: EMAILJS_TEMPLATE_ID.trim(),
          template_params: {
            to_email: email,
            email: email,
            to_name: name || email,
            otp_code: code,
            purpose_label: purposeLabel
          }
        })
      });
      if (res.ok) {
        return { sentViaEmail: true };
      }
      console.warn("EmailJS respondió con estado:", res.status);
    } catch (err) {
      console.warn("Error enviando con EmailJS:", err);
    }
  }

  console.info(`[Tobygames OTP - ${purposeLabel}] Destino: ${email} | Código: ${code}`);
  return { sentViaEmail: false, previewCode: hasEmailJs ? null : code };
}

async function saveOtpRecord({ email, purpose, code, payload = {} }) {
  const codeHash = await hashOtpCode(email, code);
  const record = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    email: email.trim().toLowerCase(),
    purpose,
    code_hash: codeHash,
    payload,
    expires_at: new Date(Date.now() + OTP_EXPIRY_MS).toISOString(),
    used: false
  };

  if (sb) {
    const { error } = await sb.from("tg_verification_codes").upsert(record, { onConflict: "id" });
    if (error) {
      console.warn("No se pudo guardar OTP en Supabase (se usará respaldo local):", error.message);
    }
  }
  return record;
}

async function verifyOtpRecord({ email, purpose, code, localRecord }) {
  const cleanEmail = email.trim().toLowerCase();
  const submittedHash = await hashOtpCode(cleanEmail, code);

  if (sb) {
    const { data, error } = await sb
      .from("tg_verification_codes")
      .select("*")
      .eq("email", cleanEmail)
      .eq("purpose", purpose)
      .eq("used", false)
      .order("id", { ascending: false })
      .limit(5);

    if (!error && Array.isArray(data) && data.length > 0) {
      const match = data.find(row => row.code_hash === submittedHash);
      if (!match) {
        return { ok: false, message: "❌ Código incorrecto. Revisa tu Gmail e inténtalo de nuevo." };
      }
      if (new Date(match.expires_at).getTime() < Date.now()) {
        return { ok: false, message: "⌛ El código ha expirado. Solicita uno nuevo." };
      }
      await sb.from("tg_verification_codes").update({ used: true }).eq("id", match.id);
      return { ok: true, payload: match.payload || {} };
    }
  }

  if (!localRecord || localRecord.code_hash !== submittedHash) {
    return { ok: false, message: "❌ Código incorrecto. Revisa tu Gmail e inténtalo de nuevo." };
  }
  if (new Date(localRecord.expires_at).getTime() < Date.now()) {
    return { ok: false, message: "⌛ El código ha expirado. Solicita uno nuevo." };
  }
  return { ok: true, payload: localRecord.payload || {} };
}

function openVerifyGmailModal(email, previewCode = null) {
  document.getElementById("register-otp-input").value = "";
  document.getElementById("verify-gmail-subtitle").textContent =
    `Enviamos un código de 6 dígitos a ${email} para verificar tu cuenta Gmail (vence en 10 minutos).`;

  const previewBox = document.getElementById("verify-gmail-preview-box");
  const previewCodeEl = document.getElementById("verify-gmail-preview-code");
  if (previewCode) {
    previewCodeEl.textContent = previewCode;
    previewBox.classList.remove("hidden");
  } else {
    previewCodeEl.textContent = "";
    previewBox.classList.add("hidden");
  }
  document.getElementById("verify-gmail-modal").classList.remove("hidden");
}

function closeVerifyGmailModal() {
  document.getElementById("verify-gmail-modal").classList.add("hidden");
}

async function resendRegisterOtp() {
  if (!pendingRegistration) return;
  const code = generateSixDigitCode();
  const otpRecord = await saveOtpRecord({
    email: pendingRegistration.email,
    purpose: "register_gmail",
    code,
    payload: { name: pendingRegistration.name }
  });
  pendingRegistration.otpRecord = otpRecord;
  const dispatch = await dispatchOtpEmail({
    email: pendingRegistration.email,
    name: pendingRegistration.name,
    code,
    purposeLabel: "Verificación de cuenta Gmail"
  });
  openVerifyGmailModal(pendingRegistration.email, dispatch.sentViaEmail ? null : dispatch.previewCode);
  showToast(dispatch.sentViaEmail
    ? `✉️ Nuevo código enviado a ${pendingRegistration.email}.`
    : `🔑 Código generado (${code}). Configura EmailJS para envío automático por correo.`);
}

async function confirmRegisterOtp(e) {
  e.preventDefault();
  if (!pendingRegistration) return;
  const code = (document.getElementById("register-otp-input").value || "").trim();

  const check = await verifyOtpRecord({
    email: pendingRegistration.email,
    purpose: "register_gmail",
    code,
    localRecord: pendingRegistration.otpRecord
  });
  if (!check.ok) {
    return showToast(check.message);
  }

  const { name, email, pass } = pendingRegistration;

  if (sb) {
    const { data: existing } = await sb
      .from("tg_profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (existing) {
      pendingRegistration = null;
      closeVerifyGmailModal();
      return showToast("⚠️ Ese correo ya fue registrado.");
    }
  } else if (users.some(u => u.email.toLowerCase() === email)) {
    pendingRegistration = null;
    closeVerifyGmailModal();
    return showToast("⚠️ Ese correo ya fue registrado.");
  }

  const newUser = {
    id: Date.now(),
    name,
    email,
    pass,
    role: "user",
    balance: 0.00,
    spins: 1,
    library: []
  };

  if (sb) {
    const ok = await syncUserToCloud(newUser);
    if (!ok) return;
  }

  users.push(newUser);
  currentUser = newUser;
  pendingRegistration = null;
  saveLocalCache();
  closeVerifyGmailModal();
  document.getElementById("register-form").reset();
  initApp();
  showToast("✅ ¡Gmail verificado y cuenta creada! Recibiste 1 Giro Gratis.");
}

function openForgotPasswordModal() {
  pendingPasswordReset = null;
  document.getElementById("reset-step-email").classList.remove("hidden");
  document.getElementById("reset-step-code").classList.add("hidden");
  document.getElementById("reset-email-input").value = "";
  document.getElementById("reset-otp-input").value = "";
  document.getElementById("reset-new-pass").value = "";
  document.getElementById("reset-confirm-pass").value = "";
  document.getElementById("forgot-password-modal").classList.remove("hidden");
}

function closeForgotPasswordModal() {
  pendingPasswordReset = null;
  document.getElementById("forgot-password-modal").classList.add("hidden");
}

function backToResetEmailStep() {
  document.getElementById("reset-step-code").classList.add("hidden");
  document.getElementById("reset-step-email").classList.remove("hidden");
}

async function requestPasswordResetOtp(e) {
  e.preventDefault();
  const email = (document.getElementById("reset-email-input").value || "").trim().toLowerCase();
  const gmailRegex = /^[a-z0-9._%+-]+@gmail\.com$/;
  if (!gmailRegex.test(email)) {
    return showToast("⚠️ Ingresa un correo @gmail.com válido.");
  }

  let targetUser = null;
  if (sb) {
    const { data } = await sb
      .from("tg_profiles")
      .select("*")
      .ilike("email", email)
      .maybeSingle();
    if (data) targetUser = normalizeProfileRow(data);
  }
  if (!targetUser) {
    targetUser = users.find(u => u.email.toLowerCase() === email) || null;
  }

  if (!targetUser) {
    return showToast("❌ No existe una cuenta registrada con ese correo Gmail.");
  }

  const code = generateSixDigitCode();
  const otpRecord = await saveOtpRecord({
    email,
    purpose: "password_reset",
    code,
    payload: { userId: targetUser.id }
  });

  const dispatch = await dispatchOtpEmail({
    email,
    name: targetUser.name,
    code,
    purposeLabel: "Recuperación de contraseña"
  });

  pendingPasswordReset = {
    email,
    userId: targetUser.id,
    otpRecord
  };

  document.getElementById("reset-step-email").classList.add("hidden");
  document.getElementById("reset-step-code").classList.remove("hidden");
  document.getElementById("reset-code-subtitle").textContent =
    `Enviamos un código de 6 dígitos a ${email}. Escríbelo y define tu nueva contraseña.`;

  const previewBox = document.getElementById("reset-code-preview-box");
  const previewCodeEl = document.getElementById("reset-code-preview-code");
  if (!dispatch.sentViaEmail && dispatch.previewCode) {
    previewCodeEl.textContent = dispatch.previewCode;
    previewBox.classList.remove("hidden");
  } else {
    previewCodeEl.textContent = "";
    previewBox.classList.add("hidden");
  }

  showToast(dispatch.sentViaEmail
    ? `✉️ Código de recuperación enviado a ${email}.`
    : `🔑 Código de recuperación generado (${code}).`);
}

async function confirmPasswordResetOtp(e) {
  e.preventDefault();
  if (!pendingPasswordReset) return;

  const code = (document.getElementById("reset-otp-input").value || "").trim();
  const newPass = document.getElementById("reset-new-pass").value;
  const confirmPass = document.getElementById("reset-confirm-pass").value;

  if (newPass.length < 4) {
    return showToast("⚠️ La nueva contraseña debe tener al menos 4 caracteres.");
  }
  if (newPass !== confirmPass) {
    return showToast("⚠️ Las contraseñas no coinciden.");
  }

  const check = await verifyOtpRecord({
    email: pendingPasswordReset.email,
    purpose: "password_reset",
    code,
    localRecord: pendingPasswordReset.otpRecord
  });
  if (!check.ok) {
    return showToast(check.message);
  }

  let userObj = users.find(u => u.email.toLowerCase() === pendingPasswordReset.email);
  if (!userObj && sb) {
    const { data } = await sb
      .from("tg_profiles")
      .select("*")
      .ilike("email", pendingPasswordReset.email)
      .maybeSingle();
    if (data) userObj = normalizeProfileRow(data);
  }

  if (!userObj) {
    return showToast("❌ No se encontró la cuenta para actualizar la contraseña.");
  }

  userObj.pass = newPass;
  const idx = users.findIndex(u => u.id === userObj.id);
  if (idx !== -1) {
    users[idx] = userObj;
  } else {
    users.push(userObj);
  }

  if (sb) {
    const ok = await syncUserToCloud(userObj);
    if (!ok) return;
  }

  saveLocalCache();
  closeForgotPasswordModal();
  showToast("🔒 Contraseña restablecida con éxito. Ya puedes iniciar sesión.");
}

// Iniciar si hay sesión activa y cargar datos de la nube si está configurada
(async function boot() {
  if (sb) {
    await loadCloudData();
  }
  if (currentUser) {
    initApp();
  }
})();
