const fs = require('fs');
const csv = require('csv-parser');

// 将CSV转换为Objects
function convertCSVToObjectSync(filePath) {
  const objects = [];

  const fileData = fs.readFileSync(filePath, 'utf-8');

  const lines = fileData.trim().split('\n');
  const header = lines[0].split(',');

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const obj = {};

    for (let j = 0; j < header.length; j++) {
      obj[header[j]] = values[j];
    }

    objects.push(obj);
  }

  return objects;
};
// 暂停函数
function sleep(minutes) {
    const milliseconds = minutes * 60 * 1000;
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  };

  const winston = require('winston');


// 保存日志
function saveLog(projectName, message) {
    const logger = winston.createLogger({
      level: 'info',
      format: winston.format.simple(),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: `./data/${projectName}.log` }),
      ],
    });
  
    logger.info(message);
  }
   

// 获取随机浮点数
function getRandomFloat(min, max) {
    return Math.random() * (max - min) + min;
  }
module.exports = { convertCSVToObjectSync, sleep, getRandomFloat, saveLog };
