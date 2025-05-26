/**
 * src/utils/constants.js - Constants and addresses
 */
// Token addresses
const TOKEN_ADDRESSES = {
  PHRS: '0x76aaaDA469D23216bE5f7C596fA25F282Ff9b364',  // Wrapped PHRS
  USDC: '0xad902cf99c2de2f1ba5ec4d642fd7e49cae9ee37',
  USDT: '0xEd59De2D7ad9C043442e381231eE3646FC3C2939'
};

// Contract addresses
const CONTRACT_ADDRESSES = {
  swapRouter: '0x1A4DE519154Ae51200b0Ad7c90F7faC75547888a',
  positionManager: '0xF8a1D4FF0f9b9Af7CE58E1fc1833688F3BFd6115',
  factory: '0x7CE5b44F2d05babd29caE68557F52ab051265F01',
  quoter: '0x00f2f47d1ed593Cf0AF0074173E9DF95afb0206C'
};

// Chain ID
const CHAIN_ID = 688688;

// Pool fee tiers
const FEE_TIERS = {
  LOW: 500,    // 0.05%
  MEDIUM: 3000, // 0.3%
  HIGH: 10000   // 1%
};

module.exports = {
  TOKEN_ADDRESSES,
  CONTRACT_ADDRESSES,
  CHAIN_ID,
  FEE_TIERS
};
