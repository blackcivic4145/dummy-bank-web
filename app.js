/* ==========================================================================
   DummyBankSystem JS Logic - State Management, SPA Routing, and Simulations
   ========================================================================== */

// 1. DATABASE STATE
const state = {
    accounts: {
        test: {
            ownerName: "テスト タロウ",
            accountNumber: "123-4567-890",
            balance: 1284500,
            transactions: [
                { id: "tx_001", date: "2026-08-10", description: "給与振込（株式会社デモ）", amount: 350000, type: "deposit" },
                { id: "tx_002", date: "2026-08-08", description: "スーパー マルエツ", amount: 5420, type: "withdrawal" },
                { id: "tx_003", date: "2026-08-05", description: "東京電力（電気料金）", amount: 12800, type: "withdrawal" },
                { id: "tx_004", date: "2026-08-01", description: "家賃振込（デモ不動産）", amount: 85000, type: "withdrawal" },
                { id: "tx_005", date: "2026-07-28", description: "セブン銀行ATM お引出し", amount: 30000, type: "withdrawal" },
                { id: "tx_006", date: "2026-07-25", description: "ドトールコーヒー", amount: 650, type: "withdrawal" }
            ],
            savingsAccounts: [
                {
                    id: "sv_001",
                    type: "FIXED",
                    amount: 500000,
                    interestRate: 0.15,
                    termMonths: 12,
                    startDate: "2026-01-15",
                    maturityDate: "2027-01-15",
                    maturityInstruction: "AUTO_RENEW_WITH_INTEREST"
                },
                {
                    id: "sv_002",
                    type: "ACCUMULATION",
                    amount: 120000,
                    monthlyDepositAmount: 10000,
                    depositDay: 25,
                    interestRate: 0.18,
                    termMonths: 24,
                    startDate: "2025-08-25",
                    maturityDate: "2027-08-25",
                    maturityInstruction: "AUTO_CANCEL"
                }
            ],
            twoFactorEmail: null,
            isTwoFactorEnabled: false,
            pending2FACode: null,
            isPayPayLinked: true,
            paypayBalance: 20000
        },
        guest: {
            ownerName: "ゲスト ジロウ",
            accountNumber: "098-7654-321",
            balance: 500000,
            transactions: [
                { id: "tx_g01", date: "2026-08-10", description: "給与振込（株式会社サンプル）", amount: 200000, type: "deposit" },
                { id: "tx_g02", date: "2026-08-07", description: "ファミリーマート", amount: 1200, type: "withdrawal" },
                { id: "tx_g03", date: "2026-08-02", description: "家賃引き落とし", amount: 60000, type: "withdrawal" }
            ],
            savingsAccounts: [
                {
                    id: "sv_g01",
                    type: "FIXED",
                    amount: 100000,
                    interestRate: 0.10,
                    termMonths: 6,
                    startDate: "2026-05-10",
                    maturityDate: "2026-11-10",
                    maturityInstruction: "AUTO_CANCEL"
                }
            ],
            twoFactorEmail: null,
            isTwoFactorEnabled: false,
            pending2FACode: null,
            isPayPayLinked: true,
            paypayBalance: 20000
        }
    },
    currentUser: null,
    currentSavingsTab: "list",
    selectedTermMonths: 12,
    verifiedReceiver: null,
    generatedCode: null,
    timerSeconds: 0,
    timerInterval: null
};

// --- SYNC API HELPERS ---
const API_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.protocol === "file:" ? "http://localhost:8080/api/state" : "/api/state";
let isPushingState = false;

async function fetchStateFromServer() {
    try {
        const res = await fetch(API_URL);
        if (res.ok) {
            const data = await res.json();
            state.accounts = data;
            console.log("State loaded from server successfully.");
        } else {
            throw new Error("Server returned " + res.status);
        }
    } catch (err) {
        console.warn("Could not connect to sync server, using localStorage:", err);
        const localData = localStorage.getItem('dummybank_state');
        if (localData) {
            try {
                state.accounts = JSON.parse(localData);
                console.log("State loaded from localStorage successfully.");
            } catch(e) {
                console.error("Failed to parse localStorage data", e);
            }
        }
    }
    
    // Ensure PayPay is linked and balance is 20000 if not present in loaded state or if it is 0
    for (const key in state.accounts) {
        if (state.accounts[key].isPayPayLinked === undefined || state.accounts[key].isPayPayLinked === false) {
            state.accounts[key].isPayPayLinked = true;
        }
        if (!state.accounts[key].paypayBalance || Number(state.accounts[key].paypayBalance) <= 0) {
            state.accounts[key].paypayBalance = 20000;
        }
    }
}

async function pushStateToServer() {
    isPushingState = true;
    try {
        localStorage.setItem('dummybank_state', JSON.stringify(state.accounts));
    } catch (e) {
        console.warn("Could not save to localStorage", e);
    }
    
    try {
        await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(state.accounts)
        });
        console.log("State pushed to server successfully.");
    } catch (err) {
        console.warn("Could not push state to server:", err);
    } finally {
        isPushingState = false;
    }
}

// 2. DOM ELEMENTS
const screens = {
    login: document.getElementById("login-screen"),
    dashboard: document.getElementById("dashboard-screen"),
    transfer: document.getElementById("transfer-screen"),
    savings: document.getElementById("savings-screen"),
    settings: document.getElementById("settings-screen")
};

// 3. UTILITY FUNCTIONS
function formatCurrency(amount) {
    return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(amount);
}

function formatDate(dateStr) {
    return dateStr.replace(/-/g, "/");
}

