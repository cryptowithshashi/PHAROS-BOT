/**
 * src/index.js - Main entry point
 */
const fs = require('fs');
const path = require('path');
const prompt = require('prompt-sync')({ sigint: true });
const { ethers } = require('ethers');
const { setupLogger } = require('./utils/logger');
const { loadConfig } = require('./config');
const { createWallet, getWalletAddress } = require('./utils/wallet');
const AuthService = require('./services/auth');
const CheckinService = require('./services/checkin');
const FaucetService = require('./services/faucet');
const SocialService = require('./services/social');
const TransferService = require('./services/transfer');
const SwapService = require('./services/swap');
const LiquidityService = require('./services/liquidity');
const { sleep, parseProxy, createAxiosWithProxy, createAxiosWithoutProxy, isProxyError } = require('./utils/helpers');

let config;
let logger;
let useProxy = false;
let proxies = [];

async function main() {
  try {
    config = loadConfig();

    logger = setupLogger();

    logger.info('🚀 Starting Pharos Testnet Bot');

    logger.info('🔧 Select an option:');
    logger.info('1. Run through proxy (uses proxies from proxy.txt)');
    logger.info('2. Run without proxy (direct connection)');
    const userChoice = prompt('Enter your choice (1 or 2): ');

    const privateKeys = fs.readFileSync(path.join(process.cwd(), 'pk.txt'), 'utf8')
      .split('\n')
      .filter(line => line.trim() !== '')
      .map(line => line.trim());

    if (userChoice === '1') {
      const proxyFilePath = path.join(process.cwd(), 'proxy.txt');
      if (fs.existsSync(proxyFilePath)) {
        proxies = fs.readFileSync(proxyFilePath, 'utf8')
          .split('\n')
          .filter(line => line.trim() !== '')
          .map(line => line.trim());

        if (proxies.length > 0) {
          useProxy = true;
          logger.info(`📂 Loaded ${privateKeys.length} private keys and ${proxies.length} proxies`);
        } else {
          logger.warn('⚠️ proxy.txt is empty. Falling back to direct connection.');
          useProxy = false;
          proxies = privateKeys.map(() => null);
        }
      } else {
        logger.warn('⚠️ proxy.txt not found. Falling back to direct connection.');
        useProxy = false;
        proxies = privateKeys.map(() => null);
      }
    } else if (userChoice === '2') {
      logger.info('🔗 Running without proxy (direct connection).');
      useProxy = false;
      proxies = privateKeys.map(() => null);
    } else {
      logger.error('❌ Invalid choice. Exiting.');
      process.exit(1);
    }

    const numThreads = config.general.threads || 1;
    logger.info(`🧵 Running with ${numThreads} threads`);

    const accountBatches = divideAccountsIntoBatches(privateKeys, proxies, numThreads);

    const batchPromises = accountBatches.map((batch, batchIndex) =>
      processBatch(batch.privateKeys, batch.proxies, batchIndex, batch.startIndex)
    );

    await Promise.all(batchPromises);

    logger.info('🎉 All accounts processed successfully');
  } catch (error) {
    logger.error(`💀 Fatal error: ${error.message}`);
    process.exit(1);
  }
}

function divideAccountsIntoBatches(privateKeys, proxies, numThreads) {
  const batches = [];

  const batchSize = Math.ceil(privateKeys.length / numThreads);

  for (let i = 0; i < numThreads; i++) {
    const startIdx = i * batchSize;
    const endIdx = Math.min(startIdx + batchSize, privateKeys.length);

    if (startIdx >= privateKeys.length) {
      continue;
    }

    const batchPrivateKeys = privateKeys.slice(startIdx, endIdx);

    const batchProxies = batchPrivateKeys.map((_, idx) => {
      const globalIdx = startIdx + idx;
      return proxies[globalIdx % proxies.length];
    });

    batches.push({
      privateKeys: batchPrivateKeys,
      proxies: batchProxies,
      startIndex: startIdx
    });
  }

  return batches;
}

async function processBatch(privateKeys, proxies, batchIndex, startIndex) {
  const threadLogId = `0-`;
  const threadId = batchIndex + 1;

  logger.info(`🧵 Thread ${threadId}: Starting to process ${privateKeys.length} accounts`, { walletIndex: threadLogId });

  for (let i = 0; i < privateKeys.length; i++) {
    const globalWalletIndex = startIndex + i + 1;
    const threadWalletId = `T${threadId}-W${globalWalletIndex}`;

    const privateKey = privateKeys[i];
    const proxy = proxies[i];

    logger.info(`⚙️ Thread ${threadId}: Processing account ${i + 1}/${privateKeys.length} (Global Wallet ID: ${globalWalletIndex})`, { walletIndex: threadWalletId });

    try {
      await processAccount(privateKey, proxy, threadWalletId, threadId, globalWalletIndex);
    } catch (error) {
      logger.error(`❌ Thread ${threadId}: Error processing account ${i + 1}/${privateKeys.length}: ${error.message}`, { walletIndex: threadWalletId });
    }

    if (i < privateKeys.length - 1) {
      await sleep(config.general.delay_between_accounts);
    }
  }

  logger.info(`🏁 Thread ${threadId}: Completed processing all accounts`, { walletIndex: threadLogId });
}

