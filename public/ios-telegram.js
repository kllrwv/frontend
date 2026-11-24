(() => {
  const input = new URLSearchParams(location.hash.slice(1));
  const client = input.get("client_id") ?? "";
  const nonce = input.get("nonce") ?? "";
  const lang = input.get("lang") === "en" ? "en" : "ru";
  const callback = input.get("callback") === "kllrwv" ? "kllrwv" : "killerwave-auth";
  history.replaceState(null, "", "/");
  const button = document.getElementById("telegram");
  const notice = document.getElementById("notice");
  const message = (ru, en) => lang === "en" ? en : ru;
  document.documentElement.lang = lang;
  button.textContent = message("продолжить в telegram", "continue in telegram");
  if (!/^\d{1,16}$/.test(client) || !/^[a-zA-Z0-9_-]{16,128}$/.test(nonce) || !window.Telegram?.Login) {
    notice.textContent = message("вход недоступен. закрой окно и попробуй снова.", "sign-in is unavailable. close this window and try again.");
    return;
  }
  function finish(values) {
    location.replace(callback + "://telegram/complete#" + new URLSearchParams({ state: nonce, ...values }));
  }
  button.disabled = false;
  button.addEventListener("click", async () => {
    button.disabled = true;
    notice.textContent = "";
    try {
      await window.Telegram.Login.auth({ client_id: Number(client), nonce, lang, scope: ["profile"] }, (result) => {
        if (result.id_token) finish({ id_token: result.id_token });
        else if (result.error === "popup_closed" || result.error === "access_denied") finish({ error: "telegram_cancelled" });
        else finish({ error: "telegram_failed" });
      });
    } catch {
      finish({ error: "telegram_failed" });
    }
  });
})();