function maskEmail(email) {
    if (!email || !email.includes("@")) return email;
    const parts = email.split("@");
    const name = parts[0];
    const domain = parts[1];
    if (name.length <= 2) {
        return `${name[0]}***@${domain}`;
    }
    return `${name.substring(0, 2)}***${name.substring(name.length - 1)}@${domain}`;
}

// 4. ROUTING & UI LIFECYCLE
async function showScreen(screenId) {
    Object.keys(screens).forEach(key => {
        if (key === screenId) {
            screens[key].classList.add("active");
        } else {
            screens[key].classList.remove("active");
        }
    });

    // Reset page states on load
    if (screenId === "dashboard") {
        await fetchStateFromServer();
        updateDashboardView();
    } else if (screenId === "transfer") {
        await fetchStateFromServer();
        resetTransferForm();
    } else if (screenId === "savings") {
        await fetchStateFromServer();
        switchSavingsTab("list");
        updateSavingsView();
    } else if (screenId === "settings") {
        await fetchStateFromServer();
        showSubView("settings-portal-content");
        updateSettingsPortalView();
    }
}

// Overlays and Alerts
function showSuccessOverlay(title, msg) {
    const overlay = document.getElementById("success-overlay");
    document.getElementById("success-overlay-title").innerText = title;
    document.getElementById("success-overlay-message").innerText = msg;
    overlay.classList.remove("hidden");
    setTimeout(() => {
        overlay.classList.add("hidden");
    }, 2200);
}

function showConfirmModal(title, msg, onConfirm) {
    const modal = document.getElementById("confirm-modal");
    document.getElementById("confirm-modal-title").innerText = title;
    document.getElementById("confirm-modal-message").innerText = msg;
    modal.classList.remove("hidden");

    const cancelBtn = document.getElementById("confirm-cancel-btn");
    const okBtn = document.getElementById("confirm-ok-btn");

    const cleanup = () => {
        modal.classList.add("hidden");
        cancelBtn.onclick = null;
        okBtn.onclick = null;
    };

    cancelBtn.onclick = () => cleanup();
    okBtn.onclick = () => {
        onConfirm();
        cleanup();
    };
}

// ==================== 1. LOGIN SCREEN LOGIC ====================
const loginForm = document.getElementById("login-form");
const passwordInput = document.getElementById("login-password");
const togglePasswordBtn = document.getElementById("toggle-password-btn");
const loginErrorBanner = document.getElementById("login-error-banner");

togglePasswordBtn.addEventListener("click", () => {
    if (passwordInput.type === "password") {
        passwordInput.type = "text";
        togglePasswordBtn.innerHTML = '<i class="fa-regular fa-eye-slash"></i>';
    } else {
        passwordInput.type = "password";
        togglePasswordBtn.innerHTML = '<i class="fa-regular fa-eye"></i>';
    }
});

loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const username = document.getElementById("login-username").value.trim().toLowerCase();
    const password = passwordInput.value;

    if ((username === "test" && password === "test") || (username === "guest" && password === "guest")) {
        state.currentUser = username;
        loginErrorBanner.classList.add("hidden");
        loginForm.reset();
        showScreen("dashboard");
    } else {
        loginErrorBanner.classList.remove("hidden");
    }
});

// ==================== 2. DASHBOARD SCREEN LOGIC ====================
document.getElementById("logout-btn").addEventListener("click", () => {
    state.currentUser = null;
    showScreen("login");
});

function updateDashboardView() {
    const acc = state.accounts[state.currentUser];
    const cashCard = document.getElementById("cash-card");
    
    // Add/remove gold card theme based on username
    if (state.currentUser === "test") {
        cashCard.classList.add("gold-style");
    } else {
        cashCard.classList.remove("gold-style");
    }

    document.getElementById("checking-balance").innerText = formatCurrency(acc.balance);
    document.getElementById("card-account-number").innerText = acc.accountNumber;
    document.getElementById("card-owner-name").innerText = acc.ownerName;

    const paypayContainer = document.getElementById("dashboard-paypay-container");
    if (paypayContainer) {
        if (acc.isPayPayLinked) {
            document.getElementById("dashboard-paypay-balance").innerText = formatCurrency(acc.paypayBalance || 0);
            paypayContainer.classList.remove("hidden");
        } else {
            paypayContainer.classList.add("hidden");
        }
    }

    // Render transactions list
    const txList = document.getElementById("transaction-list");
    txList.innerHTML = "";
    
    // Render top 5
    const latestTx = acc.transactions.slice(0, 5);
    latestTx.forEach(tx => {
        const row = document.createElement("div");
        row.className = "tx-row";
        
        const isDeposit = tx.type === "deposit";
        const iconClass = isDeposit ? "fa-solid fa-arrow-down" : "fa-solid fa-arrow-up";
        const iconBoxClass = isDeposit ? "deposit" : "withdrawal";
        const sign = isDeposit ? "+" : "-";

        row.innerHTML = `
            <div class="tx-row-left">
                <div class="tx-icon-box ${iconBoxClass}">
                    <i class="${iconClass}"></i>
                </div>
                <div class="tx-meta">
                    <span class="tx-title">${tx.description}</span>
                    <span class="tx-date">${formatDate(tx.date)}</span>
                </div>
            </div>
            <span class="tx-amount ${tx.type}">${sign}${formatCurrency(tx.amount)}</span>
        `;
        txList.appendChild(row);
    });
}

// Menu grid navigation
document.getElementById("menu-transfer-btn").addEventListener("click", () => showScreen("transfer"));
document.getElementById("menu-savings-btn").addEventListener("click", () => showScreen("savings"));
document.getElementById("menu-settings-btn").addEventListener("click", () => showScreen("settings"));
document.getElementById("menu-loans-btn").addEventListener("click", () => {
    alert("「カードローン」機能はデモ用のため準備中です。");
});
document.getElementById("menu-paypay-charge-btn").addEventListener("click", () => handlePayPayClick("charge"));
document.getElementById("menu-paypay-withdraw-btn").addEventListener("click", () => handlePayPayClick("withdraw"));
document.getElementById("menu-paypay-send-btn").addEventListener("click", () => handlePayPayClick("send"));

