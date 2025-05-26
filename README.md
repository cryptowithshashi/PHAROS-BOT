# Pharos Auto Bot

A Node.js script designed to automate interactions with the Pharos Testnet. This bot can handle multiple accounts, proxy support, and various automated tasks based on user configuration.

[![Version](https://img.shields.io/badge/version-v1.0.0-blue)](https://github.com/cryptowithshashi/PHAROS-BOT)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## Features

- **Automated Actions**: Performs daily check-ins, native/token (USDC, USDT) faucet claims, social tasks (Follow on X, Retweet, Comment, Join Discord), and on-chain actions (self-transfers, token swaps, add liquidity).
- **Optional Task Automation**: Configurable features like proxy integration for IP rotation.
- **Multi-Account Support**: Handles multiple accounts listed in `private.txt` (containing private keys).
- **Proxy Support**: Uses proxies listed in `proxy.txt`, matching them with accounts.
- **Continuous Operation**: Designed for robust, continuous operation with multi-threaded execution for efficiency.
- **Logging**: Provides detailed console logs for task execution status.
- **Cross-Platform Compatibility**: Supports Windows, macOS, and Linux (Termux-friendly).

## Pre-Requisites

- Ensure Git, Node.js (v16+), and npm are installed. If not, install them using your system's package manager.

For Debian/Ubuntu-based systems:
```bash
sudo apt update
sudo apt install git nodejs npm -y
```

## Installation Guide

Clone the repository:
```bash
git clone https://github.com/cryptowithshashi/PHAROS-BOT.git
cd PHAROS-BOT
```

Install dependencies:
```bash
npm install
```

## Configuration

### `private.txt`
Contains one private key per line (with or without '0x'). The bot will read this file and process all accounts.
Example:
```
0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567891
```
To edit: `nano private.txt` or use any text editor.

### `wallet.txt`
Put your main wallet address in `wallet.txt`. This is used for specific functions like consolidating funds from multiple wallets to one main wallet.
To edit: `nano wallet.txt` or use any text editor.

### `proxy.txt` (Optional)
Contains one proxy URL per line if you wish to use proxies.
Example:
```perl
http://username:password@proxy1.example.com:8080
http://username:password@proxy2.example.com:8080
```

## Execute the Code
```bash
node pharosbot.js
```
The script may present interactive prompts for certain settings or operations during runtime.

## File Structure Overview
```
PHAROS-BOT/
├── .github/workflows/   # GitHub Actions workflows
├── chains/              # Configuration files for Pharos testnet
├── logs/                # Log files
├── src/                 # Source code
├── .gitignore
├── LICENSE
├── README.md
├── package-lock.json
├── package.json
├── pharosActions.js     # Pharos-related actions
├── pharosbot.js         # Main bot script
├── private.txt          # Private keys
├── proxy.txt            # Proxy list
└── wallet.txt           # Main wallet address
```

## Disclaimer

This script is intended for educational and testing purposes only. Interacting with blockchain protocols involves risks, and using automation tools requires caution. Ensure you have permission to automate interactions with the Pharos Testnet and understand the implications. The author is not responsible for any misuse, violations of terms of service, or loss of funds.

## About Me

- **Twitter**: [https://x.com/SHASHI522004](https://x.com/SHASHI522004)
- **GitHub**: [https://github.com/cryptowithshashi](https://github.com/cryptowithshashi)