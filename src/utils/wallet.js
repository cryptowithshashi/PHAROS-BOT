const { ethers } = require('ethers');
const { loadConfig } = require('../config');

const config = loadConfig();
const RPC_URL = config.api.zenith.rpc_url;

function createWallet(privateKey) {
  try {
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    return new ethers.Wallet(privateKey, provider);
  } catch (error) {
    throw new Error(`Failed to create wallet: ${error.message}`);
  }
}

function getWalletAddress(wallet) {
  return wallet.address;
}

async function signMessage(wallet, message) {
  try {
    return await wallet.signMessage(message);
  } catch (error) {
    throw new Error(`Failed to sign message: ${error.message}`);
  }
}

async function getBalance(wallet) {
  try {
    const balance = await wallet.getBalance();
    return ethers.utils.formatEther(balance);
  } catch (error) {
    throw new Error(`Failed to get balance: ${error.message}`);
  }
}

function toChecksumAddress(address) {
  try {
    return ethers.utils.getAddress(address);
  } catch (error) {
    throw new Error(`Invalid address format: ${address}`);
  }
}

module.exports = {
  createWallet,
  getWalletAddress,
  signMessage,
  getBalance,
  toChecksumAddress
};
