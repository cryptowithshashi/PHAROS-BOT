const chalk = require("chalk").default || require("chalk");
const path = require("path");
const fs = require("fs");
const readline = require("readline");
const service = require("./service");

// ---- MENU OPTIONS (Clean, No Emojis) ----
const menuOptions = [
  { label: "Account Login", value: "accountLogin" },
  { label: "Account Check-in", value: "accountCheckIn" },
  { label: "Account Check", value: "accountCheck" },
  { label: "Claim Faucet PHRS", value: "accountClaimFaucet" },
  { label: "Claim Faucet USDC", value: "claimFaucetUSDC" },
  { label: "Swap PHRS to USDC", value: "performSwapUSDC" },
  { label: "Swap PHRS to USDT", value: "performSwapUSDT" },
  { label: "Add Liquidity PHRS-USDC", value: "addLpUSDC" },
  { label: "Add Liquidity PHRS-USDT", value: "addLpUSDT" },
  { label: "Random Transfer", value: "randomTransfer" },
  { label: "Social Task", value: "socialTask" },
  { label: "Unlimited Faucet", value: "unlimitedFaucet" },
  { label: "Set Transaction Count", value: "setTransactionCount" },
  { label: "Exit", value: "exit" },
];

// ---- BANNER ----
const asciiBannerLines = [
  "██████╗     ██╗  ██╗     █████╗     ██████╗      ██████╗     ███████╗",
  "██╔══██╗    ██║  ██║    ██╔══██╗    ██╔══██╗    ██╔═══██╗    ██╔════╝",
  "██████╔╝    ███████║    ███████║    ██████╔╝    ██║   ██║    ███████╗",
  "██╔═══╝     ██╔══██║    ██╔══██║    ██╔══██╗    ██║   ██║    ╚════██║",
  "██║         ██║  ██║    ██║  ██║    ██║  ██║    ╚██████╔╝    ███████║",
  "╚═╝         ╚═╝  ╚═╝    ╚═╝  ╚═╝    ╚═╝  ╚═╝     ╚═════╝     ╚══════╝",
  "",
  "       Pharos Testnet Bot v3.0 - Created By crypto with shashi       ",
  "                  LETS FUCK THIS TESTNET                   ",
];

// ---- GLOBAL VARIABLES ----
global.selectedWallets = [];
global.maxTransaction = 5;