let pendingPayPayAction = null;

async function handlePayPayClick(action) {
    const acc = state.accounts[state.currentUser];
    pendingPayPayAction = action;
    if (acc.isPayPayLinked) {
        await proceedToPayPayScreen(action);
    } else {
        showErrorOverlay("未連携", "各種お手続きからPayPay連携を行ってください。");
    }
}

document.getElementById("settings-paypay-item").addEventListener("click", () => {
    const acc = state.accounts[state.currentUser];
    if (acc.isPayPayLinked) {
        document.getElementById("paypay-unlink-prompt").classList.remove("hidden");
        document.getElementById("paypay-unlink-loading").classList.add("hidden");
        document.getElementById("paypay-unlink-modal").classList.remove("hidden");
    } else {
        pendingPayPayAction = "settings";
        document.getElementById("paypay-link-prompt").classList.remove("hidden");
        document.getElementById("paypay-link-loading").classList.add("hidden");
        document.getElementById("paypay-link-modal").classList.remove("hidden");
    }
});

document.getElementById("confirm-paypay-unlink-btn").addEventListener("click", async () => {
    document.getElementById("paypay-unlink-prompt").classList.add("hidden");
    document.getElementById("paypay-unlink-loading").classList.remove("hidden");
    
    setTimeout(async () => {
        state.accounts[state.currentUser].isPayPayLinked = false;
        await pushStateToServer();
        document.getElementById("paypay-unlink-modal").classList.add("hidden");
        if (typeof updateSettingsPortalView === "function") {
            updateSettingsPortalView();
        }
        showSuccessOverlay("連携解除", "PayPayアカウントの連携を解除しました。");
    }, 1000);
});

async function proceedToPayPayScreen(action) {
    await fetchStateFromServer(); // Refresh state to ensure latest balances
    const acc = state.accounts[state.currentUser];
    if (action === "charge") {
        document.getElementById("charge-current-paypay-balance").innerText = formatCurrency(acc.paypayBalance || 0);
        document.getElementById("paypay-charge-amount").value = "";
        document.getElementById("paypay-charge-error").classList.add("hidden");
        showScreen("paypay-charge");
    } else if (action === "withdraw") {
        document.getElementById("withdraw-current-paypay-balance").innerText = formatCurrency(acc.paypayBalance || 0);
        document.getElementById("paypay-withdraw-amount").value = "";
        document.getElementById("paypay-withdraw-error").classList.add("hidden");
        showScreen("paypay-withdraw");
    } else if (action === "send") {
        document.getElementById("send-current-paypay-balance").innerText = formatCurrency(acc.paypayBalance || 0);
        document.getElementById("paypay-send-receiver").value = "";
        document.getElementById("paypay-send-amount").value = "";
        document.getElementById("paypay-send-error").classList.add("hidden");
        showScreen("paypay-send");
    }
}

document.getElementById("cancel-paypay-link-btn").addEventListener("click", () => {
    document.getElementById("paypay-link-modal").classList.add("hidden");
    pendingPayPayAction = null;
});

document.getElementById("confirm-paypay-link-btn").addEventListener("click", async () => {
    document.getElementById("paypay-link-prompt").classList.add("hidden");
    document.getElementById("paypay-link-loading").classList.remove("hidden");
    
    setTimeout(async () => {
        state.accounts[state.currentUser].isPayPayLinked = true;
        await pushStateToServer();
        document.getElementById("paypay-link-modal").classList.add("hidden");
        if (pendingPayPayAction && pendingPayPayAction !== "settings") {
            await proceedToPayPayScreen(pendingPayPayAction);
        } else {
            if (typeof updateSettingsPortalView === "function") {
                updateSettingsPortalView();
            }
            showSuccessOverlay("連携完了", "PayPayアカウントの連携が完了しました。");
        }
    }, 1000);
});

document.getElementById("close-paypay-modal-btn").addEventListener("click", () => {
    document.getElementById("paypay-balance-modal").classList.add("hidden");
});

document.getElementById("paypay-charge-back-btn").addEventListener("click", () => showScreen("dashboard"));
document.getElementById("paypay-withdraw-back-btn").addEventListener("click", () => showScreen("dashboard"));

document.getElementById("paypay-charge-submit-btn").addEventListener("click", async () => {
    const amount = parseInt(document.getElementById("paypay-charge-amount").value, 10);
    const errObj = document.getElementById("paypay-charge-error");
    if (!amount || amount <= 0) {
        errObj.innerText = "正しい金額を入力してください。";
        errObj.classList.remove("hidden");
        return;
    }
    const acc = state.accounts[state.currentUser];
    if (acc.balance < amount) {
        errObj.innerText = "銀行口座の残高が不足しています。";
        errObj.classList.remove("hidden");
        return;
    }
    errObj.classList.add("hidden");
    const submitBtn = document.getElementById("paypay-charge-submit-btn");
    submitBtn.disabled = true;
    submitBtn.innerText = "処理中...";
    
    setTimeout(async () => {
        submitBtn.disabled = false;
        submitBtn.innerText = "チャージする";
        
        const acc = state.accounts[state.currentUser];
        acc.balance -= amount;
        acc.paypayBalance = (acc.paypayBalance || 0) + amount;
        acc.transactions.unshift({
            id: `txn-${Date.now()}`,
            date: new Date().toISOString().split("T")[0],
            description: "PayPayチャージ",
            amount: amount,
            type: "withdrawal"
        });
        
        await pushStateToServer();
        
        showScreen("dashboard");
        showSuccessOverlay("チャージ完了", `${formatCurrency(amount)} をPayPayにチャージしました。`);
    }, 1000);
});

