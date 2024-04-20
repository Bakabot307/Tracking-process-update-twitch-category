const { exec } = require('child_process');
const csv = require('fast-csv');
const fs = require('fs');
const path = require('path');
const jsonFilePath = path.join(__dirname,'..', '/datas/AppName.json');


async function checkTargetProcesses(callback) {
  const targetProcesses = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
  try {
    const { stdout } = await new Promise((resolve, reject) => {
      exec('tasklist /FO CSV ', (err, stdout, stderr) => {
        if (err) {
          reject(err);
          return;
        }
        resolve({ stdout, stderr });
      });
    });
    let firstApp;;
    csv.parseString(stdout, { headers: true })
      .on('data', row => {
        const imageName = row['Image Name'].toLowerCase().replace('.exe', '');
        if(!firstApp){        
        firstApp = targetProcesses.find(x => x.name.replace(" ","").includes(imageName));
        }  
  })
      .on('end', () => {
        callback(firstApp);
      })
      .on('error', (error) => {
        console.error(error);
      });

  } catch (error) {
    console.error(error);
  }
  
}

module.exports = {
  checkTargetProcesses
};
