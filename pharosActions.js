const fs = require("fs");
const path = require("path");
const qs = require("querystring");
const { ethers: e } = require("ethers");
const chalk = require("chalk").default || require("chalk");
const axios = require("axios");
const FakeUserAgent = require("fake-useragent");
const chains = require("./chains");
const pharos = chains.testnet.pharosconfig;
const etc = chains.utils.cliHelpers;
const abi = chains.utils.contractDefinition;
const contract = chains.utils.contractprovider;

const BASE_API = "https://api.pharosnetwork.xyz";
const REF_CODE = "L0HoBrbC34YT7ezk";
const RPC_URL = "https://testnet.dplabs-internal.com";

function getRandomAmount(min, max) {
  const amount = (Math.random() * (max - min) + min).toFixed(4); // 4 decimal places
  return e.parseEther(amount);
}

function maskAddress(address) {
  return address ? `${address.slice(0, 6)}${'*'.repeat(6)}${address.slice(-6)}` : "Unknown";
}

async function askQuestion(question, logger) {
  const readline = require("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(chalk.greenBright(`${question}: `), (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function performSwapUSDC(logger) {
  for (let a of global.selectedWallets || []) {
    let { privatekey: t, name: $ } = a;
    if (!t) {
      logger.warn(`⚠️ Skipping ${$ || "wallet with missing data"} due to missing private key`);
      continue;
    }
    try {
      let r = new e.Wallet(t, pharos.provider());
      let o = r.address;
      let i = getRandomAmount(0.2, 0.9); // Random amount between 0.2 and 0.9 PHRS
      let amountStr = e.formatEther(i);
      let s = contract.WPHRS.slice(2).padStart(64, "0") + contract.USDC.slice(2).padStart(64, "0");
      let n = i.toString(16).padStart(64, "0");
      let l =
        "0x04e45aaf" +
        s +
        "0000000000000000000000000000000000000000000000000000000000000bb8" +
        o.toLowerCase().slice(2).padStart(64, "0") +
        n +
        "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
      let c = Math.floor(Date.now() / 1e3) + 600;
      let d = ["function multicall(uint256 deadline, bytes[] calldata data) payable"];
      let p = new e.Contract(contract.SWAP, d, r);
      let f = p.interface.encodeFunctionData("multicall", [c, [l]]);
      await pharos.provider().getFeeData();
      for (let w = 1; w <= global.maxTransaction; w++) {
        logger.info(`🔄 Initiating Swap ${amountStr} PHRS to USDC for ${$} (${w}/${global.maxTransaction})`);
        let g = {
          to: p.target,
          data: f,
          value: i,
        };
        g.gasLimit = (await pharos.provider().estimateGas(g)) * 12n / 10n;
        let m = await r.sendTransaction(g);
        await m.wait(1);
        logger.info(`✅ Swap Confirmed for ${$}: ${chalk.green(pharos.explorer.tx(m.hash))} | ${etc.timelog()}`);
        await etc.delay(5e3);
      }
    } catch (u) {
      logger.error(`❌ Error during swap for ${$}: ${chalk.red(u.message)} | ${etc.timelog()}`);
    }
  }
}

async function performSwapUSDT(logger) {
  for (let a of global.selectedWallets || []) {
    let { privatekey: t, name: $ } = a;
    if (!t) {
      logger.warn(`⚠️ Skipping ${$ || "wallet with missing data"} due to missing private key`);
      continue;
    }
    try {
      let r = new e.Wallet(t, pharos.provider());
      let o = r.address;
      let i = getRandomAmount(0.2, 0.9); // Random amount between 0.2 and 0.9 PHRS
      let amountStr = e.formatEther(i);
      let s = contract.WPHRS.slice(2).padStart(64, "0") + contract.USDT.slice(2).padStart(64, "0");
      let n = i.toString(16).padStart(64, "0");
      let l =
        "0x04e45aaf" +
        s +
        "0000000000000000000000000000000000000000000000000000000000000bb8" +
        o.toLowerCase().slice(2).padStart(64, "0") +
        n +
        "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
      let c = Math.floor(Date.now() / 1e3) + 600;
      let d = ["function multicall(uint256 deadline, bytes[] calldata data) payable"];
      let p = new e.Contract(contract.SWAP, d, r);
      let f = p.interface.encodeFunctionData("multicall", [c, [l]]);
      await pharos.provider().getFeeData();
      for (let w = 1; w <= global.maxTransaction; w++) {
        logger.info(`🔄 Initiating Swap ${amountStr} PHRS to USDT for ${$} (${w}/${global.maxTransaction})`);
        let g = {
          to: p.target,
          data: f,
          value: i,
        };
        g.gasLimit = (await pharos.provider().estimateGas(g)) * 12n / 10n;
        let m = await r.sendTransaction(g);
        await m.wait(1);
        logger.info(`✅ Swap Confirmed for ${$}: ${chalk.green(pharos.explorer.tx(m.hash))} | ${etc.timelog()}`);
        await etc.delay(5e3);
      }
    } catch (u) {
      logger.error(`❌ Error during swap for ${$}: ${chalk.red(u.message)} | ${etc.timelog()}`);
    }
  }
}

async function checkBalanceAndApprove(a, t, $, logger) {
  let r = new e.Contract(t, abi.ERC20, a);
  let o = await r.allowance(a.address, $);
  if (0n === o) {
    logger.info(`🔑 Approving token for ${a.address}`);
    let i = e.MaxUint256;
    try {
      let s = await r.approve($, i);
      await s.wait(1);
      await etc.delay(3e3);
      logger.info(`✅ Approval successful for ${a.address}`);
    } catch (n) {
      logger.error(`❌ Approval failed for ${a.address}: ${chalk.red(n.message)}`);
      return false;
    }
  }
  return true;
}

async function addLpUSDC(logger) {
  for (let a of global.selectedWallets || []) {
    let { privatekey: t, name: $ } = a;
    if (!t) {
      logger.warn(`⚠️ Skipping ${$ || "wallet with missing data"} due to missing private key`);
      continue;
    }
    try {
      let r = new e.Wallet(t, pharos.provider());
      let o = new e.Contract(contract.ROUTER, abi.ROUTER, r);
      let i = Math.floor(Date.now() / 1e3) + 1800;
      let l = await checkBalanceAndApprove(r, contract.USDC, contract.ROUTER, logger);
      if (!l) {
        continue;
      }
      let amount = getRandomAmount(0.2, 0.5); // Random amount between 0.2 and 0.5
      let amountStr = e.formatEther(amount);
      let c = {
        token0: contract.WPHRS,
        token1: contract.USDC,
        fee: 500,
        tickLower: -887220,
        tickUpper: 887220,
        amount0Desired: amount.toString(),
        amount1Desired: amount.toString(),
        amount0Min: "0",
        amount1Min: "0",
        recipient: r.address,
        deadline: i,
      };
      let d = o.interface.encodeFunctionData("mint", [c]);
      let p = o.interface.encodeFunctionData("refundETH", []);
      let f = [d, p];
      for (let w = 1; w <= global.maxTransaction; w++) {
        logger.info(
          `💧 Initiating Add Liquidity ${amountStr} PHRS + ${amountStr} USDC for ${$} (${w}/${global.maxTransaction})`
        );
        let g = await o.multicall(f, {
          value: amount,
          gasLimit: 5e5,
        });
        await g.wait(1);
        logger.info(`✅ Liquidity Added for ${$}: ${chalk.green(pharos.explorer.tx(g.hash))} | ${etc.timelog()}`);
        await etc.delay(5e3);
      }
    } catch (m) {
      logger.error(`❌ Error adding liquidity for ${$}: ${chalk.red(m.message)} | ${etc.timelog()}`);
    }
  }
}

async function addLpUSDT(logger) {
  for (let a of global.selectedWallets || []) {
    let { privatekey: t, name: $ } = a;
    if (!t) {
      logger.warn(`⚠️ Skipping ${$ || "wallet with missing data"} due to missing private key`);
      continue;
    }
    try {
      let r = new e.Wallet(t, pharos.provider());
      let o = new e.Contract(contract.ROUTER, abi.ROUTER, r);
      let i = Math.floor(Date.now() / 1e3) + 1800;
      let l = await checkBalanceAndApprove(r, contract.USDT, contract.ROUTER, logger);
      if (!l) {
        continue;
      }
      let amount = getRandomAmount(0.2, 0.5); // Random amount between 0.2 and 0.5
      let amountStr = e.formatEther(amount);
      let c = {
        token0: contract.WPHRS,
        token1: contract.USDT,
        fee: 500,
        tickLower: -887220,
        tickUpper: 887220,
        amount0Desired: amount.toString(),
        amount1Desired: amount.toString(),
        amount0Min: "0",
        amount1Min: "0",
        recipient: r.address,
        deadline: i,
      };
      let d = o.interface.encodeFunctionData("mint", [c]);
      let p = o.interface.encodeFunctionData("refundETH", []);
      let f = [d, p];
      for (let w = 1; w <= global.maxTransaction; w++) {
        logger.info(
          `💧 Initiating Add Liquidity ${amountStr} PHRS + ${amountStr} USDT for ${$} (${w}/${global.maxTransaction})`
        );
        let g = await o.multicall(f, {
          value: amount,
          gasLimit: 5e5,
        });
        await g.wait(1);
        logger.info(`✅ Liquidity Added for ${$}: ${chalk.green(pharos.explorer.tx(g.hash))} | ${etc.timelog()}`);
        await etc.delay(5e3);
      }
    } catch (m) {
      logger.error(`❌ Error adding liquidity for ${$}: ${chalk.red(m.message)} | ${etc.timelog()}`);
    }
  }
}

async function randomTransfer(logger) {
  for (let a of global.selectedWallets || []) {
    let { privatekey: t, name: $ } = a;
    if (!t) {
      logger.warn(`⚠️ Skipping ${$ || "wallet with missing private key"} due to missing private key`);
      continue;
    }
    try {
      let r = new e.Wallet(t, pharos.provider());
      let o = pharos.provider();
      let s = e.parseEther("0.000001");
      let n = await o.getBalance(r.address);
      if (n < s * BigInt(global.maxTransaction)) {
        logger.warn(
          `⚠️ Insufficient balance for ${$}: (${e.formatEther(
            n
          )}) to transfer 0.000001 PHRS x ${global.maxTransaction} times`
        );
        continue;
      }
      for (let l = 1; l <= global.maxTransaction; l++) {
        let c = e.Wallet.createRandom();
        let d = c.address;
        logger.info(`💸 Initiating Transfer 0.000001 PHRS from ${$} to ${d} (${l}/${global.maxTransaction})`);
        let p = await r.sendTransaction({
          to: d,
          value: s,
          gasLimit: 21e3,
          gasPrice: 0,
        });
        await p.wait(1);
        logger.info(`✅ Transfer Confirmed for ${$}: ${chalk.green(pharos.explorer.tx(p.hash))} | ${etc.timelog()}`);
        await etc.delay(5e3);
      }
    } catch (f) {
      logger.error(`❌ Transfer Error for ${$}: ${chalk.red(f.message)} | ${etc.timelog()}`);
    }
  }
}

async function accountCheck(logger) {
  for (let a of global.selectedWallets || []) {
    let { privatekey: t, token: $, name: r } = a;
    if (!t || !$) {
      logger.warn(`⚠️ Skipping ${r || "wallet with missing data"} due to missing data`);
      continue;
    }
    try {
      let o = new e.Wallet(t, pharos.provider());
      logger.info(`📊 Checking Profile Stats for ${r} (${o.address})`);
      let s = {
        ...etc.headers,
        authorization: `Bearer ${$}`,
      };
      let n = await axios.get(`https://api.pharosnetwork.xyz/user/profile?address=${o.address}`, {
        headers: s,
      });
      let l = n.data;
      if (0 !== l.code || !l.data.user_info) {
        logger.error(`❌ Profile check failed for ${r}: ${chalk.red(l.msg)}`);
        continue;
      }
      let { ID: c, TotalPoints: d, TaskPoints: p, InvitePoints: f } = l.data.user_info;
      logger.info(
        `✅ Profile Stats for ${r}: ID: ${c}, TotalPoints: ${d}, TaskPoints: ${p}, InvitePoints: ${f} | ${etc.timelog()}`
      );
      await etc.delay(5e3);
    } catch (w) {
      if (axios.isAxiosError(w)) {
        logger.error(
          `❌ HTTP Error for ${r}: ${chalk.red(
            `${w.response?.status} - ${w.response?.data?.message || w.message}`
          )} | ${etc.timelog()}`
        );
      } else {
        logger.error(`❌ Error for ${r}: ${chalk.red(w.message)} | ${etc.timelog()}`);
      }
    }
    await etc.delay(5e3);
  }
}

async function accountLogin(logger) {
  for (let a of global.selectedWallets || []) {
    let { privatekey: t, token: $, name: r } = a;
    if (!t) {
      logger.warn(`⚠️ Skipping ${r || "wallet with missing private key"} due to missing private key`);
      continue;
    }
    if (!$) {
      logger.info(`🔑 No token found for ${r}. Attempting login...`);
      await etc.delay(3e3);
      try {
        let o = new e.Wallet(t, pharos.provider());
        let i = await o.signMessage("pharos");
        logger.info(`🔑 Logging in to Pharos for ${r} (${o.address})`);
        let n = {
          ...etc.headers,
        };
        let l = await axios.post(
          `https://api.pharosnetwork.xyz/user/login?address=${o.address}&signature=${i}&invite_code=L0HoBrbC34YT7ezk`,
          null,
          { headers: n }
        );
        let c = l.data;
        if (0 !== c.code || !c.data?.jwt) {
          logger.error(`❌ Login failed for ${r}: ${chalk.red(c.msg)}`);
          continue;
        }
        a.token = c.data.jwt;
        logger.info(`✅ Login successful for ${r}`);
      } catch (p) {
        logger.error(`❌ Login error for ${r}: ${chalk.red(p.message)} | ${etc.timelog()}`);
      }
    }
  }
  // Removed wallet.json update logic as private.txt is now used.
  // Tokens, if needed, would be managed in memory or via a different mechanism.
  await etc.delay(5e3);
}

async function accountCheckIn(logger) {
  for (let a of global.selectedWallets || []) {
    let { privatekey: t, token: $, name: r } = a;
    if (!t || !$) {
      logger.warn(`⚠️ Skipping ${r || "wallet with missing data"} due to missing data`);
      continue;
    }
    try {
      let o = new e.Wallet(t, pharos.provider());
      logger.info(`🗓️ Checking in for ${r} (${o.address})`);
      let s = {
        ...etc.headers,
        authorization: `Bearer ${$}`,
      };
      let n = await axios.post(`https://api.pharosnetwork.xyz/sign/in?address=${o.address}`, null, {
        headers: s,
      });
      let l = n.data;
      if (0 === l.code) {
        logger.info(`✅ Check-in successful for ${r}: ${l.msg} | ${etc.timelog()}`);
      } else if (l.msg?.toLowerCase().includes("already")) {
        logger.info(`👍 Already checked in for ${r} | ${etc.timelog()}`);
      } else {
        logger.error(`❌ Check-in failed for ${r}: ${chalk.red(l.msg || "Unknown error")} | ${etc.timelog()}`);
      }
    } catch (c) {
      if (axios.isAxiosError(c)) {
        logger.error(
          `❌ HTTP Error for ${r}: ${chalk.red(
            `${c.response?.status} - ${c.response?.data?.message || c.message}`
          )} | ${etc.timelog()}`
        );
      } else {
        logger.error(`❌ Error for ${r}: ${chalk.red(c.message)} | ${etc.timelog()}`);
      }
    }
    await etc.delay(5e3);
  }
}

async function claimFaucetUSDC(logger) {
  for (let a of global.selectedWallets || []) {
    let { privatekey: t, name: $ } = a;
    if (!t) {
      logger.warn(`⚠️ Skipping ${$ || "wallet with missing private key"} due to missing private key`);
      continue;
    }
    let r = new e.Wallet(t, pharos.provider());
    try {
      logger.info(`🪙 Claiming USDC for ${$} (${r.address})`);
      let o = await axios.post(
        "https://testnet-router.zenithswap.xyz/api/v1/faucet",
        {
          tokenAddress: "0xAD902CF99C2dE2f1Ba5ec4D642Fd7E49cae9EE37",
          userAddress: r.address,
        },
        {
          headers: {
            "Content-Type": "application/json",
            ...etc.headers,
          },
        }
      );
      let i = o.data;
      if (200 === i.status && i.data?.txHash) {
        logger.info(`✅ USDC Claimed for ${$} | TxHash: ${chalk.green(pharos.explorer.tx(i.data.txHash))} | ${etc.timelog()}`);
      } else {
        logger.error(`❌ USDC Claim failed for ${$}: ${chalk.red(i.message || "Unknown error")} | ${etc.timelog()}`);
      }
    } catch (s) {
      if (axios.isAxiosError(s)) {
        let n = s.response?.data?.message || s.message;
        logger.error(`❌ USDC Claim Error for ${$}: ${chalk.red(n)} | ${etc.timelog()}`);
      } else {
        logger.error(`❌ USDC Claim Unexpected error for ${$}: ${chalk.red(s.message)} | ${etc.timelog()}`);
      }
    }
    await etc.delay(5e3);
  }
}

async function socialTask(logger) {
  let a = [201, 202, 203, 204];
  for (let t of global.selectedWallets || []) {
    let { privatekey: $, token: r, name: o } = t;
    if (!$ || !r) {
      logger.warn(`⚠️ Skipping ${o || "wallet with missing data"} due to missing data`);
      continue;
    }
    let i = new e.Wallet($, pharos.provider());
    for (let s of a) {
      try {
        logger.info(`📝 Verifying task ${s} for ${o} (${i.address})`);
        let n = qs.stringify({
          address: i.address,
          task_id: s,
        });
        let l = await axios.post("https://api.pharosnetwork.xyz/task/verify", n, {
          headers: {
            ...etc.headers,
            authorization: `Bearer ${r}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        });
        let c = l.data;
        if (0 === c.code && c.data?.verified) {
          logger.info(`✅ Task ${s} verified successfully for ${o} | ${etc.timelog()}`);
        } else {
          logger.error(`❌ Task ${s} verification failed for ${o}: ${chalk.red(c.msg || "Unknown error")} | ${etc.timelog()}`);
        }
      } catch (d) {
        if (axios.isAxiosError(d)) {
          let p = d.response?.data?.msg || d.message;
          logger.error(`❌ Task ${s} HTTP Error for ${o}: ${chalk.red(p)} | ${etc.timelog()}`);
        } else {
          logger.error(`❌ Task ${s} Unexpected error for ${o}: ${chalk.red(d.message)} | ${etc.timelog()}`);
        }
      }
      await etc.countdown(15e3, "Countdown");
    }
  }
}

async function accountClaimFaucet(logger) {
  for (let a of global.selectedWallets || []) {
    let { privatekey: t, token: $, name: r } = a;
    if (!t || !$) {
      logger.warn(`⚠️ Skipping ${r || "wallet with missing data"} due to missing data`);
      continue;
    }
    try {
      let o = new e.Wallet(t, pharos.provider());
      logger.info(`🔍 Checking Faucet status for ${r} (${o.address})`);
      let s = {
        ...etc.headers,
        authorization: `Bearer ${$}`,
      };
      let n = await axios.get(`https://api.pharosnetwork.xyz/faucet/status?address=${o.address}`, {
        headers: s,
      });
      let l = n.data;
      if (0 !== l.code || !l.data) {
        logger.error(`❌ Faucet status check failed for ${r}: ${chalk.red(l.msg || "Unknown error")}`);
        continue;
      }
      if (!l.data.is_able_to_faucet) {
        let c = new Date(1e3 * l.data.avaliable_timestamp).toLocaleString("en-US", {
          timeZone: "Asia/Jakarta",
        });
        logger.info(`⏳ Faucet not available for ${r}. Next available: ${c}`);
        continue;
      }
      logger.info(`🪙 Claiming Faucet for ${r} (${o.address})`);
      let p = await axios.post(`https://api.pharosnetwork.xyz/faucet/daily?address=${o.address}`, null, {
        headers: s,
      });
      let f = p.data;
      if (0 === f.code) {
        logger.info(`✅ Faucet claimed successfully for ${r}`);
      } else {
        logger.error(`❌ Faucet claim failed for ${r}: ${chalk.red(f.msg || "Unknown error")}`);
      }
    } catch (w) {
      if (axios.isAxiosError(w)) {
        logger.error(
          `❌ HTTP Error for ${r}: ${chalk.red(
            `${w.response?.status} - ${w.response?.data?.message || w.message}`
          )} | ${etc.timelog()}`
        );
      } else {
        logger.error(`❌ Error for ${r}: ${chalk.red(w.message)} | ${etc.timelog()}`);
      }
    }
    await etc.delay(5e3);
  }
}

async function unlimitedFaucet(logger) {
  const provider = new e.JsonRpcProvider(RPC_URL, { chainId: 688688, name: "pharos-testnet" });
  const headers = {
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    Origin: "https://testnet.pharosnetwork.xyz",
    Referer: "https://testnet.pharosnetwork.xyz/",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-site",
    "User-Agent": new FakeUserAgent().random,
  };

  logger.info(`🛠️ Initiating wallet generation`);
  logger.info(`--------------------------------------------`);
  const numWallets = parseInt(await askQuestion("How many wallets do you want to create? (0 to skip)", logger));
  if (numWallets > 0) {
    const wallets = [];
    for (let i = 0; i < numWallets; i++) {
      const wallet = e.Wallet.createRandom();
      wallets.push(wallet.privateKey);
      logger.info(`✨ Generated wallet ${i + 1}/${numWallets}: ${chalk.green(maskAddress(wallet.address))}`);
    }
    try {
      fs.appendFileSync("address.txt", wallets.join("\n") + "\n");
      logger.info(`💾 Saved ${numWallets} wallets to address.txt`);
    } catch (e) {
      logger.error(`❌ Error saving to address.txt: ${chalk.red(e.message)}`);
      return;
    }
    logger.info(`--------------------------------------------`);
    await etc.delay(3e3);
  }

  let successfulClaims = 0;
  let failedClaims = 0;
  let processedCount = 0;

  if (!fs.existsSync("address.txt")) {
    logger.warn(`⚠️ address.txt not found. Please generate wallets first.`);
    return;
  }

  const privateKeys = fs.readFileSync("address.txt", "utf8").split("\n").filter(Boolean);
  logger.info(`📋 Total wallets to process for faucet claims: ${privateKeys.length}`);
  logger.info(`--------------------------------------------`);

  for (const privateKey of privateKeys) {
    if (!privateKey) continue;
    processedCount++;
    let walletName = `Wallet${processedCount}`;
    try {
      const wallet = new e.Wallet(privateKey, provider);
      const address = wallet.address;
      logger.info(`⚙️ Processing ${walletName} [${processedCount}/${privateKeys.length}]: ${chalk.green(maskAddress(address))}`);

      // Generate login URL
      const message = "pharos";
      const signature = await wallet.signMessage(message);
      const urlLogin = `${BASE_API}/user/login?address=${address}&signature=${signature}&invite_code=${REF_CODE}`;

      // Login
      logger.info(`🔑 Initiating login for ${walletName}`);
      let token = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const response = await axios.post(urlLogin, null, {
            headers: { ...headers, Authorization: "Bearer null", "Content-Length": "0" },
            timeout: 120000,
          });
          token = response.data.data.jwt;
          logger.info(`✅ Login successful for ${walletName}`);
          break;
        } catch (e) {
          if (attempt < 4) {
            await etc.delay(5000);
            continue;
          }
          logger.error(`❌ Login failed for ${walletName}: ${chalk.red(e.message)}`);
          failedClaims++;
          continue;
        }
      }
      if (!token) {
        logger.warn(`⏭️ Skipping faucet claim for ${walletName} due to login failure`);
        logger.info(`--------------------------------------------`);
        continue;
      }

      // Check faucet status
      logger.info(`🔍 Checking faucet status for ${walletName}`);
      let faucetStatus = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const response = await axios.get(`${BASE_API}/faucet/status?address=${address}`, {
            headers: { ...headers, Authorization: `Bearer ${token}` },
            timeout: 120000,
          });
          faucetStatus = response.data;
          break;
        } catch (e) {
          if (attempt < 4) {
            await etc.delay(5000);
            continue;
          }
          logger.error(`❌ Failed to get faucet status for ${walletName}: ${chalk.red(e.message)}`);
          failedClaims++;
          continue;
        }
      }
      if (!faucetStatus) {
        logger.warn(`⏭️ Skipping faucet claim for ${walletName} due to status check failure`);
        logger.info(`--------------------------------------------`);
        continue;
      }

      if (faucetStatus.msg === "ok" && faucetStatus.data?.is_able_to_faucet) {
        logger.info(`🪙 Initiating faucet claim for ${walletName}`);
        let claim = null;
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            const response = await axios.post(`${BASE_API}/faucet/daily?address=${address}`, null, {
              headers: { ...headers, Authorization: `Bearer ${token}`, "Content-Length": "0" },
              timeout: 120000,
            });
            claim = response.data;
            break;
          } catch (e) {
            if (e.response?.data) {
              claim = e.response.data;
              break;
            }
            if (attempt < 4) {
              await etc.delay(5000);
              continue;
            }
            logger.error(`❌ Faucet claim failed for ${walletName}: ${chalk.red(e.message)}`);
            failedClaims++;
            continue;
          }
        }
        if (claim?.msg === "ok") {
          logger.info(`✅ Faucet claimed successfully for ${walletName}: ${chalk.green("0.2 PHRS")} | ${etc.timelog()}`);
          successfulClaims++;
        } else {
          logger.error(`❌ Faucet claim failed for ${walletName}: ${chalk.red(claim?.data?.message || "Unknown error")}`);
          failedClaims++;
        }
      } else {
        const faucetAvailableWib = new Date(faucetStatus.data?.avaliable_timestamp * 1000).toLocaleString("en-US", { timeZone: "Asia/Jakarta" });
        logger.info(`⏳ Faucet not available for ${walletName}. Next available: ${faucetAvailableWib}`);
        failedClaims++;
      }
      logger.info(`--------------------------------------------`);
    } catch (e) {
      logger.error(`❌ Error for ${walletName}: ${chalk.red(e.message)} | ${etc.timelog()}`);
      failedClaims++;
      logger.info(`--------------------------------------------`);
    }
    await etc.delay(3e3);
  }

  logger.info(`📊 Faucet Claim Summary: Successful: ${chalk.green(successfulClaims)}, Failed: ${chalk.red(failedClaims)}`);
  logger.info(`--------------------------------------------`);

  if (!fs.existsSync("wallet.txt")) {
    logger.warn(`⚠️ wallet.txt not found. Skipping transfers.`);
    return;
  }

  const destAddress = fs.readFileSync("wallet.txt", "utf8").trim();
  if (!e.isAddress(destAddress)) {
    logger.warn(`⚠️ Invalid wallet address in wallet.txt. Skipping transfers.`);
    return;
  }

  let successfulTransfers = 0;
  let failedTransfers = 0;
  processedCount = 0;

  logger.info(`💸 Initiating transfers to main wallet: ${chalk.green(maskAddress(destAddress))}`);
  logger.info(`--------------------------------------------`);

  for (const privateKey of privateKeys) {
    if (!privateKey) continue;
    processedCount++;
    let walletName = `Wallet${processedCount}`;
    try {
      const wallet = new e.Wallet(privateKey, provider);
      const address = wallet.address;
      logger.info(`⚙️ Processing ${walletName} [${processedCount}/${privateKeys.length}]: ${chalk.green(maskAddress(address))}`);

      const balance = await provider.getBalance(address);
      const balanceEth = e.formatEther(balance);
      logger.info(`💰 Balance for ${walletName}: ${balanceEth} PHRS`);

      if (parseFloat(balanceEth) <= 0) {
        logger.info(`🤷 No funds to transfer for ${walletName}`);
        failedTransfers++;
        logger.info(`--------------------------------------------`);
        continue;
      }

      logger.info(`💸 Initiating transfer for ${walletName}`);
      const gasPrice = await provider.getFeeData();
      const gasLimit = 21000;
      const gasCost = gasPrice.gasPrice * BigInt(gasLimit);
      const amountToSend = balance - gasCost;

      if (amountToSend <= 0) {
        logger.warn(`📉 Balance too low for ${walletName} to cover gas fees`);
        failedTransfers++;
        logger.info(`--------------------------------------------`);
        continue;
      }

      const tx = await wallet.sendTransaction({
        to: destAddress,
        value: amountToSend,
        gasLimit: gasLimit,
      });
      logger.info(`🚀 Transaction sent for ${walletName}: ${chalk.green(pharos.explorer.tx(tx.hash))}`);
      await tx.wait();
      logger.info(`✅ Transfer Confirmed for ${walletName}: ${chalk.green(pharos.explorer.tx(tx.hash))} | ${etc.timelog()}`);
      successfulTransfers++;
      logger.info(`--------------------------------------------`);
    } catch (e) {
      logger.error(`❌ Transfer failed for ${walletName}: ${chalk.red(e.message)} | ${etc.timelog()}`);
      failedTransfers++;
      logger.info(`--------------------------------------------`);
    }
    await etc.delay(3e3);
  }

  logger.info(`📊 Transfer Summary: Successful: ${chalk.green(successfulTransfers)}, Failed: ${chalk.red(failedTransfers)}`);
  logger.info(`--------------------------------------------`);
}

module.exports = {
  performSwapUSDC,
  performSwapUSDT,
  addLpUSDC,
  addLpUSDT,
  accountCheckIn,
  accountLogin,
  accountCheck,
  accountClaimFaucet,
  claimFaucetUSDC,
  randomTransfer,
  socialTask,
  unlimitedFaucet,
};