document.getElementById("paypay-withdraw-submit-btn").addEventListener("click", async () => {
    const amount = parseInt(document.getElementById("paypay-withdraw-amount").value, 10);
    const errObj = document.getElementById("paypay-withdraw-error");
    if (!amount || amount <= 0) {
        errObj.innerText = "正しい金額を入力してください。";
        errObj.classList.remove("hidden");
        return;
    }
    const acc = state.accounts[state.currentUser];
    if ((acc.paypayBalance || 0) < amount) {
        errObj.innerText = "PayPay残高が不足しています。";
        errObj.classList.remove("hidden");
        return;
    }
    errObj.classList.add("hidden");
    const submitBtn = document.getElementById("paypay-withdraw-submit-btn");
    submitBtn.disabled = true;
    submitBtn.innerText = "処理中...";
    
    setTimeout(async () => {
        submitBtn.disabled = false;
        submitBtn.innerText = "銀行口座へ出金する";
        
        const acc = state.accounts[state.currentUser];
        acc.balance += amount;
        acc.paypayBalance -= amount;
        acc.transactions.unshift({
            id: `txn-${Date.now()}`,
            date: new Date().toISOString().split("T")[0],
            description: "PayPay出金",
            amount: amount,
            type: "deposit"
        });
        
        await pushStateToServer();
        
        showScreen("dashboard");
        showSuccessOverlay("出金完了", `${formatCurrency(amount)} を銀行口座へ出金しました。`);
    }, 1000);
});

document.getElementById("paypay-send-back-btn").addEventListener("click", () => showScreen("dashboard"));

document.getElementById("paypay-send-submit-btn").addEventListener("click", async () => {
    const receiverId = document.getElementById("paypay-send-receiver").value.trim();
    const amount = parseInt(document.getElementById("paypay-send-amount").value, 10);
    const errObj = document.getElementById("paypay-send-error");
    if (!receiverId) {
        errObj.innerText = "送金先を入力してください。";
        errObj.classList.remove("hidden");
        return;
    }
    if (!amount || amount <= 0) {
        errObj.innerText = "正しい金額を入力してください。";
        errObj.classList.remove("hidden");
        return;
    }
    const acc = state.accounts[state.currentUser];
    if ((acc.paypayBalance || 0) < amount) {
        errObj.innerText = "PayPay残高が不足しています。";
        errObj.classList.remove("hidden");
        return;
    }
    errObj.classList.add("hidden");
    const submitBtn = document.getElementById("paypay-send-submit-btn");
    submitBtn.disabled = true;
    submitBtn.innerText = "処理中...";
    
    setTimeout(async () => {
        submitBtn.disabled = false;
        submitBtn.innerText = "送金する";
        
        const acc = state.accounts[state.currentUser];
        acc.paypayBalance -= amount;
        acc.transactions.unshift({
            id: `txn-${Date.now()}`,
            date: new Date().toISOString().split("T")[0],
            description: `PayPay送金 (${receiverId})`,
            amount: amount,
            type: "withdrawal"
        });
        
        await pushStateToServer();
        
        showScreen("dashboard");
        showSuccessOverlay("送金完了", `${formatCurrency(amount)} を送金しました。`);
    }, 1000);
});

// ==================== 3. TRANSFER SCREEN LOGIC ====================
document.getElementById("transfer-back-btn").addEventListener("click", () => showScreen("dashboard"));

function resetTransferForm() {
    const acc = state.accounts[state.currentUser];
    document.getElementById("transfer-owner-info").innerText = `${acc.ownerName} (${acc.accountNumber})`;
    document.getElementById("transfer-available-balance").innerText = formatCurrency(acc.balance);
    
    document.getElementById("transfer-form").reset();
    document.getElementById("verified-receiver-card").classList.add("hidden");
    document.getElementById("transfer-amount").disabled = true;
    document.getElementById("transfer-submit-btn").disabled = true;
    document.getElementById("transfer-error-banner").classList.add("hidden");
    state.verifiedReceiver = null;
}

// Account lookup verification
document.getElementById("verify-account-btn").addEventListener("click", () => {
    const bank = document.getElementById("transfer-bank").value;
    const branch = document.getElementById("transfer-branch").value.trim();
    const accType = document.getElementById("transfer-account-type").value;
    const accNumRaw = document.getElementById("transfer-account-number").value.trim();
    const accNum = accNumRaw.replace(/-/g, "");

    const errorBanner = document.getElementById("transfer-error-banner");
    const errorMsg = document.getElementById("transfer-error-message");
    const verifiedCard = document.getElementById("verified-receiver-card");
    const amountInput = document.getElementById("transfer-amount");
    const submitBtn = document.getElementById("transfer-submit-btn");

    errorBanner.classList.add("hidden");
    verifiedCard.classList.add("hidden");
    amountInput.disabled = true;
    submitBtn.disabled = true;
    state.verifiedReceiver = null;

    if (!branch || branch.length !== 3) {
        errorMsg.innerText = "支店コードは3桁の数字で入力してください。";
        errorBanner.classList.remove("hidden");
        return;
    }
    if (!accNum) {
        errorMsg.innerText = "口座番号を入力してください。";
        errorBanner.classList.remove("hidden");
        return;
    }

    // Look for a match in other accounts
    let receiver = null;
    let receiverKey = null;
    Object.keys(state.accounts).forEach(key => {
        if (key !== state.currentUser) {
            const checking = state.accounts[key];
            const cleanAcc = checking.accountNumber.replace(/-/g, "");
            if (cleanAcc === accNum && checking.branchCode === branch) { // wait, Kotlin code checkAccount matches bankCode too, but here we just check cleanAccount match
                // For simulator simplicity, we will match if cleanAccountNumber matches
                receiver = checking;
                receiverKey = key;
            }
        }
    });

    // Fallback search check: let's match guest/test details directly
    if (!receiver) {
        const otherUserKey = state.currentUser === "test" ? "guest" : "test";
        const otherAcc = state.accounts[otherUserKey];
        const otherClean = otherAcc.accountNumber.replace(/-/g, "");
        if (otherClean === accNum) {
            receiver = otherAcc;
            receiverKey = otherUserKey;
        }
    }

    if (receiver) {
        state.verifiedReceiver = {
            ownerName: receiver.ownerName,
            accountNumber: receiver.accountNumber,
            userKey: receiverKey
        };
        document.getElementById("verified-receiver-name").innerText = `${receiver.ownerName} 様`;
        verifiedCard.classList.remove("hidden");
        amountInput.disabled = false;
        submitBtn.disabled = false;
    } else {
        errorMsg.innerText = "該当する口座が見つかりませんでした。口座番号と支店コードをお確かめください。";
        errorBanner.classList.remove("hidden");
    }
});

