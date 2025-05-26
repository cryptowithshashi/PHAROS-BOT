const chalk = require("chalk").default || require("chalk");
const path = require("path");
const fs = require("fs");
const readline = require("readline");
const moment = require("moment-timezone"); // Added for date formatting
const service =require("./pharosActions");
const { setupLogger } = require("./src/utils/logs"); // Import Winston logger
const { CronJob } = require("cron"); // Added for task scheduling

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
  { label: "Set Transaction Count", value: "setTransactionCount" },
  { label: "Exit", value: "exit" },
];

// ASCII Art Banner
const newBanner = `
          


██████      ██   ██      █████      ██████       ██████      ███████                        ██████     ██     ██     ███████ 
██   ██     ██   ██     ██   ██     ██   ██     ██    ██     ██                            ██          ██     ██     ██      
██████      ███████     ███████     ██████      ██    ██     ███████         █████         ██          ██  █  ██     ███████ 
██          ██   ██     ██   ██     ██   ██     ██    ██          ██                       ██          ██ ███ ██          ██ 
██          ██   ██     ██   ██     ██   ██      ██████      ███████                        ██████      ███ ███      ███████ 
                                                                                                                             
                                                                                                                             
 ---------------------------------------------------------------------------------------------------------------------------

     ${chalk.magentaBright('--- PHAROS AUTO BOT ---')}    
   ➥ ${chalk.cyan('Telegram Channel:')} ${chalk.underline.blue('https://t.me/crypto_with_shashi')}
   ➥ ${chalk.cyan('Twitter Handle:')} ${chalk.underline.blue('https://x.com/SHASHI522004')}
   ➥ ${chalk.cyan('Github:')} ${chalk.underline.blue('https://github.com/cryptowithshashi')}
`;

// ---- GLOBAL VARIABLES ----
global.selectedWallets = [];
global.maxTransaction = 5;