async function processAccount(privateKey, proxy, walletIndex, threadId, globalWalletIndex) {
  const wallet = createWallet(privateKey);
  const address = getWalletAddress(wallet);

  logger.info(`🆔 Wallet: ${address}`, { walletIndex });

  let allProxies = useProxy
    ? fs.readFileSync(path.join(process.cwd(), 'proxy.txt'), 'utf8')
        .split('\n')
        .filter(line => line.trim() !== '')
        .map(line => line.trim())
    : [];

  let currentProxyIndex = useProxy && proxy ? allProxies.indexOf(proxy) : 0;
  if (currentProxyIndex === -1) currentProxyIndex = 0;

  let axiosInstance = useProxy && proxy ? createAxiosWithProxy(proxy) : createAxiosWithoutProxy();

  const rotateProxyIfNeeded = async (error) => {
    if (useProxy && isProxyError(error.message) && allProxies.length > 1) {
      currentProxyIndex = (currentProxyIndex + 1) % allProxies.length;
      const newProxy = allProxies[currentProxyIndex];

     // If the new proxy is different from the old one
      if (newProxy !== proxy) {
        logger.warn(`🔄 Rotating proxy due to error: ${error.message}. Switching to proxy: ${newProxy.substring(0, 15)}...`, { walletIndex });

        axiosInstance = createAxiosWithProxy(newProxy);

        await sleep(3000);
        return true;
      }
    }
    return false;
  };

  let authService = new AuthService(axiosInstance, wallet, logger, walletIndex);
  let checkinService = new CheckinService(axiosInstance, logger, walletIndex);
  let faucetService = new FaucetService(axiosInstance, wallet, logger, walletIndex);
  let socialService = new SocialService(axiosInstance, logger, walletIndex);
  const transferService = new TransferService(wallet, logger, walletIndex);
  const swapService = new SwapService(wallet, logger, walletIndex);
  const liquidityService = new LiquidityService(wallet, logger, walletIndex);

  const reinitializeServices = () => {
    authService = new AuthService(axiosInstance, wallet, logger, walletIndex);
    checkinService = new CheckinService(axiosInstance, logger, walletIndex);
    faucetService = new FaucetService(axiosInstance, wallet, logger, walletIndex);
    socialService = new SocialService(axiosInstance, logger, walletIndex);
  };

  let isAuthenticated = false;
  let jwt, userInfo;

  if (config.tasks.login) {
    logger.info(`🔑 Logging in...`, { walletIndex });
    let loginSuccess = false;
    let loginAttempts = 0;
    const maxLoginAttempts = 3;

    while (!loginSuccess && loginAttempts < maxLoginAttempts) {
      try {
        const result = await authService.login();
        jwt = result.jwt;
        userInfo = result.userInfo;
        loginSuccess = true;
        isAuthenticated = true;
      } catch (error) {
        loginAttempts++;

        if (await rotateProxyIfNeeded(error)) {
          reinitializeServices();
          logger.info(`🔄 Retrying login with new proxy (attempt ${loginAttempts}/${maxLoginAttempts})`, { walletIndex });
        } else if (loginAttempts < maxLoginAttempts) {
          logger.warn(`❌ Login failed: ${error.message}. Retrying (attempt ${loginAttempts}/${maxLoginAttempts})`, { walletIndex });
          await sleep(3000 * loginAttempts);
        } else {
          throw new Error(`❌ Failed to login after ${maxLoginAttempts} attempts: ${error.message}`);
        }
      }
    }

    checkinService.setJwt(jwt);
    faucetService.setJwt(jwt);
    socialService.setJwt(jwt);

    logger.info(`✅ Logged in successfully with user ID: ${userInfo.ID}`, { walletIndex });
  }

  if (config.tasks.checkin) {
    if (!isAuthenticated) {
      logger.warn(`⚠️ Skipping check-in because not authenticated. Enable login in config to use this feature.`, { walletIndex });
    } else {
      logger.info(`🗓️ Performing daily check-in...`, { walletIndex });
      let checkinSuccess = false;
      let checkinAttempts = 0;
      const maxCheckinAttempts = 3;

      while (!checkinSuccess && checkinAttempts < maxCheckinAttempts) {
        try {
          checkinSuccess = await checkinService.dailyCheckin(address);

          if (!checkinSuccess) {
            logger.warn(`⚠️ Daily check-in returned false. Moving on.`, { walletIndex });
            break;
          }

          logger.info(`✅ Daily check-in successful`, { walletIndex });
        } catch (error) {
          checkinAttempts++;

          if (await rotateProxyIfNeeded(error)) {
            reinitializeServices();
            checkinService.setJwt(jwt);
            faucetService.setJwt(jwt);
            socialService.setJwt(jwt);
            logger.info(`🔄 Retrying check-in with new proxy (attempt ${checkinAttempts}/${maxCheckinAttempts})`, { walletIndex });
          } else if (checkinAttempts < maxCheckinAttempts) {
            logger.warn(`❌ Check-in failed: ${error.message}. Retrying (attempt ${checkinAttempts}/${maxCheckinAttempts})`, { walletIndex });
            await sleep(3000 * checkinAttempts);
          } else {
            logger.error(`❌ Failed to complete check-in after ${maxCheckinAttempts} attempts: ${error.message}`, { walletIndex });
            break;
          }
        }
      }
    }
  }

  if (config.tasks.faucet.native) {
    if (!isAuthenticated) {
      logger.warn(`⚠️ Skipping native faucet because not authenticated. Enable login in config to use this feature.`, { walletIndex });
    } else {
      try {
        await faucetService.claimNativeFaucet(address);
      } catch (error) {
        logger.error(`❌ Native faucet claim failed: ${error.message}`, { walletIndex });
      }
    }
  }

  if (config.tasks.social.enabled) {
    if (!isAuthenticated) {
      logger.warn(`⚠️ Skipping social tasks because not authenticated. Enable login in config to use this feature.`, { walletIndex });
    } else {
      if (config.tasks.social.follow_x) {
        logger.info(`🐦 Verifying task: Follow on X...`, { walletIndex });
        try {
          await socialService.verifyTask(address, 201);
        } catch (error) {
          logger.error(`❌ X follow task failed: ${error.message}`, { walletIndex });
        }
      }

      if (config.tasks.social.retweet_x) {
        logger.info(`🔁 Verifying task: Retweet on X...`, { walletIndex });
        try {
          await socialService.verifyTask(address, 202);
        } catch (error) {
          logger.error(`❌ X retweet task failed: ${error.message}`, { walletIndex });
        }
      }

      if (config.tasks.social.comment_x) {
        logger.info(`💬 Verifying task: Comment on X...`, { walletIndex });
        try {
          await socialService.verifyTask(address, 203);
        } catch (error) {
          logger.error(`❌ X comment task failed: ${error.message}`, { walletIndex });
        }
      }

      if (config.tasks.social.join_discord) {
        logger.info(`🎧 Verifying task: Join Discord...`, { walletIndex });
        try {
          await socialService.verifyTask(address, 204);
        } catch (error) {
          logger.error(`❌ Discord join task failed: ${error.message}`, { walletIndex });
        }
      }
    }
  }

  if (config.tasks.onchain.self_transfer.enabled) {
    const taskConfig = config.tasks.onchain.self_transfer;

    let remainingCount = taskConfig.max_count;

    if (isAuthenticated) {
      try {
        logger.info(`🔍 Checking self-transfer task status...`, { walletIndex });
        const taskList = await socialService.getUserTasks(address);
        const selfTransferTask = taskList.find(task => task.TaskId === 103);
        const completedCount = selfTransferTask ? selfTransferTask.CompleteTimes : 0;
        remainingCount = Math.min(taskConfig.max_count - completedCount, taskConfig.max_count);
      } catch (error) {
        logger.warn(`⚠️ Could not get task list for self-transfers: ${error.message}. Using max count from config.`, { walletIndex });
      }
    }

    if (remainingCount > 0) {
      logger.info(`💸 Need to perform ${remainingCount} more self transfers`, { walletIndex });

      for (let i = 0; i < remainingCount; i++) {
        let amount;
        if (taskConfig.random_amount) {
          const randomIndex = Math.floor(Math.random() * taskConfig.amount_options.length);
          amount = taskConfig.amount_options[randomIndex];
        } else {
          amount = taskConfig.amount_options[0];
        }

        logger.info(`💸 Performing self-transfer ${i + 1}/${remainingCount} with amount ${amount} PHRS...`, { walletIndex });
        const txHash = await transferService.selfTransfer(amount);

        if (txHash) {
          if (isAuthenticated) {
            try {
              await socialService.verifyTaskWithTxHash(address, 103, txHash);
              logger.info(`✅ Self-transfer ${i + 1}/${remainingCount} verified`, { walletIndex });
            } catch (error) {
              logger.warn(`⚠️ Could not verify self-transfer task: ${error.message}`, { walletIndex });
            }
          } else {
            logger.info(`✅ Self-transfer ${i + 1}/${remainingCount} completed (not verified - login disabled)`, { walletIndex });
          }

          if (i < remainingCount - 1) {
            await sleep(5000);
          }
        }
      }
    } else {
      logger.info(`👍 Already completed all ${taskConfig.max_count} self transfers`, { walletIndex });
    }
  }

  if (config.tasks.faucet.usdc || config.tasks.faucet.usdt) {
    if (!isAuthenticated) {
      logger.warn(`⚠️ Skipping token faucet because not authenticated. Enable login in config to use this feature.`, { walletIndex });
    } else {
      if (config.tasks.faucet.usdc) {
        await faucetService.claimTokenFaucet(address, 'USDC');
      } else if (config.tasks.faucet.usdt) {
        await faucetService.claimTokenFaucet(address, 'USDT');
      }
    }
  }

  if (config.tasks.onchain.swap.enabled) {
    const taskConfig = config.tasks.onchain.swap;

    let remainingCount = taskConfig.max_count;

    if (isAuthenticated) {
      try {
        logger.info(`🔍 Checking swap task status...`, { walletIndex });
        const taskList = await socialService.getUserTasks(address);
        const swapTask = taskList.find(task => task.TaskId === 101);
        const completedCount = swapTask ? swapTask.CompleteTimes : 0;
        remainingCount = Math.min(taskConfig.max_count - completedCount, taskConfig.max_count);
      } catch (error) {
        logger.warn(`⚠️ Could not get task list for swaps: ${error.message}. Using max count from config.`, { walletIndex });
      }
    }

    if (remainingCount > 0) {
      logger.info(`🔄 Need to perform ${remainingCount} more swaps`, { walletIndex });

      for (let i = 0; i < remainingCount; i++) {
        const pair = taskConfig.pairs[i % taskConfig.pairs.length];

        logger.info(`🔄 Swapping ${pair.amount} ${pair.from} to ${pair.to}...`, { walletIndex });
        const txHash = await swapService.swap(pair.from, pair.to, pair.amount);

        if (txHash) {
          logger.info(`✅ Swap ${i + 1}/${remainingCount} completed`, { walletIndex });

          if (i < remainingCount - 1) {
            await sleep(5000);
          }
        }
      }
    } else {
      logger.info(`👍 Already completed all ${taskConfig.max_count} swaps`, { walletIndex });
    }
  }

  if (config.tasks.onchain.liquidity.enabled) {
    const taskConfig = config.tasks.onchain.liquidity;

    let remainingCount = taskConfig.max_count;

    if (isAuthenticated) {
      try {
        logger.info(`🔍 Checking liquidity task status...`, { walletIndex });
        const taskList = await socialService.getUserTasks(address);
        const liquidityTask = taskList.find(task => task.TaskId === 102);
        const completedCount = liquidityTask ? liquidityTask.CompleteTimes : 0;
        remainingCount = Math.min(taskConfig.max_count - completedCount, taskConfig.max_count);
      } catch (error) {
        logger.warn(`⚠️ Could not get task list for liquidity: ${error.message}. Using max count from config.`, { walletIndex });
      }
    }

    if (remainingCount > 0) {
      logger.info(`💧 Need to perform ${remainingCount} more liquidity additions`, { walletIndex });

      for (let i = 0; i < remainingCount; i++) {
        const pair = taskConfig.pairs[i % taskConfig.pairs.length];

        logger.info(`💧 Adding liquidity: ${pair.amount0} ${pair.token0} and ${pair.amount1} ${pair.token1}...`, { walletIndex });
        const txHash = await liquidityService.addLiquidity(pair.token0, pair.token1, pair.amount0, pair.amount1);

        if (txHash) {
          logger.info(`✅ Liquidity addition ${i + 1}/${remainingCount} completed`, { walletIndex });

          if (i < remainingCount - 1) {
            await sleep(5000);
          }
        }
      }
    } else {
      logger.info(`👍 Already completed all ${taskConfig.max_count} liquidity additions`, { walletIndex });
    }
  }

  logger.info(`🎉 Completed all tasks for wallet`, { walletIndex });
}

main().catch(error => {
  console.error('💀 Unhandled error:', error);
  process.exit(1);
});
