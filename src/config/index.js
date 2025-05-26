/**
 * src/config/index.js - Configuration loader
 */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/**
 * Load config from config.yaml
 */
function loadConfig() {
  try {
    const configPath = path.join(process.cwd(), 'config.yaml');
    const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
    return config;
  } catch (error) {
    console.error(`Error loading configuration: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  loadConfig
};
