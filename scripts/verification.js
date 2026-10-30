(() => {
  "use strict";

  const body = document.body;
  const form = document.getElementById("verificationForm");
  const codeContainer = document.getElementById("codeContainer");
  const codeInputs = Array.from(document.querySelectorAll(".code-input"));
  const verifyBtn = document.getElementById("verifyBtn");
  const verifyBtnLabel = verifyBtn.querySelector(".button-label");
  const resendBtn = document.getElementById("resendBtn");
  const timerElement = document.getElementById("timer");
  const formMessage = document.getElementById("formMessage");
  const userEmailElement = document.getElementById("userEmail");
  const changeEmailLink = document.getElementById("changeEmail");

  /*
   * تنظیمات اتصال به بک‌اند از data attributeهای تگ body خوانده می‌شوند.
   * در صورت متفاوت بودن قرارداد API، فقط دو تابع buildVerifyPayload و
   * buildResendPayload را با ساختار مورد انتظار بک‌اند هماهنگ کنید.
   */
  const config = Object.freeze({
    verifyEndpoint: body.dataset.verifyEndpoint || "/api/auth/verify-code",
    resendEndpoint: body.dataset.resendEndpoint || "/api/auth/resend-code",
    successUrl: body.dataset.successUrl || "index.html",
    loginUrl: body.dataset.loginUrl || "login.html",
    resendDelay: toPositiveInteger(body.dataset.resendDelay, 60),
    requestTimeout: toPositiveInteger(body.dataset.requestTimeout, 15000),
  });

  const state = {
    isVerifying: false,
    isResending: false,
    countdownTimer: null,
    countdownEndsAt: 0,
  };

  const context = resolveVerificationContext();

  changeEmailLink.href = config.loginUrl;
  renderUserEmail(context.email);
  bindCodeInputs();
  updateVerifyButton();
  startCountdown(config.resendDelay);

  form.addEventListener("submit", handleVerify);
  resendBtn.addEventListener("click", handleResend);

  function bindCodeInputs() {
    codeInputs.forEach((input, index) => {
      input.addEventListener("input", (event) => handleInput(event, index));
      input.addEventListener("keydown", (event) => handleKeydown(event, index));
      input.addEventListener("focus", () => input.select());
    });

    codeContainer.addEventListener("paste", handlePaste);
  }

  function handleInput(event, index) {
    const digits = normalizeDigits(event.target.value);

    if (digits.length > 1) {
      fillCode(digits, index);
      return;
    }

    event.target.value = digits.slice(0, 1);
    clearMessage();

    if (event.target.value && index < codeInputs.length - 1) {
      codeInputs[index + 1].focus();
    }

    updateVerifyButton();
  }

  function handleKeydown(event, index) {
    if (event.key === "Backspace" && !codeInputs[index].value && index > 0) {
      event.preventDefault();
      codeInputs[index - 1].value = "";
      codeInputs[index - 1].focus();
      clearMessage();
      updateVerifyButton();
      return;
    }

    if (event.key === "ArrowRight" && index < codeInputs.length - 1) {
      event.preventDefault();
      codeInputs[index + 1].focus();
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      codeInputs[index - 1].focus();
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      codeInputs[0].focus();
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      codeInputs[codeInputs.length - 1].focus();
    }
  }

  function handlePaste(event) {
    const clipboardText = event.clipboardData?.getData("text") || "";
    const digits = normalizeDigits(clipboardText);

    if (!digits) return;

    event.preventDefault();
    const activeIndex = Math.max(0, codeInputs.indexOf(document.activeElement));
    const startIndex = digits.length >= codeInputs.length ? 0 : activeIndex;
    fillCode(digits, startIndex);
  }

  function fillCode(value, startIndex = 0) {
    const digits = normalizeDigits(value);
    let lastFilledIndex = startIndex;

    digits.split("").forEach((digit, offset) => {
      const targetIndex = startIndex + offset;
      if (!codeInputs[targetIndex]) return;
      codeInputs[targetIndex].value = digit;
      lastFilledIndex = targetIndex;
    });

    clearMessage();
    updateVerifyButton();

    const isComplete = getCode().length === codeInputs.length;
    codeInputs[isComplete ? codeInputs.length - 1 : lastFilledIndex].focus();
  }

  async function handleVerify(event) {
    event.preventDefault();

    if (state.isVerifying || state.isResending) return;

    const code = getCode();
    if (code.length !== codeInputs.length) {
      setMessage("لطفاً کد ۶ رقمی را کامل وارد کنید.", "error");
      focusFirstEmptyInput();
      return;
    }

    setVerifyingState(true);
    clearMessage();

    try {
      const { data } = await apiRequest(
        config.verifyEndpoint,
        buildVerifyPayload(code),
      );
      const successMessage =
        getApiMessage(data) || "حساب شما با موفقیت تأیید شد.";

      codeContainer.classList.remove("has-error");
      codeContainer.classList.add("has-success");
      codeInputs.forEach((input) => {
        input.disabled = true;
        input.setAttribute("aria-invalid", "false");
      });

      verifyBtn.classList.remove("is-loading");
      verifyBtn.classList.add("is-success");
      verifyBtnLabel.textContent = "تأیید شد";
      setMessage(successMessage, "success");
      clearTemporaryVerificationData();

      window.setTimeout(() => {
        window.location.assign(config.successUrl);
      }, 500);
    } catch (error) {
      const message = getErrorMessage(
        error,
        "تأیید کد انجام نشد. دوباره تلاش کنید.",
      );
      setMessage(message, "error");
      setVerifyingState(false);
      codeInputs[0].focus();
      codeInputs[0].select();
    }
  }

  async function handleResend() {
    if (resendBtn.disabled || state.isResending || state.isVerifying) return;

    setResendingState(true);
    clearMessage();

    try {
      const { data, response } = await apiRequest(
        config.resendEndpoint,
        buildResendPayload(),
      );

      const retryAfter = getRetryAfter(data, response) || config.resendDelay;
      clearCode();
      setMessage(getApiMessage(data) || "کد تأیید جدید ارسال شد.", "success");
      startCountdown(retryAfter);
      codeInputs[0].focus();
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        const retryAfter = getRetryAfter(error.data, error.response);
        if (retryAfter) startCountdown(retryAfter);
      }

      setMessage(
        getErrorMessage(
          error,
          "ارسال مجدد کد انجام نشد. لطفاً دوباره تلاش کنید.",
        ),
        "error",
      );
    } finally {
      setResendingState(false);
    }
  }

  /* قرارداد پیش‌فرض درخواست تأیید: { code, email?, challengeId? } */
  function buildVerifyPayload(code) {
    return removeEmptyValues({
      code,
      email: context.email,
      challengeId: context.challengeId,
    });
  }

  /* قرارداد پیش‌فرض درخواست ارسال مجدد: { email?, challengeId? } */
  function buildResendPayload() {
    return removeEmptyValues({
      email: context.email,
      challengeId: context.challengeId,
    });
  }

  async function apiRequest(endpoint, payload) {
    if (!endpoint) {
      throw new ApiError("آدرس سرویس مشخص نشده است.", 0, null, null);
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      config.requestTimeout,
    );
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    const csrfToken = document
      .querySelector('meta[name="csrf-token"]')
      ?.content?.trim();
    if (csrfToken) headers["X-CSRF-Token"] = csrfToken;

    // اگر لاگین توکن موقت تأیید را در sessionStorage قرار دهد، خودکار ارسال می‌شود.
    const verificationToken = safeSessionGet("verificationToken");
    if (verificationToken)
      headers.Authorization = `Bearer ${verificationToken}`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const data = await parseResponse(response);
      const explicitlyFailed =
        data && typeof data === "object" && data.success === false;

      if (!response.ok || explicitlyFailed) {
        throw new ApiError(
          getApiMessage(data) || defaultStatusMessage(response.status),
          response.status,
          data,
          response,
        );
      }

      return { data, response };
    } catch (error) {
      if (error instanceof ApiError) throw error;

      if (error.name === "AbortError") {
        throw new ApiError(
          "زمان پاسخ‌گویی سرور به پایان رسید. دوباره تلاش کنید.",
          0,
          null,
          null,
        );
      }

      throw new ApiError(
        "ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.",
        0,
        null,
        null,
      );
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async function parseResponse(response) {
    if (response.status === 204) return null;

    const rawBody = await response.text();
    if (!rawBody) return null;

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      try {
        return JSON.parse(rawBody);
      } catch {
        return null;
      }
    }

    return { message: rawBody.slice(0, 500) };
  }

  function getApiMessage(data) {
    if (!data) return "";
    if (typeof data === "string") return data;

    const directMessage = data.message || data.detail || data.error_description;
    if (typeof directMessage === "string") return directMessage;

    if (typeof data.error === "string") return data.error;
    if (data.error && typeof data.error.message === "string")
      return data.error.message;

    if (data.errors && typeof data.errors === "object") {
      const firstError = Object.values(data.errors)
        .flat()
        .find((item) => typeof item === "string");
      if (firstError) return firstError;
    }

    return "";
  }

  function getErrorMessage(error, fallback) {
    return error instanceof ApiError && error.message
      ? error.message
      : fallback;
  }

  function defaultStatusMessage(status) {
    const messages = {
      400: "اطلاعات ارسال‌شده معتبر نیست.",
      401: "نشست شما منقضی شده است. دوباره وارد حساب شوید.",
      403: "اجازه انجام این درخواست را ندارید.",
      404: "سرویس موردنظر پیدا نشد.",
      409: "این درخواست قبلاً انجام شده است.",
      410: "کد تأیید منقضی شده است. کد جدید دریافت کنید.",
      422: "کد واردشده معتبر نیست.",
      429: "تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد تلاش کنید.",
      500: "خطایی در سرور رخ داد. کمی بعد دوباره تلاش کنید.",
      502: "سرویس موقتاً در دسترس نیست.",
      503: "سرویس موقتاً در دسترس نیست.",
    };

    return messages[status] || "انجام درخواست با خطا روبه‌رو شد.";
  }

  function setVerifyingState(isLoading) {
    state.isVerifying = isLoading;
    verifyBtn.classList.toggle("is-loading", isLoading);
    verifyBtn.setAttribute("aria-busy", String(isLoading));
    codeInputs.forEach((input) => {
      input.readOnly = isLoading;
    });
    updateVerifyButton();
    updateResendButton();
  }

  function setResendingState(isLoading) {
    state.isResending = isLoading;
    resendBtn.textContent = isLoading ? "در حال ارسال…" : "ارسال مجدد";
    resendBtn.setAttribute("aria-busy", String(isLoading));
    updateVerifyButton();
    updateResendButton();
  }

  function setMessage(message, type) {
    formMessage.textContent = message;
    formMessage.className = `form-message is-${type}`;
    codeContainer.classList.toggle("has-error", type === "error");

    codeInputs.forEach((input) => {
      input.setAttribute("aria-invalid", String(type === "error"));
    });
  }

  function clearMessage() {
    formMessage.textContent = "";
    formMessage.className = "form-message";
    codeContainer.classList.remove("has-error", "has-success");
    codeInputs.forEach((input) => input.setAttribute("aria-invalid", "false"));
  }

  function getCode() {
    return codeInputs.map((input) => normalizeDigits(input.value)).join("");
  }

  function clearCode() {
    codeInputs.forEach((input) => {
      input.value = "";
      input.disabled = false;
      input.readOnly = false;
    });
    updateVerifyButton();
  }

  function focusFirstEmptyInput() {
    const emptyInput = codeInputs.find((input) => !input.value);
    (emptyInput || codeInputs[0]).focus();
  }

  function updateVerifyButton() {
    const isComplete = getCode().length === codeInputs.length;
    verifyBtn.disabled = !isComplete || state.isVerifying || state.isResending;
  }

  function startCountdown(seconds) {
    const safeSeconds = Math.max(
      1,
      toPositiveInteger(seconds, config.resendDelay),
    );
    window.clearInterval(state.countdownTimer);
    state.countdownEndsAt = Date.now() + safeSeconds * 1000;
    updateCountdown();
    state.countdownTimer = window.setInterval(updateCountdown, 250);
  }

  function updateCountdown() {
    const remaining = Math.max(
      0,
      Math.ceil((state.countdownEndsAt - Date.now()) / 1000),
    );

    if (remaining <= 0) {
      window.clearInterval(state.countdownTimer);
      state.countdownTimer = null;
      timerElement.textContent = "";
      timerElement.hidden = true;
      updateResendButton();
      return;
    }

    const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
    const seconds = String(remaining % 60).padStart(2, "0");
    timerElement.hidden = false;
    timerElement.textContent = `${minutes}:${seconds}`;
    updateResendButton();
  }

  function updateResendButton() {
    const countdownActive = state.countdownEndsAt > Date.now();
    resendBtn.disabled =
      countdownActive || state.isResending || state.isVerifying;
  }

  function getRetryAfter(data, response) {
    const bodyValue =
      data && typeof data === "object"
        ? (data.retryAfter ?? data.retry_after ?? data.cooldown)
        : null;

    const numericBodyValue = Number(bodyValue);
    if (Number.isFinite(numericBodyValue) && numericBodyValue > 0) {
      return Math.ceil(numericBodyValue);
    }

    const headerValue = response?.headers?.get("Retry-After");
    const numericHeaderValue = Number(headerValue);
    if (Number.isFinite(numericHeaderValue) && numericHeaderValue > 0) {
      return Math.ceil(numericHeaderValue);
    }

    if (headerValue) {
      const retryDate = Date.parse(headerValue);
      if (!Number.isNaN(retryDate)) {
        return Math.max(1, Math.ceil((retryDate - Date.now()) / 1000));
      }
    }

    return 0;
  }

  function resolveVerificationContext() {
    const params = new URLSearchParams(window.location.search);
    const email = firstNonEmpty(
      body.dataset.email,
      params.get("email"),
      safeSessionGet("verificationEmail"),
      safeSessionGet("userEmail"),
    );
    const challengeId = firstNonEmpty(
      body.dataset.challengeId,
      params.get("challengeId"),
      params.get("challenge"),
      safeSessionGet("verificationChallengeId"),
    );

    return {
      email: sanitizeContextValue(email, 254),
      challengeId: sanitizeContextValue(challengeId, 500),
    };
  }

  function renderUserEmail(email) {
    if (!email) {
      userEmailElement.textContent = "ایمیل ثبت‌شده شما";
      userEmailElement.removeAttribute("title");
      return;
    }

    userEmailElement.textContent = maskEmail(email);
    userEmailElement.title = email;
    userEmailElement.setAttribute("aria-label", `ایمیل مقصد: ${email}`);
  }

  function maskEmail(email) {
    const atIndex = email.lastIndexOf("@");
    if (atIndex <= 0) return email;

    const localPart = email.slice(0, atIndex);
    const domain = email.slice(atIndex + 1);
    const visibleLocal =
      localPart.length <= 2
        ? localPart[0]
        : `${localPart.slice(0, 2)}${"*".repeat(Math.min(4, localPart.length - 2))}`;

    return `${visibleLocal || "*"}@${domain}`;
  }

  function normalizeDigits(value) {
    const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
    const arabicDigits = "٠١٢٣٤٥٦٧٨٩";

    return String(value || "")
      .replace(/[۰-۹]/g, (digit) => String(persianDigits.indexOf(digit)))
      .replace(/[٠-٩]/g, (digit) => String(arabicDigits.indexOf(digit)))
      .replace(/\D/g, "")
      .slice(0, codeInputs.length);
  }

  function clearTemporaryVerificationData() {
    safeSessionRemove("verificationToken");
    safeSessionRemove("verificationChallengeId");
    safeSessionRemove("verificationEmail");
  }

  function safeSessionGet(key) {
    try {
      return window.sessionStorage.getItem(key) || "";
    } catch {
      return "";
    }
  }

  function safeSessionRemove(key) {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // ممکن است sessionStorage در برخی مرورگرها غیرفعال باشد.
    }
  }

  function firstNonEmpty(...values) {
    return (
      values
        .find((value) => typeof value === "string" && value.trim())
        ?.trim() || ""
    );
  }

  function sanitizeContextValue(value, maxLength) {
    return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
  }

  function removeEmptyValues(object) {
    return Object.fromEntries(
      Object.entries(object).filter(
        ([, value]) => value !== "" && value !== null && value !== undefined,
      ),
    );
  }

  function toPositiveInteger(value, fallback) {
    const number = Number.parseInt(value, 10);
    return Number.isFinite(number) && number > 0 ? number : fallback;
  }

  class ApiError extends Error {
    constructor(message, status, data, response) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.data = data;
      this.response = response;
    }
  }
})();