// Transfer submission
async function executeTransfer(sender, receiver, amount) {
    // Process balances
    sender.balance -= amount;
    receiver.balance += amount;

    // Log transactions
    const now = new Date().toISOString().split("T")[0];
    const txIdSender = "tx_" + Math.random().toString(36).substring(2, 10);
    const txIdRec = "tx_" + Math.random().toString(36).substring(2, 10);

    sender.transactions.unshift({
        id: txIdSender,
        date: now,
        description: `振込（${receiver.ownerName}）`,
        amount: amount,
        type: "withdrawal"
    });

    receiver.transactions.unshift({
        id: txIdRec,
        date: now,
        description: `振込受入（${sender.ownerName}）`,
        amount: amount,
        type: "deposit"
    });

    await pushStateToServer();
    showSuccessOverlay("振込完了", `${receiver.ownerName} 様へ\n${formatCurrency(amount)} のお振込が完了しました。`);
    setTimeout(() => {
        showScreen("dashboard");
    }, 2200);
}

document.getElementById("transfer-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const amount = parseInt(document.getElementById("transfer-amount").value, 10);
    const sender = state.accounts[state.currentUser];
    const receiver = state.accounts[state.verifiedReceiver.userKey];

    const errorBanner = document.getElementById("transfer-error-banner");
    const errorMsg = document.getElementById("transfer-error-message");

    if (amount <= 0) {
        errorMsg.innerText = "振込金額は1円以上を指定してください。";
        errorBanner.classList.remove("hidden");
        return;
    }

    if (sender.balance < amount) {
        errorMsg.innerText = "残高が不足しています。";
        errorBanner.classList.remove("hidden");
        return;
    }

    // Execute actual transfer
    await executeTransfer(sender, receiver, amount);
});

// ==================== 4. SAVINGS SCREEN LOGIC ====================
document.getElementById("savings-back-btn").addEventListener("click", () => showScreen("dashboard"));

function switchSavingsTab(tab) {
    state.currentSavingsTab = tab;
    const tabList = document.getElementById("savings-tab-list");
    const tabApply = document.getElementById("savings-tab-apply");
    const listContent = document.getElementById("savings-list-content");
    const applyContent = document.getElementById("savings-apply-content");

    if (tab === "list") {
        tabList.classList.add("active");
        tabApply.classList.remove("active");
        listContent.classList.add("active-content");
        applyContent.classList.remove("active-content");
    } else {
        tabList.classList.remove("active");
        tabApply.classList.add("active");
        listContent.classList.remove("active-content");
        applyContent.classList.add("active-content");
        resetSavingsApplyForm();
    }
}

document.getElementById("savings-tab-list").addEventListener("click", () => switchSavingsTab("list"));
document.getElementById("savings-tab-apply").addEventListener("click", () => switchSavingsTab("apply"));
document.getElementById("savings-apply-shortcut-btn").addEventListener("click", () => switchSavingsTab("apply"));

