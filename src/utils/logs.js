const winston = require('winston');
const chalk = require('chalk');
const moment = require('moment');
const fs = require('fs');
const path = require('path');
const { format } = winston;

function setupLogger() {
  // Define custom format
  const customFormat = format.printf(({ level, message, timestamp, walletIndex = '0-' }) => {
    const formattedDate = moment(timestamp).format('YYYY-MM-DD HH:mm:ss');
    
    // Format wallet index properly - use it directly if it's already in the correct format
    let formattedWalletIndex;
    if (typeof walletIndex === 'string' && (walletIndex.includes('T') || walletIndex === '0-')) {
      // Already formatted (e.g., "T1-W1" or "0-")
      formattedWalletIndex = walletIndex;
    } else if (walletIndex === undefined || walletIndex === null || walletIndex === '') {
      // Default value for undefined/null
      formattedWalletIndex = '0-';
    } else {
      // Convert numeric index to padded format
      formattedWalletIndex = walletIndex.toString().padStart(2, '0');
    }
    
    // Define colors for different log levels
    let levelColor;
    switch (level) {
      case 'info':
        levelColor = chalk.green;
        break;
      case 'warn':
        levelColor = chalk.yellow;
        break;
      case 'error':
        levelColor = chalk.red;
        break;
      case 'debug':
        levelColor = chalk.blue;
        break;
      default:
        levelColor = chalk.white;
    }
    
    // Format: [Date - Time - Wallet Index] log message
    return `✨ ${chalk.gray('[')}${chalk.cyan(formattedDate)} - ${chalk.magenta(`Bot ${formattedWalletIndex}`)}${chalk.gray(']')} ${levelColor(message)}`;
  });
  
  // Create logger
  const logger = winston.createLogger({
    level: 'info',
    format: format.combine(
      format.timestamp(),
      customFormat
    ),
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
      new winston.transports.File({ filename: 'logs/combined.log' })
    ]
  });
  
  // Ensure logs directory exists
  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
  }
  
  return logger;
}

module.exports = {
  setupLogger
};