// ---- UTILITY FUNCTIONS ----
function loadWalletsFromTxt() {
  const filePath = path.join(__dirname, 'private.txt');
  if (!fs.existsSync(filePath)) {
    console.error('Error: private.txt file not found.');
    process.exit(1);
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');

  // Validate and normalize each line
  function isValidPrivateKey(key) {
    const hex = key.startsWith('0x') ? key.slice(2) : key;
    return /^[0-9A-Fa-f]{64}$/.test(hex);
  }

  const wallets = lines.map((rawKey, index) => {
    let key = rawKey.trim();
    if (!key.startsWith('0x')) {
      key = `0x${key}`;
    }
    if (!isValidPrivateKey(key)) {
      console.warn(`Warning: Line ${index + 1} in private.txt is not a valid private key. Skipping.`);
      return null;
    }
    return {
      name: `wallet${index + 1}`,
      privatekey: key
    };
  }).filter(item => item !== null);

  global.selectedWallets = wallets; // Update global variable
  return wallets;
}

function formatLogMessage(msg) {
  const timestamp = new Date().toLocaleTimeString("en-US", { hour12: false });
  msg = (msg || "").toString().trim();
  if (!msg) return chalk.hex("#CCCCCC")(`[${timestamp}] Empty log`);

  const parts = msg.split("|").map((s) => s?.trim() || "");
  const walletName = parts[0] || "System";

  // Transaction Confirmation or Success (Green)
  if (parts.length >= 3 && (parts[2]?.includes("Confirmed") || parts[2]?.includes("claimed successfully"))) {
    const logParts = parts[2].split(/Confirmed:|claimed successfully:/);
    const message = logParts[0]?.trim() || "";
    const hashPart = logParts[1]?.trim() || "";
    return chalk.green.bold(
      `[${timestamp}] ${walletName.padEnd(25)} | ${message}${hashPart ? "Confirmed: " : "claimed successfully: "}${chalk.greenBright.bold(hashPart || "0.2 PHRS")}`
    );
  }

  // Transaction Initiation (Purple)
  if (
    parts.length >= 2 &&
    (parts[1]?.includes("Initiating") || parts[1]?.includes("Claiming") || parts[1]?.includes("Checking") || parts[1]?.includes("Generating"))
  ) {
    return chalk.hex("#C71585").bold(
      `[${timestamp}] ${walletName.padEnd(25)} | ${parts[1]}`
    );
  }

  // Warnings (Yellow)
  if (parts.length >= 2 && parts[1]?.includes("Warning")) {
    return chalk.yellow.bold(
      `[${timestamp}] ${walletName.padEnd(25)} | ${parts.slice(1).join(" | ")}`
    );
  }

  // Errors (Red)
  if (msg.includes("Error") || msg.includes("Failed")) {
    const errorMsg = parts.length > 2 ? parts.slice(2).join(" | ").replace(/\d{2}:\d{2}:\d{2}\s*\|\s*\d{2}-\d{2}-\d{4}/, "").trim() : msg;
    return chalk.red.bold(
      `[${timestamp}] ${walletName.padEnd(25)} | ${errorMsg}`
    );
  }

  // System Messages (Gray)
  return chalk.hex("#CCCCCC")(
    `[${timestamp}] ${walletName.padEnd(25)} | ${parts.slice(parts.length >= 2 ? 1 : 0).join(" | ") || msg}`
  );
}

const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
function createSpinner(text) {
  let frameIndex = 0;
  let stopped = false;

  const interval = setInterval(() => {
    if (stopped) return;
    process.stdout.write(`\r${chalk.green(spinnerFrames[frameIndex])} ${chalk.greenBright(text)}`);
    frameIndex = (frameIndex + 1) % spinnerFrames.length;
  }, 100);

  return {
    stop: () => {
      stopped = true;
      clearInterval(interval);
      process.stdout.write("\r\x1b[K"); // Clear line
    },
  };
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function requestInput(promptText, type = "text", defaultValue = "") {
  return new Promise((resolve) => {
    rl.question(chalk.greenBright(`${promptText}${defaultValue ? ` [${defaultValue}]` : ""}: `), (value) => {
      if (type === "number") value = Number(value);
      if (value === "" || (type === "number" && isNaN(value))) value = defaultValue;
      resolve(value);
    });
  });
}

function displayBanner() {
  console.clear();
  console.log(chalk.hex("#D8BFD8").bold(asciiBannerLines.join("\n")));
  console.log();
}

function displayMenu() {
  console.log(chalk.blueBright.bold("\n>═══ Pharos Testnet Bot Menu ═══<"));
  menuOptions.forEach((opt, idx) => {
    const optionNumber = `${idx + 1}`.padStart(2, '0'); // Two-digit numbering
    console.log(chalk.blue(`  ${optionNumber} > ${opt.label.padEnd(35)} <`));
  });
  console.log(chalk.blueBright.bold(">═══════════════════════════════<\n"));
}

// ---- MAIN ----
async function main() {
  const logger = (message) => console.log(formatLogMessage(message));

  displayBanner();
  loadWalletsFromTxt(); // Use the new function
  logger(`🚀 Pharos Bot started. Wallets loaded: ${global.selectedWallets.length}`);

  const txCount = await requestInput("Enter number of transactions", "number", "5");
  if (isNaN(txCount) || txCount <= 0) {
    global.maxTransaction = 5;
    logger("⚠️ Invalid transaction count. Using default: 5");
  } else {
    global.maxTransaction = txCount;
    logger(`⚙️ Set transaction count to: ${txCount}`);
  }

  while (true) {
    displayBanner();
    displayMenu();
    const choice = await requestInput("Select an option (1-14)", "number");
    const idx = choice - 1;

    if (isNaN(idx) || idx < 0 || idx >= menuOptions.length) {
      logger("❌ Invalid option. Try again.");
      await new Promise((resolve) => setTimeout(resolve, 1000));
      continue;
    }

    const selected = menuOptions[idx];
    if (selected.value === "exit") {
      logger("👋 Exiting...");
      await new Promise((resolve) => setTimeout(resolve, 500));
      rl.close();
      process.exit(0);
    }

    if (selected.value === "setTransactionCount") {
      const newTxCount = await requestInput("Enter number of transactions", "number", global.maxTransaction.toString());
      if (isNaN(newTxCount) || newTxCount <= 0) {
        logger("⚠️ Invalid transaction count. Keeping current: " + global.maxTransaction);
      } else {
        global.maxTransaction = newTxCount;
        logger(`⚙️ Set transaction count to: ${newTxCount}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
      continue;
    }

    try {
      const useSpinner = selected.value !== "unlimitedFaucet";
      let spinner;
      if (useSpinner) {
        spinner = createSpinner(`🏃 Running ${selected.label}...`);
      }
      logger(`🚀 Starting ${selected.label}...`);
      const scriptFunc = service[selected.value];
      if (scriptFunc) {
        await scriptFunc(logger);
        logger(`✅ ${selected.label} completed.`);
      } else {
        logger(`❌ Error: ${selected.label} not implemented.`);
      }
      if (useSpinner) {
        spinner.stop();
      }
    } catch (e) {
      logger(`❌ Error in ${selected.label}: ${chalk.red(e.message)}`);
      if (useSpinner) { // This check might be redundant if spinner is undefined when useSpinner is false
        spinner.stop();
      }
    }

    await requestInput("Press Enter to continue...");
  }
}

// ---- Run ----
(async () => {
  try {
    await main();
  } catch (error) {
    console.error(chalk.red(`💀 Fatal error: ${error.message}`));
    rl.close();
    process.exit(1);
  }
})();