// ---- UTILITY FUNCTIONS ----
function loadWalletsFromTxt(logger) { // Pass logger instance
  const filePath = path.join(__dirname, 'private.txt');
  if (!fs.existsSync(filePath)) {
    logger.error('Error: private.txt file not found.'); // Use logger
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
      logger.warn(`Warning: Line ${index + 1} in private.txt is not a valid private key. Skipping.`); // Use logger
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
  console.log(newBanner); // Use the new banner string directly
  console.log();
}

function displayMenu() {
  console.log(chalk.blueBright.bold("\n========[ Pharos Testnet Bot Menu ]========"));
  menuOptions.forEach((opt, idx) => {
    const optionNumber = `${idx + 1}`.padStart(2, '0'); // Two-digit numbering
    console.log(chalk.blue(`  ${optionNumber} > ${opt.label.padEnd(35)} <`));
  });
  console.log(chalk.blueBright.bold(">═══════════════════════════════<\n"));
}

// ---- AUTOMATED TASK SEQUENCE ----
async function runAutomatedSequence(logger) {
    logger.info("🤖 Starting automated daily tasks sequence...");

    if (global.selectedWallets.length === 0) {
        logger.info("No wallets loaded initially for automated run. Attempting to load...");
        loadWalletsFromTxt(logger); // Ensure wallets are loaded
        if (global.selectedWallets.length === 0) {
            logger.error("No wallets found in private.txt. Automated sequence cannot run.");
            return;
        }
    }
    logger.info(`Automated sequence will run for ${global.selectedWallets.length} wallets.`);

    // Define the sequence of tasks for automation.
    // These tasks correspond to the 'value' in menuOptions and keys in 'service' object.
    // The user requested: login, check-in, 1-2 transfers, 1-2 swaps, liquidity, daily faucets.
    // We assume functions like randomTransfer/performSwapUSDC respect global.maxTransaction
    // for the "1 to 2" requirement, which the user sets at startup.
    const automatedTasks = [
        { label: "Account Login", funcKey: "accountLogin" },
        { label: "Account Check-in", funcKey: "accountCheckIn" },
        { label: "Claim Faucet PHRS", funcKey: "accountClaimFaucet" },
        { label: "Claim Faucet USDC", funcKey: "claimFaucetUSDC" },
        { label: "Random Transfer", funcKey: "randomTransfer" },
        { label: "Swap PHRS to USDC", funcKey: "performSwapUSDC" }, // Example swap
        { label: "Add Liquidity PHRS-USDC", funcKey: "addLpUSDC" }  // Example liquidity provision
    ];

    for (const task of automatedTasks) {
        const scriptFunc = service[task.funcKey];
        if (scriptFunc) {
            try {
                logger.info(`🚀 Executing automated task: ${task.label}`);
                await scriptFunc(logger); // Pass logger, assumes function handles all selected wallets
                logger.info(`✅ Automated task ${task.label} completed.`);
            } catch (e) {
                logger.error(`❌ Error in automated task ${task.label}: ${e.message}`);
                // Consider whether to stop the whole sequence on error or continue
            }
        } else {
            logger.warn(`⚠️ Automated task ${task.label} (key: ${task.funcKey}) not found in service object.`);
        }
        // Optional: Add a small delay between tasks if necessary
        // await new Promise(resolve => setTimeout(resolve, 2000)); // e.g., 2-second delay
    }
    logger.info("🤖 Automated daily tasks sequence finished.");
}

// ---- MAIN ----
async function main() {
  const logger = setupLogger();

  displayBanner();
  loadWalletsFromTxt(logger); // Pass logger instance
  logger.info(`✅ Pharos Bot is live | Wallets loaded: ${global.selectedWallets.length}`);

  // Setup cron job for daily automated tasks
  // Runs every day at 2:00 AM Asia/Calcutta time.
  // Cron expression: 'second minute hour dayOfMonth month dayOfWeek'
  try {
    const dailyJob = new CronJob(
      '0 0 2 * * *', // cronTime: Run daily at 2:00:00 AM
      async () => {
        logger.info('⏰ Cron job triggered: Running automated daily sequence.');
        // It's good practice to ensure wallets are loaded for the cron execution,
        // though runAutomatedSequence also has a check.
        if (global.selectedWallets.length === 0) {
            loadWalletsFromTxt(logger);
        }
        if (global.selectedWallets.length > 0) {
            await runAutomatedSequence(logger);
        } else {
            logger.error("Cron: No wallets loaded, skipping automated sequence.");
        }
      },
      null, // onComplete: function to execute when the job stops
      true, // start: Start the job right now (it will wait for its scheduled time)
      'Asia/Calcutta' // timeZone: Specify the timezone
    );
    // Format the next run date for better readability
    const nextRunDateTime = dailyJob.nextDate(); // This is a CronDate object
    const formattedNextRun = moment(nextRunDateTime.toJSDate()) // Convert CronDate to JS Date, then to Moment object
      .tz('Asia/Calcutta')
      .format('dddd, DD MMMM YYYY [at] hh:mm:ss A [Indian Standard Time] (Z)'); // e.g., Tuesday, 27 May 2025 at 02:00:00 AM Indian Standard Time (+05:30)
    logger.info(`🕒 Daily automated task sequence scheduled. Next run at: ${formattedNextRun}`);
  } catch (cronError) {
    logger.error(`❌ Failed to initialize cron job: ${cronError.message}`);
  }

  const txCount = await requestInput("How many transactions should be executed per wallet?", "number", "5");
  if (isNaN(txCount) || txCount <= 0) {
    global.maxTransaction = 5;
    logger.info("⚠️ Invalid transaction count. Using default: 5");
  } else {
    global.maxTransaction = txCount;
    logger.info(`⚙️ Set transaction count to: ${txCount}`);
  }

  while (true) {
    displayBanner();
    displayMenu();
    const choice = await requestInput("Select an option (1-13)", "number");
    const idx = choice - 1;

    if (isNaN(idx) || idx < 0 || idx >= menuOptions.length) {
      logger.warn("❌ Invalid option. Try again."); // Use logger.warn
      await new Promise((resolve) => setTimeout(resolve, 1000));
      continue;
    }

    const selected = menuOptions[idx];
    if (selected.value === "exit") {
      logger.info("👋 Exiting...");
      await new Promise((resolve) => setTimeout(resolve, 500));
      rl.close();
      process.exit(0);
    }

    if (selected.value === "setTransactionCount") {
      const newTxCount = await requestInput("How many transactions should be executed per wallet?", "number", global.maxTransaction.toString());
      if (isNaN(newTxCount) || newTxCount <= 0) {
        logger.warn("⚠️ Invalid transaction count. Keeping current: " + global.maxTransaction); // Use logger.warn
      } else {
        global.maxTransaction = newTxCount;
        logger.info(`⚙️ Set transaction count to: ${newTxCount}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
      continue;
    }

    let spinner; // Declare spinner outside try block
    try {
      spinner = createSpinner(`🏃 Running ${selected.label}...`);
      logger.info(`🚀 Starting ${selected.label}...`);
      const scriptFunc = service[selected.value];
      if (scriptFunc) {
        await scriptFunc(logger); // Pass Winston logger
        logger.info(`✅ ${selected.label} completed.`);
      } else {
        logger.error(`❌ Error: ${selected.label} not implemented.`); // Use logger.error
      }
      spinner.stop();
    } catch (e) {
      logger.error(`❌ Error in ${selected.label}: ${e.message}`); // Use logger.error
      if (spinner) spinner.stop(); // Ensure spinner is stopped on error
    }

    await requestInput("Press Enter to continue...");
  }
}

// ---- Run ----
(async () => {
  try {
    await main();
  } catch (error) {
    // Assuming logger is not available here, use console.error
    console.error(chalk.red(`💀 Fatal error in main execution: ${error.message}`));
    rl.close();
    process.exit(1);
  }
})();