// Refresh list view
function updateSavingsView() {
    const acc = state.accounts[state.currentUser];
    const totalSavings = acc.savingsAccounts.reduce((sum, item) => sum + item.amount, 0);
    
    document.getElementById("savings-total-balance").innerText = formatCurrency(totalSavings);
    document.getElementById("savings-account-count").innerText = `保有口座数: ${acc.savingsAccounts.length}口`;

    const listContainer = document.getElementById("savings-account-list");
    listContainer.innerHTML = "";

    if (acc.savingsAccounts.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-savings">
                <i class="fa-solid fa-wallet empty-icon"></i>
                <p>現在、定期・積立のご契約はありません。</p>
                <button type="button" id="savings-empty-start-btn" class="btn primary-btn">新規お申し込み</button>
            </div>
        `;
        document.getElementById("savings-empty-start-btn").onclick = () => switchSavingsTab("apply");
        return;
    }

    acc.savingsAccounts.forEach(sa => {
        const card = document.createElement("div");
        card.className = "savings-item-card";
        
        const isFixed = sa.type === "FIXED";
        const badgeText = isFixed ? "定期" : "積立";
        const badgeClass = isFixed ? "fixed" : "acc";
        const title = isFixed ? "定期預金" : "積立定期預金";
        
        const instructionLabel = {
            AUTO_RENEW_WITH_INTEREST: "元利自動継続",
            AUTO_RENEW_PRINCIPAL_ONLY: "元金自動継続",
            AUTO_CANCEL: "自動解約"
        }[sa.maturityInstruction];

        let accSpecificRows = "";
        if (!isFixed && sa.monthlyDepositAmount) {
            accSpecificRows = `
                <div class="detail-row">
                    <span class="label">毎月の積立額</span>
                    <span class="value">${formatCurrency(sa.monthlyDepositAmount)}</span>
                </div>
                <div class="detail-row">
                    <span class="label">振替指定日</span>
                    <span class="value">毎月 ${sa.depositDay} 日</span>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="savings-item-header" data-id="${sa.id}">
                <div class="savings-title-area">
                    <span class="savings-type-badge ${badgeClass}">${badgeText}</span>
                    <div class="savings-title-meta">
                        <span class="savings-title">${title}</span>
                        <span class="savings-maturity-label">満期日: ${formatDate(sa.maturityDate)}</span>
                    </div>
                </div>
                <div class="savings-amount-col">
                    <span class="savings-card-amount">${formatCurrency(sa.amount)}</span>
                    <i class="fa-solid fa-chevron-down arrow-icon-rotatable"></i>
                </div>
            </div>
            <div class="savings-item-body" id="detail-body-${sa.id}">
                <div class="detail-row">
                    <span class="label">適用金利 (年利)</span>
                    <span class="value">${sa.interestRate}%</span>
                </div>
                <div class="detail-row">
                    <span class="label">預入期間</span>
                    <span class="value">${sa.termMonths}ヶ月</span>
                </div>
                <div class="detail-row">
                    <span class="label">預入開始日</span>
                    <span class="value">${formatDate(sa.startDate)}</span>
                </div>
                <div class="detail-row">
                    <span class="label">満期時の取扱</span>
                    <span class="value">${instructionLabel}</span>
                </div>
                ${accSpecificRows}
                <div class="liquidate-btn-wrapper">
                    <button type="button" class="btn danger-btn btn-full liquidate-account-btn" data-id="${sa.id}">この口座を解約する</button>
                </div>
            </div>
        `;

        listContainer.appendChild(card);
    });

    // Accordion Toggle
    const headers = listContainer.querySelectorAll(".savings-item-header");
    headers.forEach(header => {
        header.addEventListener("click", () => {
            const id = header.dataset.id;
            const body = document.getElementById(`detail-body-${id}`);
            const arrow = header.querySelector(".arrow-icon-rotatable");
            
            const isOpen = body.classList.contains("active");
            if (isOpen) {
                body.classList.remove("active");
                arrow.classList.remove("rotated");
            } else {
                body.classList.add("active");
                arrow.classList.add("rotated");
            }
        });
    });

    // Liquidation Bind
    const cancelBtns = listContainer.querySelectorAll(".liquidate-account-btn");
    cancelBtns.forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const sa = acc.savingsAccounts.find(x => x.id === id);
            const title = sa.type === "FIXED" ? "定期預金" : "積立定期預金";

            showConfirmModal(
                "定期・積立の解約",
                `この${title}（残高: ${formatCurrency(sa.amount)}）を中途解約しますか？資金は即座に普通預金口座に戻されます。`,
                async () => {
                    // Update checking balance
                    acc.balance += sa.amount;
                    
                    // Create transaction log
                    const now = new Date().toISOString().split("T")[0];
                    const label = sa.type === "FIXED" ? "定期解約" : "積立解約";
                    acc.transactions.unshift({
                        id: "tx_" + Math.random().toString(36).substring(2, 10),
                        date: now,
                        description: `${label}（元金払戻）`,
                        amount: sa.amount,
                        type: "deposit"
                    });

                    // Remove savings contract
                    acc.savingsAccounts = acc.savingsAccounts.filter(x => x.id !== id);

                    await pushStateToServer();
                    showSuccessOverlay("解約完了", "口座が解約され、資金が普通預金に払い戻されました。");
                    updateSavingsView();
                }
            );
        });
    });
}

// Savings Form setup
const typeFixedRadio = document.querySelector('input[value="FIXED"]');
const typeAccRadio = document.querySelector('input[value="ACCUMULATION"]');
const fixedAmountGroup = document.getElementById("savings-fixed-group");
const accAmountGroup = document.getElementById("savings-acc-group");

// Handle type card clicks
document.getElementById("type-fixed-label").addEventListener("click", () => {
    document.getElementById("type-fixed-label").classList.add("selected");
    document.getElementById("type-acc-label").classList.remove("selected");
    typeFixedRadio.checked = true;
    fixedAmountGroup.classList.remove("hidden");
    accAmountGroup.classList.add("hidden");
    document.getElementById("savings-error-banner").classList.add("hidden");
});

document.getElementById("type-acc-label").addEventListener("click", () => {
    document.getElementById("type-acc-label").classList.add("selected");
    document.getElementById("type-fixed-label").classList.remove("selected");
    typeAccRadio.checked = true;
    fixedAmountGroup.classList.add("hidden");
    accAmountGroup.classList.remove("hidden");
    document.getElementById("savings-error-banner").classList.add("hidden");
});

// Term selectors and Interest rate calculations
const termChips = document.querySelectorAll(".term-chip");
termChips.forEach(chip => {
    chip.addEventListener("click", () => {
        termChips.forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        state.selectedTermMonths = parseInt(chip.dataset.months, 10);
        updateInterestRateDisplay();
    });
});

function updateInterestRateDisplay() {
    const rateText = document.getElementById("savings-interest-rate");
    const rate = {
        6: "0.10%",
        12: "0.15%",
        24: "0.18%",
        36: "0.20%",
        60: "0.25%"
    }[state.selectedTermMonths] || "0.10%";
    rateText.innerText = rate;
}

function resetSavingsApplyForm() {
    const acc = state.accounts[state.currentUser];
    document.getElementById("savings-source-balance").innerText = formatCurrency(acc.balance);
    document.getElementById("savings-apply-form").reset();

    // Reset selectors
    document.getElementById("type-fixed-label").click();
    termChips.forEach(c => c.classList.remove("active"));
    document.querySelector('.term-chip[data-months="12"]').classList.add("active");
    state.selectedTermMonths = 12;
    updateInterestRateDisplay();

    document.getElementById("savings-error-banner").classList.add("hidden");
}

// Form Submission
document.getElementById("savings-apply-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const type = document.querySelector('input[name="savings-type"]:checked').value;
    const acc = state.accounts[state.currentUser];
    const errorBanner = document.getElementById("savings-error-banner");
    const errorMsg = document.getElementById("savings-error-message");

    errorBanner.classList.add("hidden");

    let finalAmount = 0;
    let monthlyAmount = null;
    let depositDay = null;
    let deductionAmount = 0;

    const rate = parseFloat({
        6: 0.10,
        12: 0.15,
        24: 0.18,
        36: 0.20,
        60: 0.25
    }[state.selectedTermMonths]);

    if (type === "FIXED") {
        finalAmount = parseInt(document.getElementById("savings-fixed-amount").value, 10);
        deductionAmount = finalAmount;

        if (isNaN(finalAmount) || finalAmount <= 0) {
            errorMsg.innerText = "正しい預入金額を入力してください。";
            errorBanner.classList.remove("hidden");
            return;
        }
    } else {
        monthlyAmount = parseInt(document.getElementById("savings-acc-monthly").value, 10);
        const targetAmountInput = parseInt(document.getElementById("savings-acc-target").value, 10);
        depositDay = parseInt(document.getElementById("savings-acc-day").value, 10);
        
        deductionAmount = monthlyAmount;
        finalAmount = !isNaN(targetAmountInput) && targetAmountInput > 0 ? targetAmountInput : monthlyAmount;

        if (isNaN(monthlyAmount) || monthlyAmount <= 0) {
            errorMsg.innerText = "正しい毎月の積立額を入力してください。";
            errorBanner.classList.remove("hidden");
            return;
        }
    }

    if (acc.balance < deductionAmount) {
        errorMsg.innerText = "普通預金口座の残高が不足しています。";
        errorBanner.classList.remove("hidden");
        return;
    }

    // Process creation
    acc.balance -= deductionAmount;

    // Dates
    const now = new Date();
    const nowStr = now.toISOString().split("T")[0];
    now.setMonth(now.getMonth() + state.selectedTermMonths);
    const maturityStr = now.toISOString().split("T")[0];

    const instruction = document.getElementById("savings-instruction").value;

    const newSA = {
        id: "sv_" + Math.random().toString(36).substring(2, 10),
        type: type,
        amount: finalAmount,
        monthlyDepositAmount: monthlyAmount,
        depositDay: depositDay,
        interestRate: rate,
        termMonths: state.selectedTermMonths,
        startDate: nowStr,
        maturityDate: maturityStr,
        maturityInstruction: instruction
    };

    // Log transaction
    const txLabel = type === "FIXED" ? "定期預入" : "積立新規";
    acc.transactions.unshift({
        id: "tx_" + Math.random().toString(36).substring(2, 10),
        date: nowStr,
        description: `${txLabel}（金利 ${rate}%）`,
        amount: deductionAmount,
        type: "withdrawal"
    });

    acc.savingsAccounts.push(newSA);

    await pushStateToServer();
    showSuccessOverlay("お申し込み完了", `${type === "FIXED" ? "定期預金" : "積立定期預金"}を開設しました。\n初回差引金額: ${formatCurrency(deductionAmount)}`);
    
    setTimeout(() => {
        switchSavingsTab("list");
        updateSavingsView();
    }, 2200);
});

// ==================== 5. SETTINGS SCREEN LOGIC ====================
document.getElementById("settings-back-btn").addEventListener("click", () => showScreen("dashboard"));

function showSubView(viewId) {
    const views = document.querySelectorAll(".sub-screen-view");
    views.forEach(v => {
        if (v.id === viewId) {
            v.classList.add("active-view");
        } else {
            v.classList.remove("active-view");
        }
    });
}

function updateSettingsPortalView() {
    const acc = state.accounts[state.currentUser];
    const statusText = document.getElementById("settings-2fa-status");
    
    if (acc.isTwoFactorEnabled && acc.twoFactorEmail) {
        statusText.innerText = `設定済 (${maskEmail(acc.twoFactorEmail)})`;
        statusText.classList.add("active-status");
    } else {
        statusText.innerText = "未設定";
        statusText.classList.remove("active-status");
    }
    
    const paypayStatusText = document.getElementById("settings-paypay-status");
    if (paypayStatusText) {
        if (acc.isPayPayLinked) {
            paypayStatusText.innerText = `連携済み (残高: ${formatCurrency(acc.paypayBalance || 0)})`;
            paypayStatusText.classList.add("active-status");
        } else {
            paypayStatusText.innerText = "未連携 (アカウントを連携する)";
            paypayStatusText.classList.remove("active-status");
        }
    }
}

// Wire settings portal click
document.getElementById("settings-2fa-item").addEventListener("click", () => {
    showSubView("settings-2fa-view");
    updateTwoFactorSetupView();
});

document.getElementById("settings-2fa-back-btn").addEventListener("click", () => {
    showSubView("settings-2fa-content");
    showScreen("settings");
});

function updateTwoFactorSetupView() {
    const acc = state.accounts[state.currentUser];
    const activeCard = document.getElementById("two-factor-active-card");
    const setupForm = document.getElementById("two-factor-setup-form-container");

    // Reset values
    document.getElementById("two-factor-email-input").value = "";
    document.getElementById("two-factor-code").value = "";
    document.getElementById("two-factor-code-section").classList.add("hidden");
    document.getElementById("two-factor-error-banner").classList.add("hidden");
    document.getElementById("send-2fa-code-btn").disabled = false;
    document.getElementById("send-2fa-code-btn").innerText = "コード送信";
    state.generatedCode = null;
    state.timerSeconds = 0;
    if (state.timerInterval) clearInterval(state.timerInterval);

    if (acc.isTwoFactorEnabled && acc.twoFactorEmail) {
        activeCard.classList.remove("hidden");
        setupForm.classList.add("hidden");
        document.getElementById("two-factor-registered-phone").innerText = `登録メールアドレス: ${maskEmail(acc.twoFactorEmail)}`;
    } else {
        activeCard.classList.add("hidden");
        setupForm.classList.remove("hidden");
    }
}

// 2FA Email Code dispatch simulator
document.getElementById("send-2fa-code-btn").addEventListener("click", () => {
    const email = document.getElementById("two-factor-email-input").value.trim();
    const errorBanner = document.getElementById("two-factor-error-banner");
    const errorMsg = document.getElementById("two-factor-error-message");

    errorBanner.classList.add("hidden");

    if (!email || !email.includes("@")) {
        errorMsg.innerText = "正しいメールアドレスを入力してください。";
        errorBanner.classList.remove("hidden");
        return;
    }

    // Generate random code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    state.generatedCode = code;

    // Generate and download mock email file
    const emailContent = `To: ${email}\nFrom: security@dummybank.com\nSubject: 【DummyBank】2段階認証コード\n\nあなたの認証コードは以下の通りです。\n[ ${code} ]\n\nこのコードの有効期限は3分です。`;
    const blob = new Blob([emailContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "email_from_dummybank.txt";
    a.click();
    URL.revokeObjectURL(url);

    showSuccessOverlay("メール送信完了", "認証コードが記載されたファイルがダウンロードされました。ファイルを開き、記載されたコードを入力してください。");

    // Setup input code section
    document.getElementById("two-factor-code-section").classList.remove("hidden");
    document.getElementById("two-factor-timer-seconds").innerText = "60";
    
    const sendBtn = document.getElementById("send-2fa-code-btn");
    sendBtn.disabled = true;
    state.timerSeconds = 60;
    
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
        state.timerSeconds--;
        document.getElementById("two-factor-timer-seconds").innerText = state.timerSeconds;
        sendBtn.innerText = `再送 (${state.timerSeconds}秒)`;
        
        if (state.timerSeconds <= 0) {
            clearInterval(state.timerInterval);
            sendBtn.disabled = false;
            sendBtn.innerText = "再送信";
        }
    }, 1000);
});



// Submit verification code
document.getElementById("two-factor-setup-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const codeInput = document.getElementById("two-factor-code").value.trim();
    const phoneInput = document.getElementById("two-factor-email-input").value.trim();
    const errorBanner = document.getElementById("two-factor-error-banner");
    const errorMsg = document.getElementById("two-factor-error-message");

    errorBanner.classList.add("hidden");

    if (codeInput !== state.generatedCode) {
        errorMsg.innerText = "認証コードが一致しません。正しいコードを入力してください。";
        errorBanner.classList.remove("hidden");
        return;
    }

    // Enable 2FA
    const acc = state.accounts[state.currentUser];
    acc.isTwoFactorEnabled = true;
    acc.twoFactorEmail = phoneInput;

    await pushStateToServer();
    showSuccessOverlay("2段階認証完了", "2段階認証（メール）を設定しました。");
    
    setTimeout(() => {
        showScreen("settings");
    }, 2200);
});

// Disable 2FA
document.getElementById("disable-2fa-btn").addEventListener("click", () => {
    showConfirmModal(
        "2段階認証の解除",
        "本当に2段階認証を解除しますか？解除するとアカウントのセキュリティ強度が低下します。",
        async () => {
            const acc = state.accounts[state.currentUser];
            acc.isTwoFactorEnabled = false;
            acc.twoFactorEmail = null;

            await pushStateToServer();
            showSuccessOverlay("解除完了", "2段階認証設定を解除しました。");
            setTimeout(() => {
                showScreen("settings");
            }, 2200);
        }
    );
});

// --- PERIODIC BACKGROUND AUTOMATIC SYNCHRONIZATION ---
setInterval(async () => {
    if (state.currentUser && !isPushingState) {
        const oldStateStr = JSON.stringify(state.accounts);
        await fetchStateFromServer();



        const newStateStr = JSON.stringify(state.accounts);

        // If data has changed, re-render the active screen dynamically
        if (oldStateStr !== newStateStr) {
            console.log("Sync Server: State change detected! Re-rendering active view...");
            const activeScreen = Object.keys(screens).find(key => screens[key].classList.contains("active"));
            
            if (activeScreen === "dashboard") {
                updateDashboardView();
            } else if (activeScreen === "savings") {
                if (state.currentSavingsTab === "list") {
                    updateSavingsView();
                } else {
                    const acc = state.accounts[state.currentUser];
                    document.getElementById("savings-source-balance").innerText = formatCurrency(acc.balance);
                }
            } else if (activeScreen === "transfer") {
                const acc = state.accounts[state.currentUser];
                document.getElementById("transfer-available-balance").innerText = formatCurrency(acc.balance);
            } else if (activeScreen === "settings") {
                const activeSubView = document.querySelector(".sub-screen-view.active-view");
                if (activeSubView && activeSubView.id === "settings-2fa-view") {
                    updateTwoFactorSetupView();
                }
                updateSettingsPortalView();
            }
        }
    }
}, 3000);

