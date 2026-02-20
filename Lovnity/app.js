document.addEventListener("DOMContentLoaded", () => {
  const $ = (s) => document.querySelector(s);

  // -----------------------------
  // CONFIG — works locally AND in Docker
  // -----------------------------
  const API_BASE = window.location.hostname === "localhost"
    ? "http://localhost:3001"
    : `http://${window.location.hostname}:3001`;

  const UI = {
    panelCode: $("#panelCode"),
    panelRegister: $("#panelRegister"),
    panelWelcome: $("#panelWelcome"),

    topTitle: $("#topTitle"),
    topSubtitle: $("#topSubtitle"),

    codeInput: $("#codeInput"),
    codeBtn: $("#codeBtn"),
    codeMsg: $("#codeMsg"),

    registerForm: $("#registerForm"),
    regMsg: $("#regMsg"),
    backBtn: $("#backBtn"),

    welcomeLine: $("#welcomeLine"),
    welcomeTitle: $("#welcomeTitle"),
    welcomeCompany: $("#welcomeCompany"),
    continueBtn: $("#continueBtn"),
    resetBtn: $("#resetBtn"),

    helpBtn: $("#helpBtn"),
    helpModal: $("#helpModal"),
    modalBackdrop: $("#modalBackdrop"),
    closeModal: $("#closeModal"),
    modalOk: $("#modalOk"),
  };

  for (const [k, v] of Object.entries(UI)) {
    if (!v) throw new Error(`Missing element for UI.${k}`);
  }

  // Logos live in frontend only. DB returns partner info; we map partner name -> logo here.
  const PARTNER_ASSETS = {
    "Terveystalo": {
      logo: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" width="72" height="72">
        <circle cx="40" cy="40" r="38" fill="#005b8e" stroke="white" stroke-width="1.5"/>
        <text x="40" y="34" text-anchor="middle" fill="white" font-size="9" font-family="Arial" font-weight="bold">TERVEYSTALO</text>
        <path d="M28 42 h24 M40 30 v24" stroke="white" stroke-width="5" stroke-linecap="round"/>
      </svg>`
    },
    "Mehiläinen": {
      logo: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" width="72" height="72">
        <circle cx="40" cy="40" r="38" fill="#e8890c" stroke="white" stroke-width="1.5"/>
        <text x="40" y="36" text-anchor="middle" fill="white" font-size="8" font-family="Arial" font-weight="bold">MEHILÄINEN</text>
        <ellipse cx="40" cy="50" rx="10" ry="7" fill="white" opacity="0.9"/>
        <circle cx="40" cy="46" r="4" fill="#e8890c"/>
        <line x1="40" y1="28" x2="40" y2="38" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="32" y1="32" x2="40" y2="38" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="48" y1="32" x2="40" y2="38" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
      </svg>`
    },
    "Lovnity Partner": {
      logo: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" width="72" height="72">
        <circle cx="40" cy="40" r="38" fill="#8b5cf6" stroke="white" stroke-width="1.5"/>
        <text x="40" y="44" text-anchor="middle" fill="white" font-size="12" font-family="Arial" font-weight="bold">LOVNITY</text>
      </svg>`
    },
  };

  let currentCode = null;
  let currentPartner = null; // { name, tagline, accent, logo? }

  // ---------- Code input ----------
  UI.codeInput.addEventListener("input", () => {
    UI.codeInput.value = UI.codeInput.value.replace(/\D/g, "").slice(0, 6);
    setMsg(UI.codeMsg, "");
  });

  UI.codeBtn.addEventListener("click", () => submitCode());
  UI.codeInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); submitCode(); }
  });

  async function submitCode() {
    const code = UI.codeInput.value.trim();

    if (code.length !== 6) {
      setMsg(UI.codeMsg, "Please enter a 6-digit code.", "error");
      return;
    }

    disable(UI.codeBtn, "Checking...");

    try {
      const res = await fetch(`${API_BASE}/check-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const data = await res.json().catch(() => ({}));
      enable(UI.codeBtn, "Continue");

      if (!res.ok) {
        setMsg(UI.codeMsg, data.error || "Server error while checking code.", "error");
        shake(UI.panelCode);
        return;
      }

      if (data.status === "invalid") {
        setMsg(UI.codeMsg, "Code not registered. Please check with your employer.", "error");
        shake(UI.panelCode);
        return;
      }

      currentCode = code;

      if (data.status === "ok") {
        const partner = attachPartnerAssets(data.partner);
        const profile = data.profile;

        localStorage.setItem(
          "lovnity_session",
          JSON.stringify({ code, profile_id: profile?.id || null })
        );

        if (profile) {
          currentPartner = partner;
          showWelcome({
            code,
            firstName: profile.firstName,
            surname: profile.surname,
            gender: profile.gender,
            age: profile.age,
            partner,
          });

          UI.welcomeLine.textContent = "Welcome back — already registered.";
          UI.welcomeTitle.textContent = "Welcome back, " + escapeHtml(profile.firstName) + "! \u{1F497}";
          return;
        }

        UI.topSubtitle.textContent = "You're all set.";
        UI.welcomeLine.textContent = "Welcome back — already registered.";
        UI.welcomeTitle.textContent = "Welcome back! \u{1F497}";
        UI.welcomeCompany.textContent = partner?.name
          ? `Greetings from ${partner.name}${partner.tagline ? " — " + partner.tagline : ""}`
          : "Redirect to main page (prototype).";
        UI.welcomeCompany.style.color = partner?.accent || "";

        const logoEl = $("#welcomeLogo");
        if (logoEl) logoEl.innerHTML = partner?.logo || "";
        const heart = $("#welcomeHeart");
        if (heart && partner?.accent) heart.style.setProperty("--heart-color", partner.accent);

        showPanel("welcome");
        return;
      }

      if (data.status === "needs_registration") {
        currentPartner = attachPartnerAssets(data.partner);
        setMsg(UI.codeMsg, "Code accepted — " + currentPartner.name, "success");
        await sleep(200);
        showRegister();
        return;
      }

      setMsg(UI.codeMsg, "Unexpected response from server.", "error");
      shake(UI.panelCode);
    } catch (err) {
      enable(UI.codeBtn, "Continue");
      setMsg(UI.codeMsg, "Could not reach server.", "error");
      shake(UI.panelCode);
    }
  }

  // ---------- Register ----------
  UI.backBtn.addEventListener("click", () => {
    showCode();
    UI.codeInput.focus();
  });

  UI.registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg(UI.regMsg, "");

    const firstName = $("#firstNameInput").value.trim();
    const surname = $("#surnameInput").value.trim();
    const gender = $("#genderInput").value.trim();
    const ageStr = $("#ageInput").value.trim();
    const age = Number(ageStr);

    if (!firstName || !surname || !gender || !ageStr) {
      setMsg(UI.regMsg, "Please fill in all fields.", "error");
      return;
    }
    if (!Number.isFinite(age) || age < 18 || age > 99) {
      setMsg(UI.regMsg, "Age must be between 18 and 99.", "error");
      return;
    }
    if (!currentCode) {
      setMsg(UI.regMsg, "Missing code. Please go back and enter your 6-digit code again.", "error");
      return;
    }

    setMsg(UI.regMsg, "Saving...", "success");
    UI.registerForm.querySelector("button[type='submit']")?.setAttribute("disabled", "true");

    try {
      const res = await fetch(`${API_BASE}/register-with-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: currentCode, firstName, surname, gender, age }),
      });

      const data = await res.json().catch(() => ({}));
      UI.registerForm.querySelector("button[type='submit']")?.removeAttribute("disabled");

      if (!res.ok) {
        setMsg(UI.regMsg, data.error || "Registration failed.", "error");
        return;
      }

      if (data.status !== "ok") {
        setMsg(UI.regMsg, data.error || "Unexpected response from server.", "error");
        return;
      }

      localStorage.setItem("lovnity_session", JSON.stringify({ code: currentCode, profile_id: data.profile_id }));

      currentPartner = attachPartnerAssets(data.partner);

      const profile = { code: currentCode, firstName, surname, gender, age, partner: currentPartner };

      setMsg(UI.regMsg, "Saved! Redirecting...", "success");
      await sleep(250);
      showWelcome(profile);
    } catch (err) {
      UI.registerForm.querySelector("button[type='submit']")?.removeAttribute("disabled");
      setMsg(UI.regMsg, "Could not reach server.", "error");
    }
  });

  // ---------- Welcome ----------
  UI.continueBtn.addEventListener("click", () => {
    alert("Next: route to your main app page.");
  });

  UI.resetBtn.addEventListener("click", async () => {
    localStorage.removeItem("lovnity_session");

    currentCode = null;
    currentPartner = null;

    UI.codeInput.value = "";
    $("#firstNameInput").value = "";
    $("#surnameInput").value = "";
    $("#genderInput").value = "";
    $("#ageInput").value = "";

    showCode();
    UI.codeInput.focus();
  });

  // ---------- Modal ----------
  const openHelpModal = () => {
    UI.modalBackdrop.classList.remove("hidden");
    UI.helpModal.classList.remove("hidden");
  };
  const closeHelpModal = () => {
    UI.modalBackdrop.classList.add("hidden");
    UI.helpModal.classList.add("hidden");
  };

  UI.helpBtn.addEventListener("click", openHelpModal);
  UI.closeModal.addEventListener("click", closeHelpModal);
  UI.modalOk.addEventListener("click", closeHelpModal);
  UI.modalBackdrop.addEventListener("click", closeHelpModal);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeHelpModal(); });

  // ---------- Views ----------
  function showCode() {
    UI.panelCode.classList.remove("hidden");
    UI.panelRegister.classList.add("hidden");
    UI.panelWelcome.classList.add("hidden");
    UI.topSubtitle.textContent = "Enter your 6-digit code to continue.";
    setMsg(UI.codeMsg, "");
    setMsg(UI.regMsg, "");
  }

  function showRegister() {
    UI.panelCode.classList.add("hidden");
    UI.panelRegister.classList.remove("hidden");
    UI.panelWelcome.classList.add("hidden");
    UI.topSubtitle.textContent = "Register your profile details.";
    setMsg(UI.regMsg, "");

    $("#firstNameInput").value = "";
    $("#surnameInput").value = "";
    $("#genderInput").value = "";
    $("#ageInput").value = "";

    const banner = $("#partnerBanner");
    if (banner && currentPartner) {
      banner.textContent = "Registering under: " + currentPartner.name;
      banner.style.color = currentPartner.accent || "";
    }
  }

  function showWelcome(profile) {
    UI.panelCode.classList.add("hidden");
    UI.panelRegister.classList.add("hidden");
    UI.panelWelcome.classList.remove("hidden");

    const p = profile.partner || {};

    UI.topSubtitle.textContent = "You're all set.";
    UI.welcomeLine.textContent = "Profile created successfully.";
    UI.welcomeTitle.textContent = "Welcome, " + escapeHtml(profile.firstName) + "! \u{1F497}";

    const companyLine = p.name
      ? ("Greetings from " + escapeHtml(p.name) + (p.tagline ? " — " + escapeHtml(p.tagline) : ""))
      : "Greetings!";
    UI.welcomeCompany.textContent = companyLine;
    UI.welcomeCompany.style.color = p.accent || "";

    const logoEl = $("#welcomeLogo");
    if (logoEl) logoEl.innerHTML = p.logo || "";

    const heart = $("#welcomeHeart");
    if (heart && p.accent) heart.style.setProperty("--heart-color", p.accent);
  }

  function showPanel(which) {
    UI.panelCode.classList.toggle("hidden", which !== "code");
    UI.panelRegister.classList.toggle("hidden", which !== "register");
    UI.panelWelcome.classList.toggle("hidden", which !== "welcome");
  }

  // ---------- Helpers ----------
  function setMsg(el, text, type) {
    el.textContent = text || "";
    el.classList.remove("msg--error", "msg--success");
    if (type === "error") el.classList.add("msg--error");
    if (type === "success") el.classList.add("msg--success");
  }

  function disable(btn, text) { btn.disabled = true; btn.textContent = text; }
  function enable(btn, text) { btn.disabled = false; btn.textContent = text; }

  function shake(el) {
    el.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-8px)" },
        { transform: "translateX(8px)" },
        { transform: "translateX(-6px)" },
        { transform: "translateX(6px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 360, easing: "ease-out" }
    );
  }

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function attachPartnerAssets(partner) {
    const p = partner || {};
    const assets = (p.name && PARTNER_ASSETS[p.name]) ? PARTNER_ASSETS[p.name] : {};
    return {
      name: p.name || "Partner",
      tagline: p.tagline || "",
      accent: p.accent || "",
      logo: assets.logo || "",
    };
  }

  showCode();
});